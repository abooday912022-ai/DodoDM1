//! End-to-end startup latency, progressive parallel connections, status truthfulness,
//! and multi-scenario verification tests for `swiftget-engine`.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use swiftget_engine::{Manager, NewDownload, RequestHeaders, Status};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;

#[derive(Clone, Default)]
struct ServerOpts {
    support_range: bool,
    header_delay: Duration,
    first_byte_delay: Duration,
    chunk_delay: Duration,
    chunk_size: usize,
    redirect_from: Option<String>,
    expected_cookie: Option<String>,
    expected_referer: Option<String>,
    expected_auth_header: Option<String>,
}

struct ServerStats {
    total_requests: AtomicU32,
    range_zero_open_probes: AtomicU32,
    range_requests: AtomicU32,
    full_get_requests: AtomicU32,
    bytes_sent: AtomicU64,
    active_now: AtomicU32,
    peak_concurrent: AtomicU32,
    missing_headers_count: AtomicU32,
    record_ranges: AtomicBool,
    recorded_ranges: Mutex<Vec<(usize, usize)>>,
}

impl Default for ServerStats {
    fn default() -> Self {
        Self {
            total_requests: AtomicU32::new(0),
            range_zero_open_probes: AtomicU32::new(0),
            range_requests: AtomicU32::new(0),
            full_get_requests: AtomicU32::new(0),
            bytes_sent: AtomicU64::new(0),
            active_now: AtomicU32::new(0),
            peak_concurrent: AtomicU32::new(0),
            missing_headers_count: AtomicU32::new(0),
            record_ranges: AtomicBool::new(false),
            recorded_ranges: Mutex::new(Vec::new()),
        }
    }
}

struct ConcurrencyGuard<'a>(&'a ServerStats);
impl<'a> ConcurrencyGuard<'a> {
    fn enter(s: &'a ServerStats) -> Self {
        let now = s.active_now.fetch_add(1, Ordering::SeqCst) + 1;
        let mut cur = s.peak_concurrent.load(Ordering::Relaxed);
        while now > cur {
            match s.peak_concurrent.compare_exchange_weak(cur, now, Ordering::Relaxed, Ordering::Relaxed) {
                Ok(_) => break,
                Err(v) => cur = v,
            }
        }
        Self(s)
    }
}
impl Drop for ConcurrencyGuard<'_> {
    fn drop(&mut self) {
        self.0.active_now.fetch_sub(1, Ordering::SeqCst);
    }
}

fn make_payload(len: usize, seed: u8) -> Arc<Vec<u8>> {
    Arc::new((0..len).map(|i| ((i.wrapping_mul(37) + seed as usize * 13) % 251) as u8).collect())
}

async fn start_test_server(data: Arc<Vec<u8>>, opts: ServerOpts) -> (u16, Arc<ServerStats>, Arc<AtomicBool>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let stats = Arc::new(ServerStats::default());
    let paused_drop = Arc::new(AtomicBool::new(false));
    let (s2, p2) = (stats.clone(), paused_drop.clone());
    tokio::spawn(async move {
        while let Ok((sock, _)) = listener.accept().await {
            let (data, opts, stats, paused_drop) = (data.clone(), opts.clone(), s2.clone(), p2.clone());
            tokio::spawn(async move {
                let _cg = ConcurrencyGuard::enter(&stats);
                let (r, mut w) = sock.into_split();
                let mut r = BufReader::new(r);
                let mut method = String::new();
                let mut path = String::new();
                let mut headers: HashMap<String, String> = HashMap::new();
                loop {
                    let mut line = String::new();
                    if r.read_line(&mut line).await.unwrap_or(0) == 0 || line.trim().is_empty() {
                        break;
                    }
                    if path.is_empty() {
                        let mut parts = line.split_whitespace();
                        method = parts.next().unwrap_or("GET").to_string();
                        path = parts.next().unwrap_or("/").to_string();
                    } else if let Some((k, v)) = line.split_once(':') {
                        headers.insert(k.trim().to_ascii_lowercase(), v.trim().to_string());
                    }
                }
                stats.total_requests.fetch_add(1, Ordering::Relaxed);
                if !opts.header_delay.is_zero() {
                    tokio::time::sleep(opts.header_delay).await;
                }
                if let Some(redir) = &opts.redirect_from {
                    if path == *redir {
                        let resp = "HTTP/1.1 302 Found\r\nLocation: /target.bin\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                        let _ = w.write_all(resp.as_bytes()).await;
                        return;
                    }
                }
                if let Some(exp) = &opts.expected_cookie {
                    if !headers.get("cookie").is_some_and(|v| v.contains(exp.as_str())) {
                        stats.missing_headers_count.fetch_add(1, Ordering::Relaxed);
                        let _ = w.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                        return;
                    }
                }
                if let Some(exp) = &opts.expected_referer {
                    if headers.get("referer").map(String::as_str) != Some(exp.as_str()) {
                        stats.missing_headers_count.fetch_add(1, Ordering::Relaxed);
                        let _ = w.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                        return;
                    }
                }
                if let Some(exp) = &opts.expected_auth_header {
                    if headers.get("authorization").map(String::as_str) != Some(exp.as_str()) {
                        stats.missing_headers_count.fetch_add(1, Ordering::Relaxed);
                        let _ = w.write_all(b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                        return;
                    }
                }
                let parsed_range = headers
                    .get("range")
                    .and_then(|v| v.to_ascii_lowercase().strip_prefix("bytes=").map(str::to_string))
                    .and_then(|r| {
                        let (a, b) = r.split_once('-')?;
                        let start: usize = a.trim().parse().ok()?;
                        let end: Option<usize> = if b.trim().is_empty() { None } else { Some(b.trim().parse().ok()?) };
                        Some((start, end))
                    });

                let (status_line, content_range, slice_start, slice_end) = if opts.support_range {
                    match parsed_range {
                        Some((a, b)) if a < data.len() => {
                            if a == 0 && b.is_none() {
                                stats.range_zero_open_probes.fetch_add(1, Ordering::Relaxed);
                            } else {
                                stats.range_requests.fetch_add(1, Ordering::Relaxed);
                            }
                            let b_clamped = b.unwrap_or(data.len() - 1).min(data.len() - 1);
                            (
                                "HTTP/1.1 206 Partial Content",
                                Some(format!("Content-Range: bytes {a}-{b_clamped}/{}\r\nAccept-Ranges: bytes\r\n", data.len())),
                                a,
                                b_clamped,
                            )
                        }
                        _ => {
                            stats.full_get_requests.fetch_add(1, Ordering::Relaxed);
                            ("HTTP/1.1 200 OK", Some("Accept-Ranges: bytes\r\n".to_string()), 0, data.len() - 1)
                        }
                    }
                } else {
                    stats.full_get_requests.fetch_add(1, Ordering::Relaxed);
                    ("HTTP/1.1 200 OK", None, 0, data.len() - 1)
                };

                let body_len = slice_end - slice_start + 1;
                let mut head = format!(
                    "{status_line}\r\n{}Content-Length: {body_len}\r\nContent-Disposition: attachment; filename=\"test.bin\"\r\nConnection: close\r\n\r\n",
                    content_range.unwrap_or_default()
                );
                if w.write_all(head.as_bytes()).await.is_err() {
                    head.clear();
                    return;
                }
                if method.eq_ignore_ascii_case("HEAD") {
                    return;
                }
                if stats.record_ranges.load(Ordering::Relaxed) {
                    stats.recorded_ranges.lock().unwrap().push((slice_start, slice_end));
                }
                if !opts.first_byte_delay.is_zero() {
                    tokio::time::sleep(opts.first_byte_delay).await;
                }
                let step = opts.chunk_size.max(8192);
                for chunk in data[slice_start..=slice_end].chunks(step) {
                    if paused_drop.load(Ordering::Relaxed) {
                        return;
                    }
                    if w.write_all(chunk).await.is_err() {
                        return;
                    }
                    stats.bytes_sent.fetch_add(chunk.len() as u64, Ordering::Relaxed);
                    if !opts.chunk_delay.is_zero() {
                        tokio::time::sleep(opts.chunk_delay).await;
                    }
                }
            });
        }
    });
    (port, stats, paused_drop)
}

async fn wait_finish(mgr: &Arc<Manager>, id: u64) -> swiftget_engine::DownloadView {
    for _ in 0..2000 {
        let v = mgr.get(id).unwrap();
        if matches!(v.status, Status::Completed | Status::Failed) {
            return v;
        }
        tokio::time::sleep(Duration::from_millis(15)).await;
    }
    panic!("download {id} did not finish cleanly");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn small_file_uses_single_connection_without_burst_overhead() {
    let data = make_payload(96 * 1024, 1);
    let (port, stats, _) = start_test_server(
        data.clone(),
        ServerOpts {
            support_range: true,
            ..Default::default()
        },
    )
    .await;
    let root = std::env::temp_dir().join(format!("dodo-lat-small-{}-{port}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let mgr = Manager::new(tokio::runtime::Handle::current(), root.join("app")).unwrap();
    let id = mgr.add(NewDownload {
        url: format!("http://127.0.0.1:{port}/small.bin"),
        save_dir: Some(root.join("out")),
        connections: Some(32),
        start: true,
        ..Default::default()
    });
    let done = wait_finish(&mgr, id).await;
    assert_eq!(done.status, Status::Completed, "{:?}", done.error);
    assert!(std::fs::read(&done.save_path).unwrap() == *data);
    // 96 KB < 2 * min_split (256 KB): should not spam 32 connections!
    assert_eq!(stats.total_requests.load(Ordering::Relaxed), 1, "expected single probe-kept stream");
    let t = done.timing.expect("timing recorded");
    assert!(t.first_byte_ms.is_some());
    assert!(t.total_startup_ms.is_some());
    mgr.remove(id, false);
    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn medium_and_large_files_scale_up_to_32_connections() {
    for &(label, size, conns) in &[("medium", 3 * 1024 * 1024, 16u32), ("large", 16 * 1024 * 1024, 32u32)] {
        let data = make_payload(size, conns as u8);
        let (port, stats, _) = start_test_server(
            data.clone(),
            ServerOpts {
                support_range: true,
                chunk_delay: Duration::from_millis(2),
                chunk_size: 32 * 1024,
                ..Default::default()
            },
        )
        .await;
        let root = std::env::temp_dir().join(format!("dodo-lat-{label}-{}-{port}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let mgr = Manager::new(tokio::runtime::Handle::current(), root.join("app")).unwrap();
        let id = mgr.add(NewDownload {
            url: format!("http://127.0.0.1:{port}/{label}.bin"),
            save_dir: Some(root.join("out")),
            connections: Some(conns),
            start: true,
            ..Default::default()
        });
        let done = wait_finish(&mgr, id).await;
        assert_eq!(done.status, Status::Completed, "{label}: {:?}", done.error);
        assert!(std::fs::read(&done.save_path).unwrap() == *data, "{label}: corrupted bytes");
        assert!(
            stats.peak_concurrent.load(Ordering::Relaxed) >= 4,
            "{label}: expected multi-connection ramp, peak={}",
            stats.peak_concurrent.load(Ordering::Relaxed)
        );
        let t = done.timing.expect("timing recorded");
        assert!(t.request_to_first_byte_ms.is_some());
        mgr.remove(id, false);
        let _ = std::fs::remove_dir_all(&root);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn range_and_non_range_servers_work_cleanly() {
    let data = make_payload(1_500_000, 3);
    // Non-range server (200 OK always)
    let (port, stats, _) = start_test_server(
        data.clone(),
        ServerOpts {
            support_range: false,
            ..Default::default()
        },
    )
    .await;
    let root = std::env::temp_dir().join(format!("dodo-lat-norange-{}-{port}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let mgr = Manager::new(tokio::runtime::Handle::current(), root.join("app")).unwrap();
    let id = mgr.add(NewDownload {
        url: format!("http://127.0.0.1:{port}/norange.bin"),
        save_dir: Some(root.join("out")),
        connections: Some(32),
        start: true,
        ..Default::default()
    });
    let done = wait_finish(&mgr, id).await;
    assert_eq!(done.status, Status::Completed, "{:?}", done.error);
    assert!(!done.resumable);
    assert!(std::fs::read(&done.save_path).unwrap() == *data);
    assert_eq!(stats.total_requests.load(Ordering::Relaxed), 1, "non-range must stream single connection cleanly");
    mgr.remove(id, false);
    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn redirect_cookies_referer_and_basic_auth_are_preserved() {
    let data = make_payload(1_024 * 1024, 5);
    // Basic "dXNlcjpwYXNz" == "user:pass"
    let (port, stats, _) = start_test_server(
        data.clone(),
        ServerOpts {
            support_range: true,
            redirect_from: Some("/download".into()),
            expected_cookie: Some("session=ok".into()),
            expected_referer: Some("https://site.test/page".into()),
            expected_auth_header: Some("Basic dXNlcjpwYXNz".into()),
            ..Default::default()
        },
    )
    .await;
    let root = std::env::temp_dir().join(format!("dodo-lat-redir-{}-{port}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let mgr = Manager::new(tokio::runtime::Handle::current(), root.join("app")).unwrap();
    let id = mgr.add(NewDownload {
        url: format!("http://127.0.0.1:{port}/download"),
        save_dir: Some(root.join("out")),
        headers: RequestHeaders {
            cookies: Some("session=ok".into()),
            referer: Some("https://site.test/page".into()),
            auth: Some(("user".into(), "pass".into())),
            ..Default::default()
        },
        connections: Some(8),
        start: true,
        ..Default::default()
    });
    let done = wait_finish(&mgr, id).await;
    assert_eq!(done.status, Status::Completed, "{:?}", done.error);
    assert_eq!(stats.missing_headers_count.load(Ordering::Relaxed), 0);
    assert!(std::fs::read(&done.save_path).unwrap() == *data);
    mgr.remove(id, false);
    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn slow_server_never_claims_downloading_before_first_byte() {
    let data = make_payload(512 * 1024, 7);
    let (port, _, _) = start_test_server(
        data.clone(),
        ServerOpts {
            support_range: true,
            header_delay: Duration::from_millis(260),
            first_byte_delay: Duration::from_millis(260),
            ..Default::default()
        },
    )
    .await;
    let root = std::env::temp_dir().join(format!("dodo-lat-slow-{}-{port}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let mgr = Manager::new(tokio::runtime::Handle::current(), root.join("app")).unwrap();
    let id = mgr.add(NewDownload {
        url: format!("http://127.0.0.1:{port}/slow.bin"),
        save_dir: Some(root.join("out")),
        connections: Some(8),
        start: true,
        ..Default::default()
    });

    let mut saw_connecting_without_bytes = false;
    let mut saw_downloading_after_bytes = false;
    for _ in 0..400 {
        let v = mgr.get(id).unwrap();
        if v.downloaded == 0 && v.status != Status::Completed {
            assert_ne!(v.status, Status::Downloading, "must NEVER report Downloading when downloaded==0 (stage={:?})", v.stage);
            assert_eq!(v.speed, 0.0, "speed must stay 0 before data so UI shows '--'");
            saw_connecting_without_bytes = true;
        }
        if v.status == Status::Downloading && v.downloaded > 0 {
            saw_downloading_after_bytes = true;
        }
        if matches!(v.status, Status::Completed | Status::Failed) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let done = mgr.get(id).unwrap();
    assert_eq!(done.status, Status::Completed, "{:?}", done.error);
    assert!(saw_connecting_without_bytes, "expected Connecting stage before slow server sent byte 0");
    assert!(saw_downloading_after_bytes || done.status == Status::Completed);
    let t = done.timing.expect("timing recorded");
    assert!(t.request_to_first_byte_ms.unwrap() >= 400.0, "slow ttfb was {:?}", t.request_to_first_byte_ms);
    assert!(matches!(t.metadata_ready_ms, Some(m) if m >= 200.0));
    assert!(std::fs::read(&done.save_path).unwrap() == *data);
    mgr.remove(id, false);
    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn pause_and_resume_does_not_redownload_completed_bytes() {
    let data = make_payload(4 * 1024 * 1024, 9);
    let (port, stats, _) = start_test_server(
        data.clone(),
        ServerOpts {
            support_range: true,
            chunk_delay: Duration::from_millis(6),
            chunk_size: 32 * 1024,
            ..Default::default()
        },
    )
    .await;
    let root = std::env::temp_dir().join(format!("dodo-lat-pause-{}-{port}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let mgr = Manager::new(tokio::runtime::Handle::current(), root.join("app")).unwrap();
    let id = mgr.add(NewDownload {
        url: format!("http://127.0.0.1:{port}/resume.bin"),
        save_dir: Some(root.join("out")),
        connections: Some(8),
        start: true,
        ..Default::default()
    });
    for _ in 0..400 {
        if mgr.get(id).unwrap().downloaded >= 1024 * 1024 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(15)).await;
    }
    mgr.pause(id);
    for _ in 0..100 {
        if mgr.get(id).unwrap().status == Status::Paused {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    tokio::time::sleep(Duration::from_millis(100)).await;
    let paused_view = mgr.get(id).unwrap();
    assert_eq!(paused_view.status, Status::Paused);
    assert!(paused_view.downloaded >= 1024 * 1024);

    stats.recorded_ranges.lock().unwrap().clear();
    stats.record_ranges.store(true, Ordering::SeqCst);
    mgr.start(id);
    let after_start = mgr.get(id).unwrap();
    assert_ne!(after_start.status, Status::Downloading, "resume must stay Connecting until resumed bytes arrive");
    let done = wait_finish(&mgr, id).await;
    assert_eq!(done.status, Status::Completed, "{:?}", done.error);
    assert!(std::fs::read(&done.save_path).unwrap() == *data);

    // Confirm resume requested only remaining byte ranges (+ at most 4KB segment overlap),
    // never re-downloading completed offsets from scratch.
    let mut ranges = stats.recorded_ranges.lock().unwrap().clone();
    ranges.sort_unstable();
    let mut resume_unique_bytes = 0u64;
    let mut cur: Option<(usize, usize)> = None;
    for (s, e) in ranges {
        match cur {
            None => cur = Some((s, e)),
            Some((cs, ce)) if s <= ce + 1 => cur = Some((cs, ce.max(e))),
            Some((cs, ce)) => {
                resume_unique_bytes += (ce - cs + 1) as u64;
                cur = Some((s, e));
            }
        }
    }
    if let Some((cs, ce)) = cur {
        resume_unique_bytes += (ce - cs + 1) as u64;
    }
    let remaining = (data.len() as u64).saturating_sub(paused_view.downloaded);
    assert!(
        resume_unique_bytes <= remaining + 8 * 4096 + 64 * 1024,
        "resume re-requested completed bytes: resume_unique={resume_unique_bytes}, remaining={remaining}, paused_downloaded={}",
        paused_view.downloaded
    );
    let sent = stats.bytes_sent.load(Ordering::Relaxed);
    assert!(
        sent < (data.len() as u64) * 3 / 2,
        "excessive total wire bytes on pause+resume: sent={sent}, file={}",
        data.len()
    );
    mgr.remove(id, false);
    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn measure_startup_latency_profile_scenarios() {
    let scenarios = [
        ("small_128kb_range", 128 * 1024, true, Duration::from_millis(25)),
        ("medium_4mb_range", 4 * 1024 * 1024, true, Duration::from_millis(25)),
        ("large_12mb_range", 12 * 1024 * 1024, true, Duration::from_millis(25)),
        ("non_range_1mb", 1024 * 1024, false, Duration::from_millis(25)),
    ];
    for (name, size, range, rtt) in scenarios {
        let data = make_payload(size, 11);
        let (port, stats, _) = start_test_server(
            data.clone(),
            ServerOpts {
                support_range: range,
                header_delay: rtt,
                ..Default::default()
            },
        )
        .await;
        let root = std::env::temp_dir().join(format!("dodo-bench-{name}-{}-{port}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let mgr = Manager::new(tokio::runtime::Handle::current(), root.join("app")).unwrap();
        let t0 = Instant::now();
        let id = mgr.add(NewDownload {
            url: format!("http://127.0.0.1:{port}/{name}.bin"),
            save_dir: Some(root.join("out")),
            connections: Some(32),
            start: true,
            ..Default::default()
        });
        let done = wait_finish(&mgr, id).await;
        assert_eq!(done.status, Status::Completed, "{name}: {:?}", done.error);
        let total_wall_ms = t0.elapsed().as_secs_f64() * 1000.0;
        let first_t = done.timing.expect("first timing");
        let peak1 = stats.peak_concurrent.load(Ordering::Relaxed);

        // Measure redownload (metadata known -> fast_fresh)
        stats.total_requests.store(0, Ordering::Relaxed);
        stats.peak_concurrent.store(0, Ordering::Relaxed);
        let r0 = Instant::now();
        mgr.restart(id);
        for _ in 0..10 {
            if mgr.get(id).unwrap().status != Status::Completed {
                break;
            }
            tokio::time::sleep(Duration::from_millis(2)).await;
        }
        let redone = wait_finish(&mgr, id).await;
        assert_eq!(redone.status, Status::Completed, "{name} restart: {:?}", redone.error);
        let redone_wall_ms = r0.elapsed().as_secs_f64() * 1000.0;
        let second_t = redone.timing.expect("restart timing");
        let peak2 = stats.peak_concurrent.load(Ordering::Relaxed);

        eprintln!(
            "[BENCH {name}] first_start: headers={:?}ms metadata={:?}ms first_seg={:?}ms ttfb={:?}ms init={:?}ms total_startup={:?}ms wall={total_wall_ms:.2}ms peak_conns={peak1} | redownload: headers={:?}ms ttfb={:?}ms init={:?}ms total_startup={:?}ms wall={redone_wall_ms:.2}ms peak_conns={peak2}",
            first_t.first_headers_ms,
            first_t.metadata_ready_ms,
            first_t.first_segment_started_ms,
            first_t.request_to_first_byte_ms,
            first_t.init_duration_ms,
            first_t.total_startup_ms,
            second_t.first_headers_ms,
            second_t.request_to_first_byte_ms,
            second_t.init_duration_ms,
            second_t.total_startup_ms,
        );
        assert!(std::fs::read(&redone.save_path).unwrap() == *data);
        mgr.remove(id, false);
        let _ = std::fs::remove_dir_all(&root);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn benchmark_before_vs_after_startup_latency() {
    use std::fs::OpenOptions;
    use swiftget_engine::{fileio, http, segments};

    let data = make_payload(4 * 1024 * 1024, 15);
    let opts = ServerOpts {
        support_range: true,
        header_delay: Duration::from_millis(25),
        chunk_delay: Duration::from_millis(5),
        chunk_size: 16 * 1024,
        ..Default::default()
    };

    // ---- 1. BEFORE (legacy startup path: fresh client + unkept probe + sync sparse/set_len + 32 burst + 256KB/80ms wbuf) ----
    let (port_old, stats_old, _) = start_test_server(data.clone(), opts.clone()).await;
    let old_root = std::env::temp_dir().join(format!("dodo-before-{}-{port_old}", std::process::id()));
    let _ = std::fs::remove_dir_all(&old_root);
    std::fs::create_dir_all(&old_root).unwrap();
    let old_part = old_root.join("before.bin.sgpart");
    let before_url = format!("http://127.0.0.1:{port_old}/before.bin");
    let direct_proxy = http::ProxyConfig {
        mode: 0,
        host: String::new(),
        port: 0,
        user: String::new(),
        password: String::new(),
        bypass: String::new(),
    };

    let t_old = Instant::now();
    let client = http::build_client_with(&direct_proxy).unwrap();
    let _probe = http::probe_quick(&client, &before_url, &RequestHeaders::default(), "DODO-DM1")
        .await
        .unwrap();
    // Pre-fix flow could discard any kept opening stream before workers re-opened ranges:
    let _ = http::take_kept(&before_url);
    let probe_done_ms = t_old.elapsed().as_secs_f64() * 1000.0;

    let disk_t0 = Instant::now();
    if let Some(dir) = old_part.parent() {
        std::fs::create_dir_all(dir).unwrap();
    }
    let f = OpenOptions::new().create(true).read(true).write(true).open(&old_part).unwrap();
    fileio::set_hidden(&old_part, true);
    fileio::make_sparse(&f);
    f.set_len(data.len() as u64).unwrap();
    let sync_disk_ms = disk_t0.elapsed().as_secs_f64() * 1000.0;
    let file_arc = Arc::new(f);

    let segs = segments::plan(data.len() as u64, 32, 128 * 1024);
    let (tx, mut rx) = tokio::sync::mpsc::channel::<f64>(1);
    let mut set = tokio::task::JoinSet::new();
    for seg in segs {
        let c = client.clone();
        let url = before_url.clone();
        let tx = tx.clone();
        let f_clone = file_arc.clone();
        set.spawn(async move {
            let mut resp = http::request(&c, &url, &RequestHeaders::default(), "DODO-DM1")
                .header("Range", format!("bytes={}-{}", seg.start, seg.end - 1))
                .send()
                .await
                .unwrap();
            let mut wbuf: Vec<u8> = Vec::with_capacity(256 * 1024);
            let mut last_flush = Instant::now();
            let mut pos = seg.start;
            while let Some(chunk) = resp.chunk().await.unwrap() {
                wbuf.extend_from_slice(&chunk);
                if wbuf.len() >= 256 * 1024 || last_flush.elapsed() >= Duration::from_millis(80) {
                    last_flush = Instant::now();
                    fileio::write_at(&f_clone, &wbuf, pos).unwrap();
                    pos += wbuf.len() as u64;
                    wbuf.clear();
                    let _ = tx.try_send(t_old.elapsed().as_secs_f64() * 1000.0);
                }
            }
            if !wbuf.is_empty() {
                fileio::write_at(&f_clone, &wbuf, pos).unwrap();
                let _ = tx.try_send(t_old.elapsed().as_secs_f64() * 1000.0);
            }
        });
    }
    drop(tx);
    let old_first_visible_ms = rx.recv().await.unwrap();
    while set.join_next().await.is_some() {}
    let old_total_ms = t_old.elapsed().as_secs_f64() * 1000.0;
    let old_peak = stats_old.peak_concurrent.load(Ordering::Relaxed);
    drop(file_arc);
    let _ = std::fs::remove_dir_all(&old_root);

    // ---- 2. AFTER (optimized DODO-DM1 Manager: shared pool + async disk prep + immediate stream + progressive ramp) ----
    let (port_new, stats_new, _) = start_test_server(data.clone(), opts).await;
    let new_root = std::env::temp_dir().join(format!("dodo-after-{}-{port_new}", std::process::id()));
    let _ = std::fs::remove_dir_all(&new_root);
    let mgr = Manager::new(tokio::runtime::Handle::current(), new_root.join("app")).unwrap();
    let _ = http::shared_client_for(&direct_proxy);
    let t_new = Instant::now();
    let id = mgr.add(NewDownload {
        url: format!("http://127.0.0.1:{port_new}/after.bin"),
        save_dir: Some(new_root.join("out")),
        connections: Some(32),
        start: true,
        ..Default::default()
    });
    let done = wait_finish(&mgr, id).await;
    assert_eq!(done.status, Status::Completed, "{:?}", done.error);
    let new_wall_ms = t_new.elapsed().as_secs_f64() * 1000.0;
    let new_t = done.timing.expect("optimized timing");
    let new_peak = stats_new.peak_concurrent.load(Ordering::Relaxed);

    // Also measure second/restart startup with metadata already known:
    stats_new.peak_concurrent.store(0, Ordering::Relaxed);
    let t_re = Instant::now();
    mgr.restart(id);
    for _ in 0..10 {
        if mgr.get(id).unwrap().status != Status::Completed {
            break;
        }
        tokio::time::sleep(Duration::from_millis(2)).await;
    }
    let redone = wait_finish(&mgr, id).await;
    assert_eq!(redone.status, Status::Completed);
    let re_wall_ms = t_re.elapsed().as_secs_f64() * 1000.0;
    let re_t = redone.timing.expect("restart timing");

    eprintln!(
        "[BENCH BEFORE-VS-AFTER 4MB 25ms-RTT] BEFORE(legacy): probe={probe_done_ms:.2}ms sync_disk={sync_disk_ms:.2}ms first_byte_visible={old_first_visible_ms:.2}ms total_wall={old_total_ms:.2}ms peak_conns={old_peak} | AFTER(first): init={:?}ms ttfb={:?}ms wall={new_wall_ms:.2}ms peak_conns={new_peak} | AFTER(redownload): init={:?}ms ttfb={:?}ms wall={re_wall_ms:.2}ms",
        new_t.init_duration_ms,
        new_t.request_to_first_byte_ms,
        re_t.init_duration_ms,
        re_t.request_to_first_byte_ms,
    );
    assert!(new_t.request_to_first_byte_ms.unwrap_or(9999.0) < old_first_visible_ms);
    mgr.remove(id, false);
    let _ = std::fs::remove_dir_all(&new_root);
}
