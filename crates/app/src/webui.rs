//! Local authenticated UI HTTP server + static React asset server + full
//! REST bridge over every capability of `swiftget_engine::Manager` and the
//! desktop integration modules.

use crate::api::{self, ApiEvent};
use crate::common::{
    err_text, expand_pattern, extract_links, is_download_address, kind_for,
    looks_like_torrent, note, open_folder_select, open_with_dialog, part_name, sha256_file,
    SHORTCUTS, WHATS_NEW,
};
use crate::i18n::{self, t, tf};
use crate::tray::TrayAction;
use crate::{assoc, autostart, browser, preview, sound};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use swiftget_engine::config::{
    AfterDone, CategoryDef, QueueDef, QueueSchedule, ServerLimit, Settings, SiteLogin, ALL_COLUMNS,
    MAIN_QUEUE,
};
use swiftget_engine::ef2::{self, Ef2Item};
use swiftget_engine::grabber::{self, Checked, FoundFile, GrabOptions, GrabProgress};
use swiftget_engine::sync::LockOk;
use swiftget_engine::torrent;
use swiftget_engine::ytdlp::{self, YtOption};
use swiftget_engine::{
    default_data_dir, fmt_duration, fmt_size, selfupdate, system, tools, Clip, ClipSource,
    DetailsEdit, DownloadKind, DownloadStage, DownloadView, Manager, NewDownload, PreviewSource,
    ProbeResult, RequestHeaders, Status, Step,
};
use tiny_http::{Header, Method, Request, Response, Server};
use tokio_util::sync::CancellationToken;

include!(concat!(env!("OUT_DIR"), "/web_assets.rs"));

/// Actions the web UI or backend can send to the native desktop window loop.
#[derive(Debug, Clone)]
pub enum WindowCmd {
    Show,
    Hide,
    Toggle,
    Minimize,
    MaximizeToggle,
    Drag,
    Quit,
}

#[derive(Clone)]
pub struct GrabItem {
    pub checked: bool,
    pub url: String,
    pub name: String,
    pub ext: String,
    pub kind: &'static str,
    pub text: String,
    pub page: String,
    pub is_page: bool,
    pub size: Option<u64>,
    pub gone: Option<String>,
}

#[derive(Default)]
pub struct GrabState {
    pub running: bool,
    pub finished: bool,
    pub pages_done: usize,
    pub pages_queued: usize,
    pub current_url: String,
    pub items: Vec<GrabItem>,
    pub asking: Arc<std::sync::atomic::AtomicUsize>,
    pub cancel: Option<CancellationToken>,
    pub asking_cancel: Option<CancellationToken>,
}

#[derive(Default, Clone, Serialize)]
pub struct MagnetInspectState {
    pub id: u64,
    pub uri: String,
    pub done: bool,
    pub ok: bool,
    pub error: Option<String>,
    pub name: String,
    pub total_size: u64,
    pub suggested_folder: String,
    pub files: Vec<Value>,
}

#[derive(Default, Clone, Serialize)]
pub struct UpdateUiState {
    pub checking: bool,
    pub downloading: bool,
    pub done: bool,
    pub available: bool,
    pub configured: bool,
    pub source_url: String,
    pub latest_version: Option<String>,
    pub release_url: Option<String>,
    pub error: Option<String>,
    pub message: String,
    pub setup_path: Option<String>,
    pub setup_sha256: Option<String>,
    pub setup_bytes: Option<u64>,
    pub downloaded_bytes: u64,
    pub progress: f32,
}

pub struct WebUiState {
    pub mgr: Arc<Manager>,
    pub rt: tokio::runtime::Handle,
    pub session_token: String,
    pub ui_port: u16,
    pub pending_events: Mutex<VecDeque<Value>>,
    pub pair_channels: Mutex<HashMap<u64, std::sync::mpsc::Sender<bool>>>,
    pub next_pair_id: AtomicU64,
    pub grab: Arc<Mutex<GrabState>>,
    pub magnet: Arc<Mutex<Option<MagnetInspectState>>>,
    pub update_state: Arc<Mutex<UpdateUiState>>,
    pub preview_cancel: Mutex<Option<CancellationToken>>,
    pub clip_preview_state: Arc<Mutex<Option<(bool, Option<String>)>>>,
    pub power_countdown: Mutex<Option<(AfterDone, i32)>>,
    pub relayed: Mutex<HashMap<String, (u64, Instant, u32)>>,
    pub refresh_id: AtomicU64,
    pub last_api_add: Mutex<Option<(String, Instant)>>,
    pub groups_waiting: Mutex<std::collections::HashSet<u64>>,
    pub window_cb: Box<dyn Fn(WindowCmd) + Send + Sync>,
    pub limiter_sync_cb: Mutex<Option<Box<dyn Fn(bool) + Send + Sync>>>,
    pub shutdown_requested: AtomicBool,
    /// Per-segment speed tracker: (download_id, seg_idx) -> (last_pos, last_time, smoothed_bps)
    pub seg_rates: Mutex<HashMap<(u64, usize), (u64, Instant, f64)>>,
}

impl WebUiState {
    pub fn push_event(&self, val: Value) {
        self.pending_events.lock_ok().push_back(val);
    }

    pub fn send_window(&self, cmd: WindowCmd) {
        if matches!(cmd, WindowCmd::Quit) {
            self.shutdown_requested.store(true, Ordering::Relaxed);
        }
        (self.window_cb)(cmd);
    }
}

pub fn start_server(
    mgr: Arc<Manager>,
    rt: tokio::runtime::Handle,
    window_cb: Box<dyn Fn(WindowCmd) + Send + Sync>,
) -> anyhow::Result<Arc<WebUiState>> {
    let server = Server::http(("127.0.0.1", 0)).map_err(|e| anyhow::anyhow!("webui bind: {e}"))?;
    let ui_port = server
        .server_addr()
        .to_ip()
        .map(|a| a.port())
        .ok_or_else(|| anyhow::anyhow!("webui port missing"))?;
    let session_token = swiftget_engine::secret::random_token();
    let state = Arc::new(WebUiState {
        mgr,
        rt,
        session_token,
        ui_port,
        pending_events: Mutex::new(VecDeque::new()),
        pair_channels: Mutex::new(HashMap::new()),
        next_pair_id: AtomicU64::new(1),
        grab: Arc::new(Mutex::new(GrabState::default())),
        magnet: Arc::new(Mutex::new(None)),
        update_state: Arc::new(Mutex::new(UpdateUiState::default())),
        preview_cancel: Mutex::new(None),
        clip_preview_state: Arc::new(Mutex::new(None)),
        power_countdown: Mutex::new(None),
        relayed: Mutex::new(HashMap::new()),
        refresh_id: AtomicU64::new(0),
        last_api_add: Mutex::new(None),
        groups_waiting: Mutex::new(std::collections::HashSet::new()),
        window_cb,
        limiter_sync_cb: Mutex::new(None),
        shutdown_requested: AtomicBool::new(false),
        seg_rates: Mutex::new(HashMap::new()),
    });

    let st = state.clone();
    std::thread::Builder::new()
        .name("dodo-webui".into())
        .spawn(move || {
            for req in server.incoming_requests() {
                let st2 = st.clone();
                std::thread::spawn(move || handle_http(req, &st2));
            }
        })?;

    Ok(state)
}

fn header_val(req: &Request, name: &str) -> Option<String> {
    req.headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name))
        .map(|h| h.value.as_str().to_string())
}

fn host_allowed(host: Option<&str>, ui_port: u16) -> bool {
    let Some(host) = host else { return true };
    let h = host.trim().to_ascii_lowercase();
    h == format!("127.0.0.1:{ui_port}")
        || h == format!("localhost:{ui_port}")
        || h == format!("[::1]:{ui_port}")
        || h == "127.0.0.1"
        || h == "localhost"
}

fn origin_allowed(origin: Option<&str>, ui_port: u16) -> Option<String> {
    let Some(origin) = origin else {
        return Some("*".into());
    };
    let o = origin.trim();
    let lower = o.to_ascii_lowercase();
    if lower == format!("http://127.0.0.1:{ui_port}")
        || lower == format!("http://localhost:{ui_port}")
        || lower == "http://localhost:5173"
        || lower == "http://127.0.0.1:5173"
        || lower == "null"
        || lower.starts_with("file://")
    {
        return Some(o.to_string());
    }
    None
}

fn reply_json(req: Request, status: u16, val: Value, allow_origin: &str) {
    let body = serde_json::to_string(&val).unwrap_or_else(|_| "{}".into());
    let resp = Response::from_string(body)
        .with_status_code(status)
        .with_header(Header::from_bytes("Content-Type", "application/json; charset=utf-8").unwrap())
        .with_header(Header::from_bytes("Cache-Control", "no-store").unwrap())
        .with_header(Header::from_bytes("Access-Control-Allow-Origin", allow_origin).unwrap())
        .with_header(Header::from_bytes("Access-Control-Allow-Headers", "Content-Type, X-Dodo-Session").unwrap())
        .with_header(Header::from_bytes("Access-Control-Allow-Methods", "GET, POST, OPTIONS").unwrap());
    let _ = req.respond(resp);
}

fn reply_bytes(req: Request, status: u16, mime: &str, bytes: &[u8]) {
    let resp = Response::from_data(bytes.to_vec())
        .with_status_code(status)
        .with_header(Header::from_bytes("Content-Type", mime).unwrap())
        .with_header(Header::from_bytes("Cache-Control", "no-store").unwrap());
    let _ = req.respond(resp);
}

fn read_json_body<T: for<'de> Deserialize<'de>>(req: &mut Request) -> Result<T, String> {
    let mut body = String::new();
    req.as_reader()
        .take(16 << 20)
        .read_to_string(&mut body)
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&body).map_err(|e| format!("invalid json: {e}"))
}

fn handle_http(mut req: Request, st: &Arc<WebUiState>) {
    let host = header_val(&req, "Host");
    if !host_allowed(host.as_deref(), st.ui_port) {
        let _ = req.respond(Response::from_string("Forbidden").with_status_code(403));
        return;
    }
    let origin = header_val(&req, "Origin");
    let Some(allow_origin) = origin_allowed(origin.as_deref(), st.ui_port) else {
        let _ = req.respond(Response::from_string("Forbidden origin").with_status_code(403));
        return;
    };
    if *req.method() == Method::Options {
        reply_json(req, 200, json!({"ok": true}), &allow_origin);
        return;
    }

    let raw_url = req.url().to_string();
    let (path, query) = raw_url.split_once('?').unwrap_or((&raw_url, ""));

    // Serve static React assets on non-/ui paths
    if !path.starts_with("/ui/") {
        let lookup = if path == "/" || path.is_empty() { "/index.html" } else { path };
        if let Some((mime, bytes)) = web_asset(lookup) {
            if lookup == "/index.html" {
                let mut html = String::from_utf8_lossy(bytes).into_owned();
                let inject = format!(
                    "<script>window.__DODO_API_BASE__='';window.__DODO_UI_TOKEN__={};</script>",
                    serde_json::to_string(&st.session_token).unwrap_or_else(|_| "\"\"".into())
                );
                html = html.replacen("<head>", &format!("<head>{inject}"), 1);
                reply_bytes(req, 200, mime, html.as_bytes());
                return;
            }
            reply_bytes(req, 200, mime, bytes);
            return;
        }
        // Fallback to index.html for SPA paths
        if let Some((mime, bytes)) = web_asset("/index.html") {
            let mut html = String::from_utf8_lossy(bytes).into_owned();
            let inject = format!(
                "<script>window.__DODO_API_BASE__='';window.__DODO_UI_TOKEN__={};</script>",
                serde_json::to_string(&st.session_token).unwrap_or_else(|_| "\"\"".into())
            );
            html = html.replacen("<head>", &format!("<head>{inject}"), 1);
            reply_bytes(req, 200, mime, html.as_bytes());
            return;
        }
        let _ = req.respond(Response::from_string("React UI assets missing (build dodo-react-ui first)").with_status_code(404));
        return;
    }

    // All /ui/* routes require the session token header (or query token on GET translations)
    let hdr_tok = header_val(&req, "X-Dodo-Session");
    let q_tok = query.split('&').find_map(|kv| kv.strip_prefix("t="));
    if hdr_tok.as_deref() != Some(st.session_token.as_str()) && q_tok != Some(st.session_token.as_str()) {
        reply_json(req, 401, json!({"error": "unauthorized"}), &allow_origin);
        return;
    }

    let method = req.method().clone();
    let res = match (method, path) {
        (Method::Get, "/ui/state") => Ok(build_state_json(st)),
        (Method::Get, p) if p.starts_with("/ui/translations/") => {
            let code = p.trim_start_matches("/ui/translations/");
            let ui_str = i18n::ui_json(code);
            let mut map: serde_json::Map<String, Value> = serde_json::from_str(ui_str).unwrap_or_default();
            for (k, v) in i18n::rs_map(code) {
                map.entry(k).or_insert(Value::String(v));
            }
            Ok(Value::Object(map))
        }
        (Method::Get, "/ui/grabber/state") => Ok(grabber_state_json(st)),
        (Method::Get, "/ui/torrent/inspect-status") => Ok(magnet_inspect_json(st)),
        (Method::Get, p) if p.starts_with("/ui/torrent/live/") => {
            let id_str = p.trim_start_matches("/ui/torrent/live/");
            let id = id_str.parse::<u64>().unwrap_or(0);
            Ok(torrent_live_json(&st.mgr, id))
        }
        (Method::Get, p) if p.starts_with("/ui/queues/") && p.ends_with("/files") => {
            let mid = p.trim_start_matches("/ui/queues/").trim_end_matches("/files");
            let qid = mid.parse::<u64>().unwrap_or(MAIN_QUEUE);
            Ok(queue_files_json(&st.mgr, qid))
        }
        (Method::Get, "/ui/browsers") => Ok(browsers_json()),
        (Method::Get, "/ui/updates/state") => Ok(update_state_json(st)),
        (Method::Get, "/ui/clip/preview-status") => Ok(clip_preview_json(st)),
        (Method::Get, "/ui/info/texts") => Ok(json!({
            "shortcuts": t(SHORTCUTS),
            "whats_new": WHATS_NEW.iter().map(|s| t(s)).collect::<Vec<_>>(),
            "version": env!("CARGO_PKG_VERSION"),
        })),

        (Method::Post, "/ui/window") => handle_window(&mut req, st),
        (Method::Post, "/ui/probe") => handle_probe(&mut req, st),
        (Method::Post, "/ui/add") => handle_add(&mut req, st),
        (Method::Post, "/ui/batch/preview") => handle_batch_preview(&mut req),
        (Method::Post, "/ui/batch") => handle_batch(&mut req, st),
        (Method::Post, "/ui/action") => handle_action(&mut req, st),
        (Method::Post, "/ui/grabber/start") => handle_grabber_start(&mut req, st),
        (Method::Post, "/ui/grabber/stop") => handle_grabber_stop(st),
        (Method::Post, "/ui/grabber/download") => handle_grabber_download(&mut req, st),
        (Method::Post, "/ui/playlist/fetch") => handle_playlist_fetch(&mut req, st),
        (Method::Post, "/ui/playlist/download") => handle_playlist_download(&mut req, st),
        (Method::Post, "/ui/clip/fetch") => handle_clip_fetch(&mut req, st),
        (Method::Post, "/ui/clip/preview") => handle_clip_preview(&mut req, st),
        (Method::Post, "/ui/clip/download") => handle_clip_download(&mut req, st),
        (Method::Post, "/ui/torrent/inspect") => handle_torrent_inspect(&mut req, st),
        (Method::Post, "/ui/torrent/add") => handle_torrent_add(&mut req, st),
        (Method::Post, p) if p.starts_with("/ui/torrent/live/") => {
            let id_str = p.trim_start_matches("/ui/torrent/live/");
            let id = id_str.parse::<u64>().unwrap_or(0);
            handle_torrent_live_action(&mut req, st, id)
        }
        (Method::Post, "/ui/queues/add") => handle_queue_add(&mut req, st),
        (Method::Post, "/ui/queues/update") => handle_queue_update(&mut req, st),
        (Method::Post, "/ui/queues/delete") => handle_queue_delete(&mut req, st),
        (Method::Post, "/ui/queues/start") => handle_queue_start_stop(&mut req, st, true),
        (Method::Post, "/ui/queues/stop") => handle_queue_start_stop(&mut req, st, false),
        (Method::Post, "/ui/queues/move-file") => handle_queue_move_file(&mut req, st),
        (Method::Post, "/ui/categories/save") => handle_category_save(&mut req, st),
        (Method::Post, "/ui/categories/delete") => handle_category_delete(&mut req, st),
        (Method::Post, "/ui/settings") => handle_settings(&mut req, st),
        (Method::Post, "/ui/dialog/pick-folder") => handle_pick_folder(&mut req),
        (Method::Post, "/ui/dialog/pick-file") => handle_pick_file(&mut req),
        (Method::Post, "/ui/import") => handle_import(&mut req, st),
        (Method::Post, "/ui/export") => handle_export(&mut req, st),
        (Method::Post, "/ui/browsers/action") => handle_browsers_action(&mut req, st),
        (Method::Post, "/ui/updates/check-app") => handle_update_check(&mut req, st),
        (Method::Post, "/ui/updates/install-app") => handle_update_install(st),
        (Method::Post, "/ui/updates/tools") => handle_update_tools(st),
        (Method::Post, "/ui/pair/respond") => handle_pair_respond(&mut req, st),
        (Method::Post, "/ui/power") => handle_power(&mut req, st),
        (Method::Post, "/ui/open-download-folder") => {
            let dir = st.mgr.settings().download_dir;
            let _ = std::fs::create_dir_all(&dir);
            let _ = open::that_detached(&dir);
            Ok(json!({"ok": true}))
        }
        _ => Err((404, "not found".into())),
    };

    match res {
        Ok(val) => reply_json(req, 200, val, &allow_origin),
        Err((code, msg)) => reply_json(req, code, json!({"error": msg}), &allow_origin),
    }
}

type ApiRes = Result<Value, (u16, String)>;

fn bad(msg: impl Into<String>) -> (u16, String) {
    (400, msg.into())
}

fn serialize_download(v: &DownloadView, s: &Settings) -> Value {
    serialize_download_with_rates(v, s, None)
}

fn serialize_download_with_rates(
    v: &DownloadView,
    s: &Settings,
    mut seg_rates: Option<&mut HashMap<(u64, usize), (u64, Instant, f64)>>,
) -> Value {
    let queue_name = v.queue.and_then(|qid| s.queue(qid)).map(|q| q.name.clone());
    let status_name = match v.status {
        Status::Queued => "Queued",
        Status::Connecting => "Connecting",
        Status::Downloading => "Downloading",
        Status::Assembling => "Assembling",
        Status::Paused => "Paused",
        Status::Completed => "Completed",
        Status::Failed => "Failed",
    };
    let status_label = match v.status {
        Status::Downloading if v.waiting => t("Waiting for internet…"),
        Status::Downloading if v.stage == DownloadStage::DataStarted => t("Data transfer started"),
        Status::Downloading => t("Downloading"),
        Status::Paused => t("Paused"),
        Status::Completed => t("Complete"),
        Status::Failed => t("Download failed"),
        Status::Connecting => match v.stage {
            DownloadStage::CheckingLink => t("Checking link…"),
            DownloadStage::Initializing => t("Initializing download…"),
            _ => t("Connecting to server…"),
        },
        Status::Assembling => t("Assembling…"),
        Status::Queued => t("Queued"),
    };
    let step_json = v.step.map(|(st, p)| {
        let label = match st {
            Step::Join => t("Joining picture and sound…"),
            Step::ToMp4 => t("Making MP4…"),
            Step::ToMp3 => t("Making MP3…"),
            Step::Move => t("Moving…"),
            Step::Cut => t("Cutting part…"),
            Step::Check => t("Checking file…"),
        };
        json!({ "code": st.code(), "label": label, "progress": p * 100.0, "percent": (p * 100.0).round() as i32 })
    });
    let now = Instant::now();
    let segs: Vec<Value> = v
        .segments
        .iter()
        .enumerate()
        .map(|(idx, (start, pos, end, active))| {
            let len = end.saturating_sub(*start);
            let done = pos.saturating_sub(*start).min(len);
            let is_done = len > 0 && *pos >= *end;
            let pct = if len > 0 { ((done as f64 / len as f64) * 100.0).clamp(0.0, 100.0) } else { 0.0 };
            let seg_speed = if let Some(rates) = seg_rates.as_deref_mut() {
                if *active && !is_done {
                    let key = (v.id, idx);
                    match rates.get_mut(&key) {
                        Some((last_pos, last_t, smooth)) => {
                            let dt = now.duration_since(*last_t).as_secs_f64();
                            if dt >= 0.15 {
                                let delta = pos.saturating_sub(*last_pos) as f64;
                                let inst = delta / dt;
                                *smooth = if *smooth <= 1.0 { inst } else { *smooth * 0.55 + inst * 0.45 };
                                *last_pos = *pos;
                                *last_t = now;
                            }
                            *smooth
                        }
                        None => {
                            rates.insert(key, (*pos, now, 0.0));
                            0.0
                        }
                    }
                } else {
                    rates.remove(&(v.id, idx));
                    0.0
                }
            } else {
                0.0
            };
            json!({
                "id": idx + 1,
                "start": start,
                "pos": pos,
                "end": end,
                "active": active,
                "done": is_done,
                "progress": pct,
                "downloaded": done,
                "downloaded_fmt": fmt_size(done),
                "total": len,
                "total_fmt": fmt_size(len),
                "speed": seg_speed,
                "speed_fmt": if seg_speed > 1.0 && *active { format!("{}/s", fmt_size(seg_speed as u64)) } else { String::new() },
            })
        })
        .collect();
    let kind_str = match v.kind {
        DownloadKind::Http => "Http",
        DownloadKind::Hls => "Hls",
        DownloadKind::Dash => "Dash",
        DownloadKind::Torrent => "Torrent",
    };
    let file_kind = if v.kind == DownloadKind::Torrent { "torrent" } else { kind_for(&v.file_name) };
    json!({
        "id": v.id,
        "url": v.url,
        "file_name": v.file_name,
        "rtl": i18n::rtl_text(&v.file_name),
        "save_path": v.save_path.to_string_lossy(),
        "save_dir": v.save_path.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
        "category": v.category,
        "kind": kind_str,
        "file_kind": file_kind,
        "status": status_name,
        "status_label": status_label,
        "error": v.error.as_deref().map(err_text),
        "total_size": v.total_size,
        "total_size_fmt": v.total_size.map(fmt_size).unwrap_or_default(),
        "downloaded": v.downloaded,
        "downloaded_fmt": fmt_size(v.downloaded),
        "progress": (v.progress() * 100.0).clamp(0.0, 100.0),
        "speed": v.speed,
        "speed_fmt": if v.status == Status::Downloading && v.speed > 0.0 {
            format!("{}/s", fmt_size(v.speed as u64))
        } else if v.status.is_running() || v.status == Status::Queued {
            "--".to_string()
        } else {
            String::new()
        },
        "stage": format!("{:?}", v.stage),
        "startup_timing": v.timing.map(|tm| json!({
            "connect_start_ms": tm.connect_start_ms,
            "first_headers_ms": tm.first_headers_ms,
            "metadata_ready_ms": tm.metadata_ready_ms,
            "first_segment_started_ms": tm.first_segment_started_ms,
            "first_byte_ms": tm.first_byte_ms,
            "all_segments_active_ms": tm.all_segments_active_ms,
            "init_duration_ms": tm.init_duration_ms,
            "request_to_first_byte_ms": tm.request_to_first_byte_ms,
            "total_startup_ms": tm.total_startup_ms,
        })),
        "eta_secs": v.eta_secs,
        "eta_fmt": v.eta_secs.map(fmt_duration).unwrap_or_default(),
        "active_connections": v.active_connections,
        "connections": v.connections,
        "seeders": v.seeders,
        "resumable": v.resumable,
        "parts_total": v.parts_total,
        "parts_done": v.parts_done,
        "segments": segs,
        "queue": v.queue,
        "queue_name": queue_name,
        "finished_at": v.finished_at.map(|d| d.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string()),
        "description": v.description,
        "group": v.group,
        "checksum": v.checksum,
        "speed_limit_kb": v.speed_limit_kb,
        "on_complete": v.on_complete.index(),
        "added_at": v.added_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string(),
        "added_ts": v.added_at.timestamp(),
        "last_try": v.last_try.map(|d| d.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string()),
        "referer": v.referer(),
        "parent_page": v.parent_page,
        "queue_pos": v.queue_pos,
        "waiting": v.waiting,
        "step": step_json,
        "source_key": v.source_key,
    })
}

fn settings_to_dto(s: &Settings) -> Value {
    let logins: Vec<Value> = s
        .logins
        .iter()
        .map(|l| {
            json!({
                "site": l.site,
                "user": l.user,
                "has_password": !l.password.is_empty(),
                "password": "",
            })
        })
        .collect();
    let cats: Vec<Value> = s
        .categories
        .iter()
        .map(|c| {
            json!({
                "name": c.name,
                "exts": c.exts,
                "sites": c.sites,
                "builtin": c.builtin,
                "dir": s.category_dirs.get(&c.name).map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
            })
        })
        .collect();
    let cat_dirs: HashMap<String, String> = s
        .category_dirs
        .iter()
        .map(|(k, v)| (k.clone(), v.to_string_lossy().into_owned()))
        .collect();
    json!({
        "download_dir": s.download_dir.to_string_lossy(),
        "category_folders": s.category_folders,
        "connections": s.connections,
        "max_active": s.max_active,
        "speed_limit_kb": s.speed_limit_kb,
        "speed_limit_on": s.speed_limit_on,
        "limit_only_active": s.limit_only_active,
        "retries": s.retries,
        "user_agent": s.user_agent,
        "clipboard_monitor": s.clipboard_monitor,
        "auto_start_clipboard": s.auto_start_clipboard,
        "show_complete_dialog": s.show_complete_dialog,
        "complete_each_in_group": s.complete_each_in_group,
        "ask_before_remove": s.ask_before_remove,
        "remove_deletes_files": s.remove_deletes_files,
        "mp3_kbps": s.mp3_kbps,
        "subtitles": s.subtitles,
        "subtitle_langs": s.subtitle_langs,
        "browser_port": s.browser_port,
        "min_split_kb": s.min_split_kb,
        "show_progress_window": s.show_progress_window,
        "progress_mode": s.progress_mode,
        "show_start_dialog": s.show_start_dialog,
        "start_while_info": s.start_while_info,
        "duplicate_action": s.duplicate_action,
        "set_file_date": s.set_file_date,
        "theme": s.theme,
        "opacity": s.opacity,
        "font_scale": s.font_scale,
        "font_family": s.font_family,
        "background_image": s.background_image,
        "background_strength": s.background_strength,
        "torrent_seed_minutes": s.torrent_seed_minutes,
        "torrent_upload_kb": s.torrent_upload_kb,
        "torrent_seed_ratio": s.torrent_seed_ratio,
        "torrent_main": s.torrent_main,
        "hide_categories": s.hide_categories,
        "sort_by": s.sort_by,
        "sort_desc": s.sort_desc,
        "close_to_tray": s.close_to_tray,
        "autostart": autostart::is_enabled(),
        "double_click": s.double_click,
        "limiter_on_startup": s.limiter_on_startup,
        "capture_exts": s.capture_exts,
        "skip_sites": s.skip_sites,
        "skip_addresses": s.skip_addresses,
        "skip_key": s.skip_key,
        "force_key": s.force_key,
        "panel_enabled": s.panel_enabled,
        "panel_skip_sites": s.panel_skip_sites,
        "panel_min_video_kb": s.panel_min_video_kb,
        "panel_min_audio_kb": s.panel_min_audio_kb,
        "temp_dir": s.temp_dir.as_ref().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
        "virus_scan": s.virus_scan,
        "virus_program": s.virus_program,
        "virus_args": s.virus_args,
        "connection_type": s.connection_type,
        "server_limits": s.server_limits,
        "quota_on": s.quota_on,
        "quota_mb": s.quota_mb,
        "quota_hours": s.quota_hours,
        "quota_warn": s.quota_warn,
        "proxy_mode": s.proxy_mode,
        "proxy_host": s.proxy_host,
        "proxy_port": s.proxy_port,
        "proxy_user": s.proxy_user,
        "proxy_password_set": !s.proxy_password.is_empty(),
        "proxy_bypass": s.proxy_bypass,
        "logins": logins,
        "sounds_on": s.sounds_on,
        "sound_complete": s.sound_complete,
        "sound_failed": s.sound_failed,
        "sound_queue_start": s.sound_queue_start,
        "sound_queue_done": s.sound_queue_done,
        "columns": s.columns,
        "column_order": s.column_order,
        "column_widths": s.column_widths,
        "all_columns": ALL_COLUMNS,
        "toolbar_small": s.toolbar_small,
        "force_shutdown": s.force_shutdown,
        "language": i18n::effective(&s.language),
        "raw_language": s.language,
        "categories": cats,
        "category_dirs": cat_dirs,
        "auto_check_updates": s.auto_check_updates,
        "update_url": s.update_url,
    })
}

fn build_state_json(st: &Arc<WebUiState>) -> Value {
    let s = st.mgr.settings();
    let views = st.mgr.snapshot();
    let downloads: Vec<Value> = {
        let mut rates = st.seg_rates.lock_ok();
        let active_ids: std::collections::HashSet<u64> = views
            .iter()
            .filter(|v| v.status != Status::Completed)
            .map(|v| v.id)
            .collect();
        rates.retain(|(id, _), _| active_ids.contains(id));
        views
            .iter()
            .map(|v| serialize_download_with_rates(v, &s, Some(&mut rates)))
            .collect()
    };
    let queues: Vec<Value> = s
        .queues
        .iter()
        .map(|q| {
            let count = views.iter().filter(|v| v.queue == Some(q.id) && v.status != Status::Completed).count();
            json!({
                "id": q.id,
                "name": q.name,
                "max_parallel": q.max_parallel,
                "folder": q.folder.as_ref().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
                "retries": q.retries,
                "after_done": q.after_done.index(),
                "open_when_done": q.open_when_done,
                "schedule": q.schedule,
                "running": st.mgr.queue_running(q.id),
                "count": count,
            })
        })
        .collect();

    let events: Vec<Value> = st.pending_events.lock_ok().drain(..).collect();
    let power = st.power_countdown.lock_ok().as_ref().map(|(a, secs)| {
        json!({ "action": a.index(), "seconds": secs })
    });
    let free_bytes = system::free_space(&s.download_dir);
    let update_available = {
        let upd = st.update_state.lock_ok();
        if upd.available {
            upd.latest_version.as_ref().map(|v| {
                json!({
                    "version": v,
                    "downloading": upd.downloading,
                    "progress": upd.progress,
                    "downloaded_bytes": upd.downloaded_bytes,
                    "setup_bytes": upd.setup_bytes,
                    "error": upd.error,
                })
            })
        } else {
            None
        }
    };

    json!({
        "version": env!("CARGO_PKG_VERSION"),
        "downloads": downloads,
        "settings": settings_to_dto(&s),
        "queues": queues,
        "when_all_done": st.mgr.when_all_done().index(),
        "speed_limit_on": s.speed_limit_on,
        "finishing": st.mgr.finishing(),
        "quota_used_bytes": st.mgr.quota_used(),
        "quota_used_fmt": fmt_size(st.mgr.quota_used()),
        "power_countdown": power,
        "disk_free_bytes": free_bytes,
        "disk_free_fmt": free_bytes.map(fmt_size).unwrap_or_default(),
        "tools_ready": {
            "ytdlp": tools::bundled("yt-dlp").is_some(),
            "ffmpeg": tools::bundled("ffmpeg").is_some(),
        },
        "update_available": update_available,
        "events": events,
    })
}

fn handle_window(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        action: String,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    match body.action.as_str() {
        "minimize" => st.send_window(WindowCmd::Minimize),
        "maximize" => st.send_window(WindowCmd::MaximizeToggle),
        "close" => {
            if st.mgr.settings().close_to_tray {
                st.send_window(WindowCmd::Hide);
            } else {
                st.send_window(WindowCmd::Quit);
            }
        }
        "hide" => st.send_window(WindowCmd::Hide),
        "show" => st.send_window(WindowCmd::Show),
        "drag" => st.send_window(WindowCmd::Drag),
        "quit" => st.send_window(WindowCmd::Quit),
        _ => {}
    }
    Ok(json!({"ok": true}))
}

fn handle_probe(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        url: String,
        #[serde(default)]
        user: Option<String>,
        #[serde(default)]
        password: Option<String>,
        #[serde(default)]
        referer: Option<String>,
        #[serde(default)]
        cookies: Option<String>,
        #[serde(default)]
        user_agent: Option<String>,
        #[serde(default)]
        audio_url: Option<String>,
        #[serde(default)]
        source_page: Option<String>,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let url = body.url.trim().to_string();
    if url.is_empty() {
        return Err(bad(t("Paste the address first.")));
    }
    let s = st.mgr.settings();
    if torrent::is_magnet(&url) {
        return Ok(json!({
            "kind": "magnet",
            "final_url": url,
            "file_name": torrent::magnet_name(&url).unwrap_or_else(|| "Magnet link".into()),
            "category": "General",
            "resumable": true,
            "video_options": [],
            "duplicate_id": st.mgr.find_url(&url),
        }));
    }

    let headers = RequestHeaders {
        referer: body.referer.as_deref().filter(|r| !r.is_empty()).map(str::to_string),
        cookies: body.cookies.filter(|c| !c.is_empty()),
        user_agent: body.user_agent.filter(|u| !u.is_empty()),
        auth: match (body.user, body.password) {
            (Some(u), Some(p)) if !u.trim().is_empty() => Some((u, p)),
            _ => None,
        },
        ..Default::default()
    };

    let duplicate_id = st.mgr.find_url(&url);
    let mgr = st.mgr.clone();
    let audio_probe_url = body.audio_url.clone().filter(|a| is_download_address(a));
    let (probe_res, audio_size) = st.rt.block_on(async {
        match &audio_probe_url {
            Some(a) => {
                let (v, au) = tokio::join!(mgr.probe(&url, &headers), mgr.probe(a, &headers));
                (v, au.ok().and_then(|ap| ap.total_size))
            }
            None => (mgr.probe(&url, &headers).await, None),
        }
    });

    match probe_res {
        Ok(p) => {
            let page_hint = body
                .source_page
                .as_deref()
                .filter(|u| is_download_address(u))
                .or_else(|| body.referer.as_deref().filter(|u| is_download_address(u)));
            let is_unnamed_stream = body.audio_url.is_none()
                && (p.file_name.to_ascii_lowercase().starts_with("videoplayback")
                    || url.contains("googlevideo.com/videoplayback"))
                && page_hint.is_some();

            if p.is_web_page() || is_unnamed_stream {
                let target_page = if p.is_web_page() { url.as_str() } else { page_hint.unwrap_or(url.as_str()) };
                if let Ok(yt) = ytdlp::resolve_for(target_page, ytdlp::remembered_cookies(target_page).as_deref(), None) {
                    if !yt.options.is_empty() {
                        let vdir = s.dir_for("Video").to_string_lossy().into_owned();
                        return Ok(json!({
                            "kind": "video_page",
                            "site": yt.site,
                            "title": yt.title,
                            "final_url": target_page,
                            "source_page": target_page,
                            "file_name": format!("{}.mp4", swiftget_engine::filename::sanitize(&yt.title)),
                            "category": "Video",
                            "suggested_dir": vdir,
                            "resumable": true,
                            "video_options": yt.options,
                            "duplicate_id": duplicate_id,
                        }));
                    }
                }
            }
            let cat = if audio_probe_url.is_some() {
                "Video".to_string()
            } else {
                s.category_of(&p.file_name, &p.final_url)
            };
            let dir = s.dir_for(&cat).to_string_lossy().into_owned();
            let kind_str = if looks_like_torrent(&p.final_url, Some(&p.file_name)) {
                "torrent"
            } else if p.is_web_page() {
                "webpage"
            } else {
                "file"
            };
            let combined_size = match (p.total_size, audio_size) {
                (Some(v), Some(a)) => Some(v.saturating_add(a)),
                (v, _) => v,
            };
            Ok(json!({
                "kind": kind_str,
                "download_kind": match p.kind {
                    DownloadKind::Hls => "hls",
                    _ => "http",
                },
                "final_url": p.final_url,
                "file_name": p.file_name,
                "total_size": combined_size,
                "total_size_fmt": combined_size.map(fmt_size),
                "has_audio": audio_probe_url.is_some(),
                "resumable": p.resumable,
                "content_type": p.content_type,
                "etag": p.etag,
                "category": cat,
                "suggested_dir": dir,
                "digest": p.digest,
                "video_options": [],
                "duplicate_id": duplicate_id,
            }))
        }
        Err(e) => {
            // Try yt-dlp directly when plain HTTP probe fails on social/video pages
            if is_download_address(&url) {
                if let Ok(yt) = ytdlp::resolve_for(&url, ytdlp::remembered_cookies(&url).as_deref(), None) {
                    if !yt.options.is_empty() {
                        return Ok(json!({
                            "kind": "video_page",
                            "site": yt.site,
                            "title": yt.title,
                            "final_url": url,
                            "file_name": format!("{}.mp4", swiftget_engine::filename::sanitize(&yt.title)),
                            "category": "Video",
                            "resumable": true,
                            "video_options": yt.options,
                            "duplicate_id": duplicate_id,
                        }));
                    }
                }
            }
            Err(bad(err_text(&format!("{e:#}"))))
        }
    }
}

fn handle_add(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        url: String,
        #[serde(default)]
        file_name: Option<String>,
        #[serde(default)]
        save_dir: Option<String>,
        #[serde(default)]
        category: Option<String>,
        #[serde(default)]
        remember_path: bool,
        #[serde(default)]
        connections: Option<u32>,
        #[serde(default)]
        queue: Option<u64>,
        #[serde(default)]
        description: Option<String>,
        #[serde(default)]
        checksum: Option<String>,
        #[serde(default)]
        auth_user: Option<String>,
        #[serde(default)]
        auth_password: Option<String>,
        #[serde(default)]
        referer: Option<String>,
        #[serde(default)]
        cookies: Option<String>,
        #[serde(default)]
        user_agent: Option<String>,
        #[serde(default)]
        post: Option<String>,
        #[serde(default)]
        post_type: Option<String>,
        #[serde(default)]
        audio_url: Option<String>,
        #[serde(default)]
        source_page: Option<String>,
        #[serde(default)]
        source_key: Option<String>,
        #[serde(default)]
        pick_quality: Option<String>,
        #[serde(default)]
        probe_final_url: Option<String>,
        #[serde(default)]
        probe_file_name: Option<String>,
        #[serde(default)]
        probe_total_size: Option<u64>,
        #[serde(default)]
        probe_resumable: Option<bool>,
        #[serde(default)]
        probe_content_type: Option<String>,
        #[serde(default)]
        probe_etag: Option<String>,
        #[serde(default)]
        probe_kind: Option<String>,
        #[serde(default)]
        start_now: bool,
        #[serde(default)]
        duplicate_policy: Option<u32>, // 0 ask/add, 1 number, 2 replace, 3 show
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let url = body.url.trim().to_string();
    if url.is_empty() || (!is_download_address(&url) && !torrent::is_torrent_source(&url)) {
        return Err(bad(t("Please enter a valid download URL (http://, https://, ftp://, or magnet).")));
    }

    if body.remember_path {
        if let (Some(cat), Some(dir)) = (&body.category, &body.save_dir) {
            if !cat.trim().is_empty() && !dir.trim().is_empty() {
                let mut s = st.mgr.settings();
                s.category_dirs.insert(cat.clone(), PathBuf::from(dir.trim()));
                let _ = st.mgr.set_settings(s);
            }
        }
    }

    // Handle duplicate URL if present
    let s = st.mgr.settings();
    let dup_action = body.duplicate_policy.unwrap_or(s.duplicate_action);
    if let Some(existing) = st.mgr.find_url(&url) {
        if dup_action == 2 {
            // replace existing
            st.mgr.remove(existing, false);
        } else if dup_action == 3 {
            // show/focus existing
            if let Some(v) = st.mgr.get(existing) {
                return Ok(json!({ "duplicate": true, "existing": existing, "download": serialize_download(&v, &s) }));
            }
        }
    }

    let headers = RequestHeaders {
        referer: body.referer.filter(|r| !r.is_empty()),
        cookies: body.cookies.filter(|c| !c.is_empty()),
        user_agent: body.user_agent.filter(|u| !u.is_empty()),
        post: body.post.filter(|p| !p.is_empty()),
        post_type: body.post_type.filter(|p| !p.is_empty()),
        auth: match (body.auth_user, body.auth_password) {
            (Some(u), p) if !u.trim().is_empty() => Some((u, p.unwrap_or_default())),
            _ => None,
        },
        ..Default::default()
    };

    let save_dir = body
        .save_dir
        .filter(|d| !d.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| body.category.as_deref().map(|c| s.dir_for(c)));

    let pick_quality = body.pick_quality.filter(|q| !q.is_empty());
    let audio_url = body.audio_url.filter(|a| !a.is_empty());
    let checksum = body.checksum.filter(|c| !c.trim().is_empty());
    let file_name = body.file_name.filter(|f| !f.trim().is_empty());
    let probe = if pick_quality.is_none()
        && audio_url.is_none()
        && (body.probe_resumable.is_some() || body.probe_total_size.is_some())
    {
        Some(ProbeResult {
            final_url: body.probe_final_url.clone().filter(|u| !u.is_empty()).unwrap_or_else(|| url.clone()),
            file_name: file_name
                .clone()
                .or_else(|| body.probe_file_name.clone().filter(|f| !f.trim().is_empty()))
                .unwrap_or_else(|| "download".into()),
            total_size: body.probe_total_size,
            resumable: body.probe_resumable.unwrap_or(false),
            content_type: body.probe_content_type.clone(),
            kind: match body.probe_kind.as_deref() {
                Some("hls") => DownloadKind::Hls,
                _ => DownloadKind::Http,
            },
            last_modified: None,
            etag: body.probe_etag.clone(),
            headers_used: None,
            digest: checksum.clone(),
        })
    } else {
        None
    };

    let id = st.mgr.add(NewDownload {
        url,
        file_name,
        save_dir,
        headers,
        connections: body.connections,
        probe,
        audio_url,
        source_page: body.source_page.filter(|p| !p.is_empty()),
        source_key: body.source_key.filter(|k| !k.is_empty()),
        queue: body.queue,
        description: body.description.filter(|d| !d.trim().is_empty()),
        checksum,
        pick_quality,
        start: body.start_now,
        ..Default::default()
    });
    let view = st.mgr.get(id).map(|v| serialize_download(&v, &s));
    Ok(json!({ "ok": true, "id": id, "download": view }))
}

fn handle_batch_preview(req: &mut Request) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        pattern: String,
        letters: bool,
        from: String,
        to: String,
        size: usize,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let links = expand_pattern(&body.pattern, body.letters, &body.from, &body.to, body.size.clamp(1, 10)).map_err(bad)?;
    Ok(json!({ "links": links, "count": links.len() }))
}

fn handle_batch(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        mode: String, // "links" | "pattern"
        #[serde(default)]
        links_text: String,
        #[serde(default)]
        pattern: String,
        #[serde(default)]
        letters: bool,
        #[serde(default)]
        from: String,
        #[serde(default)]
        to: String,
        #[serde(default)]
        size: usize,
        #[serde(default)]
        save_dir: String,
        #[serde(default)]
        queue: Option<u64>,
        #[serde(default)]
        start_now: bool,
        #[serde(default)]
        user: String,
        #[serde(default)]
        password: String,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let urls = if body.mode == "pattern" {
        expand_pattern(&body.pattern, body.letters, &body.from, &body.to, body.size.clamp(1, 10)).map_err(bad)?
    } else {
        extract_links(&body.links_text)
    };
    if urls.is_empty() {
        return Err(bad(t("No valid download addresses were found.")));
    }
    let dir = if body.save_dir.trim().is_empty() {
        None
    } else {
        Some(PathBuf::from(body.save_dir.trim()))
    };
    let auth = (!body.user.trim().is_empty()).then(|| (body.user.clone(), body.password.clone()));
    let group = Some(st.mgr.new_group());
    let mut ids = Vec::with_capacity(urls.len());
    for url in urls {
        let mut headers = RequestHeaders::default();
        headers.auth = auth.clone();
        let id = st.mgr.add(NewDownload {
            url,
            save_dir: dir.clone(),
            headers,
            queue: body.queue,
            group,
            start: body.start_now,
            ..Default::default()
        });
        ids.push(id);
    }
    Ok(json!({ "ok": true, "ids": ids, "count": ids.len() }))
}

fn handle_action(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        action: String,
        #[serde(default)]
        ids: Vec<u64>,
        #[serde(default)]
        delete_file: bool,
        #[serde(default)]
        url: Option<String>,
        #[serde(default)]
        save_dir: Option<String>,
        #[serde(default)]
        file_name: Option<String>,
        #[serde(default)]
        description: Option<String>,
        #[serde(default)]
        referer: Option<String>,
        #[serde(default)]
        checksum: Option<String>,
        #[serde(default)]
        user: Option<String>,
        #[serde(default)]
        password: Option<String>,
        #[serde(default)]
        queue: Option<u64>,
        #[serde(default)]
        speed_limit_kb: Option<u64>,
        #[serde(default)]
        connections: Option<u32>,
        #[serde(default)]
        when_done: Option<i32>,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let first_id = body.ids.first().copied();
    match body.action.as_str() {
        "resume" => {
            for id in body.ids {
                st.mgr.start(id);
            }
        }
        "pause" => {
            for id in body.ids {
                st.mgr.pause(id);
            }
        }
        "restart" => {
            for id in body.ids {
                st.mgr.restart(id);
            }
        }
        "resume_all" => st.mgr.start_all(),
        "stop_all" => st.mgr.pause_all(),
        "delete" => {
            if body.delete_file {
                for id in body.ids {
                    st.mgr.remove(id, true);
                }
            } else {
                st.mgr.remove_many(&body.ids);
            }
        }
        "delete_completed" => st.mgr.remove_completed(),
        "toggle_limiter" => {
            let mut s = st.mgr.settings();
            s.speed_limit_on = !s.speed_limit_on;
            let on = s.speed_limit_on;
            let _ = st.mgr.set_settings(s);
            if let Some(cb) = st.limiter_sync_cb.lock_ok().as_ref() {
                cb(on);
            }
        }
        "set_when_all_done" => {
            let a = AfterDone::from_index(body.when_done.unwrap_or(0));
            st.mgr.set_when_all_done(a);
        }
        "set_on_complete" => {
            let a = AfterDone::from_index(body.when_done.unwrap_or(0));
            for id in body.ids {
                st.mgr.set_on_complete(id, a);
            }
        }
        "set_limit" => {
            let kb = body.speed_limit_kb.filter(|&k| k > 0);
            for id in body.ids {
                st.mgr.set_download_limit(id, kb);
            }
        }
        "set_connections" => {
            if let Some(c) = body.connections {
                for id in body.ids {
                    st.mgr.set_download_connections(id, c);
                }
            }
        }
        "set_queue" => {
            for id in body.ids {
                st.mgr.set_queue(id, body.queue);
            }
        }
        "refresh_url" => {
            if let (Some(&id), Some(url)) = (body.ids.first(), body.url.as_deref()) {
                if !is_download_address(url) {
                    return Err(bad(t("Enter a valid download URL.")));
                }
                st.mgr.set_url(id, url.trim(), None);
                st.mgr.start(id);
            }
        }
        "move_rename" => {
            if let Some(&id) = body.ids.first() {
                let dir = PathBuf::from(body.save_dir.as_deref().unwrap_or("").trim());
                let name = body.file_name.as_deref().unwrap_or("").trim();
                if dir.as_os_str().is_empty() || name.is_empty() {
                    return Err(bad(t("Folder and file name cannot be empty.")));
                }
                let auth = body.user.map(|u| (u, body.password.unwrap_or_default()));
                st.mgr.retarget(id, &dir, name, body.description, auth).map_err(|e| bad(format!("{e:#}")))?;
            }
        }
        "update_properties" => {
            if let Some(&id) = body.ids.first() {
                if let (Some(dir), Some(name)) = (&body.save_dir, &body.file_name) {
                    if !dir.trim().is_empty() && !name.trim().is_empty() {
                        let auth = body.user.as_ref().map(|u| (u.clone(), body.password.clone().unwrap_or_default()));
                        let _ = st.mgr.retarget(id, Path::new(dir.trim()), name.trim(), body.description.clone(), auth.clone());
                    }
                }
                let edit = DetailsEdit {
                    url: body.url,
                    referer: body.referer,
                    description: body.description,
                    auth: body.user.map(|u| (u, body.password.unwrap_or_default())),
                    checksum: body.checksum,
                };
                st.mgr.update_details(id, edit).map_err(|e| bad(format!("{e:#}")))?;
            }
        }
        "open" => {
            if let Some(v) = body.ids.first().and_then(|id| st.mgr.get(*id)) {
                if v.save_path.exists() {
                    open::that_detached(&v.save_path).map_err(|e| bad(format!("{e:#}")))?;
                } else {
                    return Err(bad(t("File was not found on disk.")));
                }
            }
        }
        "open_with" => {
            if let Some(v) = body.ids.first().and_then(|id| st.mgr.get(*id)) {
                if v.save_path.exists() {
                    open_with_dialog(&v.save_path);
                } else {
                    return Err(bad(t("File was not found on disk.")));
                }
            }
        }
        "open_folder" => {
            if let Some(v) = body.ids.first().and_then(|id| st.mgr.get(*id)) {
                open_folder_select(&v.save_path);
            }
        }
        "preview" => {
            if let Some(id) = body.ids.first().copied() {
                let Some(v) = st.mgr.get(id) else { return Err(bad("not found")); };
                match st.mgr.preview_source(id) {
                    Some(PreviewSource::File { path, .. }) => {
                        preview::play(&path, &v.file_name).map_err(|e| bad(format!("{e}")))?;
                    }
                    Some(PreviewSource::Pair { video, video_ready, audio, audio_ready }) => {
                        let st2 = st.clone();
                        preview::play_pair(video, video_ready, audio.map(|a| (a, audio_ready)), &v.file_name, move |err| {
                            if let Some(e) = err {
                                st2.push_event(json!({ "type": "toast", "level": "error", "message": e }));
                            }
                        });
                    }
                    None => {
                        return Err(bad(t("No downloaded part is ready to play yet. Wait a second and try again.")));
                    }
                }
            }
        }
        "verify_sha256" => {
            if let Some(id) = body.ids.first().copied() {
                let Some(v) = st.mgr.get(id) else { return Err(bad("not found")); };
                if !v.save_path.exists() {
                    return Err(bad(t("File was not found on disk.")));
                }
                let actual = sha256_file(&v.save_path).map_err(|e| bad(format!("{e:#}")))?;
                let expected = v.checksum.as_deref().and_then(|c| c.strip_prefix("sha256:").or(Some(c)));
                let matched = expected.map(|e| e.eq_ignore_ascii_case(&actual));
                return Ok(json!({ "ok": true, "sha256": actual, "expected": expected, "matched": matched }));
            }
        }
        other => return Err(bad(format!("unknown action: {other}"))),
    }
    let s = st.mgr.settings();
    let download = first_id.and_then(|id| st.mgr.get(id)).map(|v| serialize_download(&v, &s));
    Ok(json!({ "ok": true, "download": download }))
}

// ----------------- Site Grabber -----------------
fn grabber_state_json(st: &Arc<WebUiState>) -> Value {
    let g = st.grab.lock_ok();
    let asking = g.asking.load(Ordering::Relaxed);
    let items: Vec<Value> = g
        .items
        .iter()
        .enumerate()
        .map(|(i, it)| {
            json!({
                "index": i,
                "checked": it.checked,
                "url": it.url,
                "name": it.name,
                "ext": it.ext,
                "kind": it.kind,
                "text": it.text,
                "page": it.page,
                "is_page": it.is_page,
                "size": it.size,
                "size_fmt": it.size.map(fmt_size).unwrap_or_default(),
                "gone": it.gone,
            })
        })
        .collect();
    json!({
        "running": g.running,
        "finished": g.finished,
        "pages_done": g.pages_done,
        "pages_queued": g.pages_queued,
        "current_url": g.current_url,
        "checking": asking,
        "items": items,
    })
}

fn handle_grabber_start(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        #[serde(default)]
        url: String,
        #[serde(default)]
        depth: u32,
        #[serde(default)]
        same_site: bool,
        #[serde(default)]
        no_parent: bool,
        #[serde(default)]
        links: Option<Vec<crate::api::PageLink>>,
        #[serde(default)]
        referer: Option<String>,
        #[serde(default)]
        cookies: Option<String>,
        #[serde(default)]
        user_agent: Option<String>,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    {
        let mut g = st.grab.lock_ok();
        if let Some(c) = g.cancel.take() {
            c.cancel();
        }
        if let Some(c) = g.asking_cancel.take() {
            c.cancel();
        }
        g.items.clear();
        g.pages_done = 0;
        g.pages_queued = 0;
        g.current_url.clear();
        g.finished = false;
        g.running = false;
    }

    let headers = RequestHeaders {
        referer: body.referer,
        cookies: body.cookies,
        user_agent: body.user_agent,
        ..Default::default()
    };

    // Browser "Download all links" mode
    if let Some(page_links) = body.links {
        let mut items = Vec::new();
        let mut to_check = Vec::new();
        for l in page_links {
            let name = swiftget_engine::filename::from_url(&l.url).unwrap_or_else(|| "download".into());
            let ext = swiftget_engine::filename::extension(&name);
            let is_page = grabber::is_page_ext(&ext);
            if !is_page || grabber::looks_like_download(&l.url, &l.text) {
                to_check.push(l.url.clone());
            }
            items.push(GrabItem {
                checked: !is_page,
                url: l.url,
                kind: if is_page { "text" } else { kind_for(&name) },
                ext: ext.to_uppercase(),
                name,
                text: l.text.trim().chars().take(200).collect(),
                page: body.url.clone(),
                is_page,
                size: None,
                gone: None,
            });
        }
        {
            let mut g = st.grab.lock_ok();
            g.items = items;
            g.finished = true;
        }
        spawn_grab_check(st, to_check, headers);
        return Ok(grabber_state_json(st));
    }

    let url = body.url.trim().to_string();
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(bad(t("Enter a valid web page address (https://…).")));
    }

    let cancel = CancellationToken::new();
    let progress = Arc::new(GrabProgress::default());
    {
        let mut g = st.grab.lock_ok();
        g.running = true;
        g.cancel = Some(cancel.clone());
    }

    let opts = GrabOptions {
        start_url: url,
        depth: body.depth.min(5),
        other_sites: !body.same_site,
        no_parent: body.no_parent,
        exts: Vec::new(),
        include: Vec::new(),
        exclude: Vec::new(),
        max_pages: 400,
        parallel: 4,
        headers: headers.clone(),
        user_agent: st.mgr.settings().user_agent.clone(),
    };

    let client = st.mgr.client();
    let grab_arc = st.grab.clone();
    let p_clone = progress.clone();
    let c_clone = cancel.clone();
    let st_for_check = st.clone();

    st.rt.spawn(async move {
        let found = grabber::crawl(client, opts, p_clone.clone(), c_clone.clone(), {
            let grab_arc = grab_arc.clone();
            let p_inner = p_clone.clone();
            move |f: FoundFile| {
                let mut g = grab_arc.lock_ok();
                g.pages_done = p_inner.pages_done.load(Ordering::Relaxed);
                g.pages_queued = p_inner.pages_queued.load(Ordering::Relaxed);
                g.current_url = p_inner.current.lock().map(|c| c.clone()).unwrap_or_default();
                let is_page = grabber::is_page_ext(&f.ext);
                g.items.push(GrabItem {
                    checked: !is_page,
                    url: f.url,
                    kind: if is_page { "text" } else { kind_for(&f.name) },
                    ext: f.ext.to_uppercase(),
                    name: f.name,
                    text: f.text.trim().chars().take(200).collect(),
                    page: f.page,
                    is_page,
                    size: None,
                    gone: None,
                });
            }
        })
        .await;

        let check_urls: Vec<String> = found.into_iter().map(|f| f.url).collect();
        {
            let mut g = grab_arc.lock_ok();
            g.pages_done = p_clone.pages_done.load(Ordering::Relaxed);
            g.pages_queued = p_clone.pages_queued.load(Ordering::Relaxed);
            g.running = false;
            g.finished = true;
        }
        if !cancel.is_cancelled() && !check_urls.is_empty() {
            spawn_grab_check(&st_for_check, check_urls, headers);
        }
    });

    Ok(json!({"ok": true}))
}

fn spawn_grab_check(st: &Arc<WebUiState>, links: Vec<String>, headers: RequestHeaders) {
    if links.is_empty() {
        return;
    }
    let c = CancellationToken::new();
    let asking = {
        let mut g = st.grab.lock_ok();
        if let Some(old) = g.asking_cancel.take() {
            old.cancel();
        }
        g.asking_cancel = Some(c.clone());
        g.asking.store(links.len(), Ordering::Relaxed);
        g.asking.clone()
    };
    let client = st.mgr.client();
    let ua = st.mgr.settings().user_agent.clone();
    let grab_arc = st.grab.clone();
    st.rt.spawn(async move {
        let all = Arc::new(tokio::sync::Semaphore::new(6));
        let mut jobs = tokio::task::JoinSet::new();
        for url in links {
            let (all, client, headers, ua, grab_arc, asking, c) = (
                all.clone(),
                client.clone(),
                headers.clone(),
                ua.clone(),
                grab_arc.clone(),
                asking.clone(),
                c.clone(),
            );
            jobs.spawn(async move {
                let _b = all.acquire_owned().await;
                if !c.is_cancelled() {
                    let ans = grabber::check_link(&client, &url, &headers, &ua).await;
                    if !c.is_cancelled() {
                        let mut g = grab_arc.lock_ok();
                        for it in &mut g.items {
                            if it.url == url {
                                match &ans {
                                    Checked::File { name, size } => {
                                        if !name.is_empty() && name != "download" {
                                            it.name = name.clone();
                                            it.ext = swiftget_engine::filename::extension(name).to_uppercase();
                                            it.kind = kind_for(name);
                                        }
                                        it.is_page = false;
                                        it.size = *size;
                                    }
                                    Checked::Page => {
                                        it.is_page = true;
                                        it.kind = "text";
                                        it.checked = false;
                                    }
                                    Checked::Gone(why) => {
                                        it.gone = Some(why.clone());
                                        it.checked = false;
                                    }
                                }
                            }
                        }
                    }
                }
                asking.fetch_sub(1, Ordering::Relaxed);
            });
        }
        while jobs.join_next().await.is_some() {}
    });
}

fn handle_grabber_stop(st: &Arc<WebUiState>) -> ApiRes {
    let mut g = st.grab.lock_ok();
    if let Some(c) = g.cancel.take() {
        c.cancel();
    }
    if let Some(c) = g.asking_cancel.take() {
        c.cancel();
    }
    g.running = false;
    g.asking.store(0, Ordering::Relaxed);
    Ok(json!({"ok": true}))
}

fn handle_grabber_download(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct ItemPick {
        url: String,
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        description: Option<String>,
    }
    #[derive(Deserialize)]
    struct Req {
        items: Vec<ItemPick>,
        save_dir: String,
        #[serde(default)]
        queue: Option<u64>,
        #[serde(default)]
        start_now: bool,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    if body.items.is_empty() {
        return Err(bad(t("Check the files you want first.")));
    }
    let dir = if body.save_dir.trim().is_empty() {
        None
    } else {
        Some(PathBuf::from(body.save_dir.trim()))
    };
    let group = Some(st.mgr.new_group());
    let mut ids = Vec::new();
    for it in body.items {
        let id = st.mgr.add(NewDownload {
            url: it.url,
            file_name: it.name.filter(|n| !n.trim().is_empty()),
            save_dir: dir.clone(),
            queue: body.queue,
            description: it.description.filter(|d| !d.trim().is_empty()),
            group,
            start: body.start_now,
            ..Default::default()
        });
        ids.push(id);
    }
    Ok(json!({ "ok": true, "ids": ids, "count": ids.len() }))
}

// ----------------- Playlist Downloader -----------------
fn handle_playlist_fetch(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        url: String,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let url = body.url.trim().to_string();
    if !is_download_address(&url) {
        return Err(bad(t("Paste the playlist address (https://…/playlist?list=…)")));
    }
    let s = st.mgr.settings();
    let lang = i18n::effective(&s.language).to_string();
    let base = s.dir_for("Video");
    let p = ytdlp::playlist(&url, &lang).map_err(|e| bad(err_text(&format!("{e:#}"))))?;
    let folder = base.join(swiftget_engine::filename::sanitize(&p.title));
    let entries: Vec<Value> = p
        .entries
        .iter()
        .enumerate()
        .map(|(i, e)| {
            json!({
                "index": i + 1,
                "title": e.title,
                "url": e.url,
                "duration": e.duration,
                "duration_fmt": fmt_duration(e.duration),
            })
        })
        .collect();
    Ok(json!({
        "title": p.title,
        "folder": folder.to_string_lossy(),
        "entries": entries,
    }))
}

fn handle_playlist_download(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct EntryPick {
        index: usize,
        title: String,
        url: String,
    }
    #[derive(Deserialize)]
    struct Req {
        playlist_title: String,
        folder: String,
        quality: String, // best, 2160, 1440, 1080, 720, 480, 360, 240, 144, audio, mp3
        parallel: u32,
        numbered: bool,
        subtitles: bool,
        start_now: bool,
        entries: Vec<EntryPick>,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    if body.entries.is_empty() {
        return Err(bad(t("Check the videos you want first")));
    }
    let folder = PathBuf::from(body.folder.trim());
    if folder.as_os_str().is_empty() {
        return Err(bad(t("Choose where to save the videos")));
    }
    let _ = std::fs::create_dir_all(&folder);
    let ext = match body.quality.as_str() {
        "audio" => "m4a",
        "mp3" => "mp3",
        _ => "mp4",
    };
    let name = if body.playlist_title.trim().is_empty() {
        "Playlist".to_string()
    } else {
        body.playlist_title.trim().chars().take(60).collect()
    };
    let queue = st
        .mgr
        .add_queue(&name, body.parallel.clamp(1, 3), Some(folder.clone()))
        .map_err(|e| bad(format!("{e:#}")))?;
    if let Some(mut def) = st.mgr.settings().queue(queue).cloned() {
        def.retries = 3;
        let _ = st.mgr.update_queue(def);
    }
    {
        let mut s = st.mgr.settings();
        if s.subtitles != body.subtitles {
            s.subtitles = body.subtitles;
            if s.subtitles && s.subtitle_langs.trim().is_empty() {
                s.subtitle_langs = "ar en".into();
            }
            let _ = st.mgr.set_settings(s);
        }
    }
    let width = body.entries.len().to_string().len().max(2);
    let group = Some(st.mgr.new_group());
    let mut ids = Vec::new();
    for e in &body.entries {
        let mut stem = swiftget_engine::filename::sanitize(&e.title);
        if body.numbered {
            stem = format!("{:0width$} - {stem}", e.index);
        }
        let id = st.mgr.add(NewDownload {
            url: e.url.clone(),
            file_name: Some(format!("{stem}.{ext}")),
            save_dir: Some(folder.clone()),
            source_page: Some(e.url.clone()),
            pick_quality: Some(body.quality.clone()),
            queue: Some(queue),
            description: Some(body.playlist_title.clone()).filter(|t| !t.trim().is_empty()),
            group,
            start: false,
            ..Default::default()
        });
        ids.push(id);
    }
    if body.start_now {
        st.mgr.start_queue(queue);
    }
    Ok(json!({ "ok": true, "queue_id": queue, "ids": ids }))
}

// ----------------- Download a Part of a Video (Clipper) -----------------
fn handle_clip_fetch(req: &mut Request, _st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        url: String,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let url = body.url.trim().to_string();
    if !is_download_address(&url) {
        return Err(bad(t("Paste the address of the video (https://…).")));
    }
    let info = ytdlp::resolve_for(&url, ytdlp::remembered_cookies(&url).as_deref(), None)
        .map_err(|e| bad(err_text(&format!("{e:#}"))))?;
    let options: Vec<YtOption> = info.options.into_iter().filter(|o| is_download_address(&o.video_url)).collect();
    if options.is_empty() {
        return Err(bad(t("No video was found at this address.")));
    }
    let duration = options.iter().map(|o| o.duration).max().unwrap_or(0);
    Ok(json!({ "title": info.title, "site": info.site, "duration": duration, "options": options }))
}

fn clip_preview_json(st: &Arc<WebUiState>) -> Value {
    match &*st.clip_preview_state.lock_ok() {
        Some((done, err)) => json!({ "done": done, "error": err }),
        None => json!({ "done": false, "error": null }),
    }
}

fn handle_clip_preview(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        video_url: String,
        #[serde(default)]
        audio_url: Option<String>,
        #[serde(default)]
        headers: Vec<(String, String)>,
        #[serde(default)]
        key: String,
        start: f64,
        end: f64,
        exact: bool,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let c = Clip::new(body.start, body.end, body.exact)
        .ok_or_else(|| bad(t("The part must be at least half a second long.")))?;
    let c = Clip { end: c.end.min(c.start + 60.0), ..c };
    let mut headers = RequestHeaders::default();
    ytdlp::apply_headers(&mut headers, &body.headers);
    let src = ClipSource { url: body.video_url, audio_url: body.audio_url, headers, hls: false };
    let sound_only = body.key.starts_with("audio|");

    *st.clip_preview_state.lock_ok() = Some((false, None));
    let cps = st.clip_preview_state.clone();
    let token = st.mgr.preview_part(src, c, sound_only, move |r| match r {
        Ok(file) => {
            let _ = open::that_detached(&file);
            *cps.lock_ok() = Some((true, None));
        }
        Err(e) => {
            *cps.lock_ok() = Some((true, Some(err_text(&e))));
        }
    });
    if let Some(old) = st.preview_cancel.lock_ok().replace(token) {
        old.cancel();
    }
    Ok(json!({ "ok": true }))
}

fn handle_clip_download(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        title: String,
        page_url: String,
        video_url: String,
        #[serde(default)]
        audio_url: Option<String>,
        #[serde(default)]
        headers: Vec<(String, String)>,
        ext: String,
        key: String,
        start: f64,
        end: f64,
        exact: bool,
        #[serde(default)]
        save_dir: Option<String>,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let c = Clip::new(body.start, body.end, body.exact)
        .ok_or_else(|| bad(t("The part must be at least half a second long.")))?;
    let mut headers = RequestHeaders::default();
    ytdlp::apply_headers(&mut headers, &body.headers);
    let id = st.mgr.add(NewDownload {
        url: body.video_url,
        file_name: Some(part_name(&body.title, &body.ext, &body.key)),
        save_dir: body.save_dir.filter(|d| !d.trim().is_empty()).map(PathBuf::from),
        headers,
        audio_url: body.audio_url,
        source_page: Some(body.page_url),
        source_key: Some(body.key),
        clip: Some(c),
        start: true,
        ..Default::default()
    });
    let s = st.mgr.settings();
    let download = st.mgr.get(id).map(|v| serialize_download(&v, &s));
    Ok(json!({ "ok": true, "id": id, "download": download }))
}

// ----------------- BitTorrent & Magnet -----------------
fn magnet_inspect_json(st: &Arc<WebUiState>) -> Value {
    match &*st.magnet.lock_ok() {
        Some(m) => serde_json::to_value(m).unwrap_or(json!({})),
        None => json!({ "done": false }),
    }
}

fn parse_torrent_to_json(src: &str, settings: &Settings) -> anyhow::Result<Value> {
    let bytes = std::fs::read(src)?;
    let info = torrent::parse_torrent(&bytes)?;
    let files: Vec<Value> = info
        .files
        .iter()
        .map(|f| {
            json!({
                "index": f.index,
                "path": f.path,
                "size": f.size,
                "size_fmt": fmt_size(f.size),
                "kind": kind_for(&f.path),
                "checked": true,
            })
        })
        .collect();
    let suggested = if let Some(big) = info.files.iter().max_by_key(|f| f.size) {
        settings.dir_for(&settings.category_of(&big.path, "")).to_string_lossy().into_owned()
    } else {
        settings.dir_for("General").to_string_lossy().into_owned()
    };
    Ok(json!({
        "done": true,
        "ok": true,
        "source": src,
        "name": info.name,
        "total_size": info.total,
        "total_size_fmt": fmt_size(info.total),
        "suggested_folder": suggested,
        "files": files,
    }))
}

fn handle_torrent_inspect(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        source: String,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let src = body.source.trim().trim_matches('"').to_string();
    let settings = st.mgr.settings();
    if torrent::is_magnet(&src) {
        let name = torrent::magnet_name(&src).unwrap_or_else(|| t("Magnet link"));
        let folder = settings.dir_for("General").to_string_lossy().into_owned();
        let req_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(1);
        *st.magnet.lock_ok() = Some(MagnetInspectState {
            id: req_id,
            uri: src.clone(),
            done: false,
            ok: false,
            error: None,
            name: name.clone(),
            total_size: 0,
            suggested_folder: folder.clone(),
            files: Vec::new(),
        });
        let mag_arc = st.magnet.clone();
        let mgr_ref = st.mgr.clone();
        st.mgr.magnet_files(src.clone(), move |r| {
            let s = mgr_ref.settings();
            let mut m = mag_arc.lock_ok();
            if m.as_ref().map(|x| x.id) != Some(req_id) {
                return;
            }
            match r {
                Ok(file) => {
                    if let Ok(parsed) = parse_torrent_to_json(&file.to_string_lossy(), &s) {
                        *m = Some(MagnetInspectState {
                            id: req_id,
                            uri: file.to_string_lossy().into_owned(),
                            done: true,
                            ok: true,
                            error: None,
                            name: parsed["name"].as_str().unwrap_or("").into(),
                            total_size: parsed["total_size"].as_u64().unwrap_or(0),
                            suggested_folder: parsed["suggested_folder"].as_str().unwrap_or("").into(),
                            files: parsed["files"].as_array().cloned().unwrap_or_default(),
                        });
                    }
                }
                Err(e) => {
                    if let Some(st) = m.as_mut() {
                        st.done = true;
                        st.ok = false;
                        st.error = Some(e);
                    }
                }
            }
        });
        return Ok(json!({ "done": false, "is_magnet": true, "name": name, "suggested_folder": folder }));
    }

    if src.is_empty() || !src.to_ascii_lowercase().ends_with(".torrent") {
        return Err(bad(t("This is not a magnet link or a .torrent file")));
    }
    parse_torrent_to_json(&src, &settings).map_err(|e| bad(format!("{e:#}")))
}

fn handle_torrent_add(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        source: String,
        save_dir: String,
        #[serde(default)]
        select: Option<String>,
        start_now: bool,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let src = body.source.trim().trim_matches('"').to_string();
    if !torrent::is_torrent_source(&src) {
        return Err(bad(t("This is not a magnet link or a .torrent file")));
    }
    let dir = body.save_dir.trim();
    if dir.is_empty() {
        return Err(bad(t("Choose where to save it")));
    }
    let id = st.mgr.add(NewDownload {
        url: src,
        save_dir: Some(PathBuf::from(dir)),
        start: body.start_now,
        torrent_select: body.select.filter(|s| !s.trim().is_empty()),
        ..Default::default()
    });
    let s = st.mgr.settings();
    let download = st.mgr.get(id).map(|v| serialize_download(&v, &s));
    Ok(json!({ "ok": true, "id": id, "download": download }))
}

fn torrent_live_json(mgr: &Manager, id: u64) -> Value {
    let first_last = mgr.torrent_first_last(id);
    let magnet_link = mgr.magnet_link(id);
    if let Some(live) = mgr.torrent_live(id) {
        let files: Vec<Value> = live
            .files
            .iter()
            .map(|f| {
                let pct = if f.size > 0 { ((f.done as f64 / f.size as f64) * 100.0).min(100.0) } else { 0.0 };
                json!({
                    "index": f.index,
                    "path": f.path.to_string_lossy(),
                    "size": f.size,
                    "size_fmt": fmt_size(f.size),
                    "done": f.done,
                    "done_fmt": fmt_size(f.done),
                    "progress": pct,
                    "selected": f.selected,
                })
            })
            .collect();
        let peers: Vec<Value> = live
            .peers
            .iter()
            .map(|p| {
                json!({
                    "address": p.address,
                    "down": p.down,
                    "down_fmt": format!("{}/s", fmt_size(p.down)),
                    "up": p.up,
                    "up_fmt": format!("{}/s", fmt_size(p.up)),
                    "have": p.have * 100.0,
                    "seeder": p.seeder,
                })
            })
            .collect();
        let pieces: Vec<Value> = live
            .pieces
            .iter()
            .map(|(from, to, here)| json!({ "from": from, "to": to, "here": here }))
            .collect();
        json!({
            "active": true,
            "files": files,
            "peers": peers,
            "trackers": live.trackers,
            "pieces": pieces,
            "uploaded": live.uploaded,
            "uploaded_fmt": fmt_size(live.uploaded),
            "first_last": first_last,
            "magnet_link": magnet_link,
        })
    } else {
        json!({
            "active": false,
            "files": [],
            "peers": [],
            "trackers": [],
            "pieces": [],
            "uploaded": 0,
            "first_last": first_last,
            "magnet_link": magnet_link,
        })
    }
}

fn handle_torrent_live_action(req: &mut Request, st: &Arc<WebUiState>, id: u64) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        action: String,
        #[serde(default)]
        select: Option<String>,
        #[serde(default)]
        tracker: Option<String>,
        #[serde(default)]
        first_last: Option<bool>,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    match body.action.as_str() {
        "set_files" => st.mgr.set_torrent_files(id, body.select),
        "add_tracker" => {
            if let Some(tr) = body.tracker {
                if !st.mgr.add_torrent_tracker(id, &tr) {
                    return Err(bad(t("This tracker address does not look valid (udp://, http:// or https://).")));
                }
            }
        }
        "set_first_last" => st.mgr.set_torrent_first_last(id, body.first_last.unwrap_or(false)),
        "recheck" => st.mgr.recheck_torrent(id),
        _ => return Err(bad("unknown torrent action")),
    }
    Ok(json!({ "ok": true }))
}

// ----------------- Queues & Scheduler -----------------
fn queue_files_json(mgr: &Manager, qid: u64) -> Value {
    let files: Vec<Value> = mgr
        .queue_files(qid)
        .iter()
        .map(|v| {
            json!({
                "id": v.id,
                "file_name": v.file_name,
                "total_size_fmt": v.total_size.map(fmt_size).unwrap_or_default(),
                "progress": v.progress() * 100.0,
                "status": format!("{:?}", v.status),
            })
        })
        .collect();
    json!({ "files": files, "running": mgr.queue_running(qid) })
}

fn handle_queue_add(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        name: String,
        #[serde(default = "one_u32")]
        max_parallel: u32,
        #[serde(default)]
        folder: Option<String>,
    }
    fn one_u32() -> u32 { 1 }
    let body: Req = read_json_body(req).map_err(bad)?;
    let folder = body.folder.filter(|f| !f.trim().is_empty()).map(PathBuf::from);
    let id = st.mgr.add_queue(body.name.trim(), body.max_parallel.clamp(1, 32), folder).map_err(|e| bad(format!("{e:#}")))?;
    Ok(json!({ "ok": true, "id": id }))
}

fn handle_queue_update(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        id: u64,
        name: String,
        max_parallel: u32,
        #[serde(default)]
        folder: String,
        retries: u32,
        after_done: i32,
        open_when_done: bool,
        schedule: QueueSchedule,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    if body.name.trim().is_empty() {
        return Err(bad(t("Give the queue a name")));
    }
    let def = QueueDef {
        id: body.id,
        name: body.name.trim().to_string(),
        max_parallel: body.max_parallel.clamp(1, 32),
        folder: if body.folder.trim().is_empty() { None } else { Some(PathBuf::from(body.folder.trim())) },
        retries: body.retries.min(50),
        after_done: AfterDone::from_index(body.after_done),
        open_when_done: body.open_when_done,
        schedule: body.schedule,
    };
    st.mgr.update_queue(def).map_err(|e| bad(format!("{e:#}")))?;
    Ok(json!({ "ok": true }))
}

fn handle_queue_delete(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        id: u64,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    st.mgr.delete_queue(body.id).map_err(|e| bad(format!("{e:#}")))?;
    Ok(json!({ "ok": true }))
}

fn handle_queue_start_stop(req: &mut Request, st: &Arc<WebUiState>, start: bool) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        id: u64,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    if start {
        st.mgr.start_queue(body.id);
    } else {
        st.mgr.stop_queue(body.id);
    }
    Ok(json!({ "ok": true }))
}

fn handle_queue_move_file(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        id: u64,
        delta: i32,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    st.mgr.move_in_queue(body.id, body.delta);
    Ok(json!({ "ok": true }))
}

// ----------------- Categories -----------------
fn handle_category_save(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        #[serde(default)]
        old_name: Option<String>,
        name: String,
        exts: String,
        #[serde(default)]
        sites: String,
        #[serde(default)]
        dir: String,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let name = body.name.trim().to_string();
    if name.is_empty() || name.eq_ignore_ascii_case("General") {
        return Err(bad(t("Enter a valid category name.")));
    }
    let exts: Vec<String> = body
        .exts
        .split(|c: char| c.is_whitespace() || c == ',' || c == ';')
        .map(|x| x.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|x| !x.is_empty())
        .collect();
    let sites: Vec<String> = body
        .sites
        .split(|c: char| c.is_whitespace() || c == ',' || c == ';')
        .map(|x| x.trim().to_ascii_lowercase())
        .filter(|x| !x.is_empty())
        .collect();
    let mut s = st.mgr.settings();
    if let Some(old) = &body.old_name {
        if let Some(c) = s.categories.iter_mut().find(|c| c.name == *old) {
            if !c.builtin {
                c.name = name.clone();
            }
            c.exts = exts;
            c.sites = sites;
        }
    } else {
        if s.categories.iter().any(|c| c.name.eq_ignore_ascii_case(&name)) {
            return Err(bad(t("A category with that name already exists.")));
        }
        s.categories.push(CategoryDef { name: name.clone(), exts, sites, builtin: false });
    }
    if body.dir.trim().is_empty() {
        s.category_dirs.remove(&name);
    } else {
        s.category_dirs.insert(name, PathBuf::from(body.dir.trim()));
    }
    st.mgr.set_settings(s).map_err(|e| bad(format!("{e:#}")))?;
    st.mgr.recategorize();
    Ok(json!({ "ok": true }))
}

fn handle_category_delete(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        name: String,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let mut s = st.mgr.settings();
    if s.categories.iter().any(|c| c.name == body.name && c.builtin) {
        return Err(bad(t("Built-in categories cannot be deleted.")));
    }
    s.categories.retain(|c| c.name != body.name);
    s.category_dirs.remove(&body.name);
    st.mgr.set_settings(s).map_err(|e| bad(format!("{e:#}")))?;
    st.mgr.recategorize();
    Ok(json!({ "ok": true }))
}

// ----------------- Settings -----------------
fn handle_settings(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    let val: Value = read_json_body(req).map_err(bad)?;
    let mut s = st.mgr.settings();
    let old_torrent_main = s.torrent_main;

    macro_rules! set_str {
        ($field:ident, $k:expr) => {
            if let Some(v) = val.get($k).and_then(|x| x.as_str()) {
                s.$field = v.to_string();
            }
        };
    }
    macro_rules! set_bool {
        ($field:ident, $k:expr) => {
            if let Some(v) = val.get($k).and_then(|x| x.as_bool()) {
                s.$field = v;
            }
        };
    }
    macro_rules! set_u32 {
        ($field:ident, $k:expr) => {
            if let Some(v) = val.get($k).and_then(|x| x.as_u64()) {
                s.$field = v as u32;
            }
        };
    }
    macro_rules! set_u64 {
        ($field:ident, $k:expr) => {
            if let Some(v) = val.get($k).and_then(|x| x.as_u64()) {
                s.$field = v;
            }
        };
    }

    if let Some(v) = val.get("download_dir").and_then(|x| x.as_str()) {
        if !v.trim().is_empty() {
            s.download_dir = PathBuf::from(v.trim());
        }
    }
    if let Some(v) = val.get("temp_dir").and_then(|x| x.as_str()) {
        s.temp_dir = if v.trim().is_empty() { None } else { Some(PathBuf::from(v.trim())) };
    }
    set_bool!(category_folders, "category_folders");
    set_u32!(connections, "connections");
    set_u32!(max_active, "max_active");
    set_u64!(speed_limit_kb, "speed_limit_kb");
    set_bool!(speed_limit_on, "speed_limit_on");
    set_bool!(limit_only_active, "limit_only_active");
    set_u32!(retries, "retries");
    set_str!(user_agent, "user_agent");
    set_bool!(clipboard_monitor, "clipboard_monitor");
    set_bool!(auto_start_clipboard, "auto_start_clipboard");
    set_bool!(show_complete_dialog, "show_complete_dialog");
    set_bool!(complete_each_in_group, "complete_each_in_group");
    set_bool!(ask_before_remove, "ask_before_remove");
    set_bool!(remove_deletes_files, "remove_deletes_files");
    set_u32!(mp3_kbps, "mp3_kbps");
    set_bool!(subtitles, "subtitles");
    set_str!(subtitle_langs, "subtitle_langs");
    set_u64!(min_split_kb, "min_split_kb");
    set_bool!(show_progress_window, "show_progress_window");
    set_u32!(progress_mode, "progress_mode");
    set_bool!(show_start_dialog, "show_start_dialog");
    set_bool!(start_while_info, "start_while_info");
    set_u32!(duplicate_action, "duplicate_action");
    set_bool!(set_file_date, "set_file_date");
    set_u32!(theme, "theme");
    set_u32!(opacity, "opacity");
    set_u32!(font_scale, "font_scale");
    set_str!(font_family, "font_family");
    set_str!(background_image, "background_image");
    set_u32!(background_strength, "background_strength");
    set_u32!(torrent_seed_minutes, "torrent_seed_minutes");
    set_u64!(torrent_upload_kb, "torrent_upload_kb");
    if let Some(v) = val.get("torrent_seed_ratio").and_then(|x| x.as_f64()) {
        s.torrent_seed_ratio = v as f32;
    }
    set_bool!(torrent_main, "torrent_main");
    set_bool!(hide_categories, "hide_categories");
    set_str!(sort_by, "sort_by");
    set_bool!(sort_desc, "sort_desc");
    set_bool!(close_to_tray, "close_to_tray");
    set_u32!(double_click, "double_click");
    set_bool!(limiter_on_startup, "limiter_on_startup");
    set_str!(capture_exts, "capture_exts");
    set_str!(skip_sites, "skip_sites");
    set_str!(skip_key, "skip_key");
    set_str!(force_key, "force_key");
    set_bool!(panel_enabled, "panel_enabled");
    set_str!(panel_skip_sites, "panel_skip_sites");
    set_u64!(panel_min_video_kb, "panel_min_video_kb");
    set_u64!(panel_min_audio_kb, "panel_min_audio_kb");
    set_bool!(virus_scan, "virus_scan");
    set_str!(virus_program, "virus_program");
    set_str!(virus_args, "virus_args");
    set_u32!(connection_type, "connection_type");
    set_bool!(quota_on, "quota_on");
    set_u64!(quota_mb, "quota_mb");
    set_u32!(quota_hours, "quota_hours");
    set_bool!(quota_warn, "quota_warn");
    set_u32!(proxy_mode, "proxy_mode");
    set_str!(proxy_host, "proxy_host");
    if let Some(v) = val.get("proxy_port").and_then(|x| x.as_u64()) {
        s.proxy_port = v as u16;
    }
    set_str!(proxy_user, "proxy_user");
    if let Some(v) = val.get("proxy_password").and_then(|x| x.as_str()) {
        if !v.is_empty() {
            s.proxy_password = v.to_string();
        } else if val.get("clear_proxy_password").and_then(|x| x.as_bool()).unwrap_or(false) {
            s.proxy_password.clear();
        }
    }
    set_str!(proxy_bypass, "proxy_bypass");
    set_bool!(sounds_on, "sounds_on");
    set_str!(sound_complete, "sound_complete");
    set_str!(sound_failed, "sound_failed");
    set_str!(sound_queue_start, "sound_queue_start");
    set_str!(sound_queue_done, "sound_queue_done");
    set_bool!(toolbar_small, "toolbar_small");
    set_bool!(force_shutdown, "force_shutdown");
    set_str!(language, "language");
    set_bool!(auto_check_updates, "auto_check_updates");
    set_str!(update_url, "update_url");

    if let Some(arr) = val.get("skip_addresses").and_then(|x| x.as_array()) {
        s.skip_addresses = arr.iter().filter_map(|x| x.as_str().map(str::to_string)).collect();
    }
    if let Some(arr) = val.get("server_limits") {
        if let Ok(parsed) = serde_json::from_value::<Vec<ServerLimit>>(arr.clone()) {
            s.server_limits = parsed;
        }
    }
    if let Some(arr) = val.get("logins").and_then(|x| x.as_array()) {
        let old = s.logins.clone();
        let mut next = Vec::new();
        for item in arr {
            let site = item.get("site").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
            let user = item.get("user").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
            let pass_in = item.get("password").and_then(|x| x.as_str()).unwrap_or("");
            if site.is_empty() {
                continue;
            }
            let password = if !pass_in.is_empty() {
                pass_in.to_string()
            } else {
                old.iter().find(|l| l.site == site && l.user == user).map(|l| l.password.clone()).unwrap_or_default()
            };
            next.push(SiteLogin { site, user, password });
        }
        s.logins = next;
    }
    if let Some(arr) = val.get("columns").and_then(|x| x.as_array()) {
        s.columns = arr.iter().filter_map(|x| x.as_str().map(str::to_string)).collect();
    }
    if let Some(arr) = val.get("column_order").and_then(|x| x.as_array()) {
        s.column_order = arr.iter().filter_map(|x| x.as_str().map(str::to_string)).collect();
    }
    if let Some(autostart_val) = val.get("autostart").and_then(|x| x.as_bool()) {
        autostart::set(autostart_val);
        s.autostart_set = true;
    }

    let eff_lang = i18n::effective(&s.language);
    i18n::apply(eff_lang);
    let new_torrent_main = s.torrent_main;
    let speed_limit_on = s.speed_limit_on;
    st.mgr.set_settings(s).map_err(|e| bad(format!("{e:#}")))?;

    if new_torrent_main != old_torrent_main {
        assoc::torrents(new_torrent_main);
    }
    if let Some(cb) = st.limiter_sync_cb.lock_ok().as_ref() {
        cb(speed_limit_on);
    }
    Ok(json!({ "ok": true }))
}

// ----------------- Native File / Folder Pickers & Import/Export -----------------
fn handle_pick_folder(req: &mut Request) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        #[serde(default)]
        initial: Option<String>,
    }
    let body: Req = read_json_body(req).unwrap_or(Req { initial: None });
    let mut dlg = rfd::FileDialog::new();
    if let Some(dir) = body.initial.filter(|d| !d.trim().is_empty()) {
        dlg = dlg.set_directory(dir);
    }
    let picked = dlg.pick_folder().map(|p| p.to_string_lossy().into_owned());
    Ok(json!({ "path": picked }))
}

fn handle_pick_file(req: &mut Request) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        #[serde(default)]
        filter_name: Option<String>,
        #[serde(default)]
        extensions: Vec<String>,
    }
    let body: Req = read_json_body(req).unwrap_or(Req { filter_name: None, extensions: Vec::new() });
    let mut dlg = rfd::FileDialog::new();
    if !body.extensions.is_empty() {
        let refs: Vec<&str> = body.extensions.iter().map(|s| s.as_str()).collect();
        dlg = dlg.add_filter(body.filter_name.as_deref().unwrap_or("Files"), &refs);
    }
    let picked = dlg.pick_file().map(|p| p.to_string_lossy().into_owned());
    Ok(json!({ "path": picked }))
}

fn handle_import(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        kind: String, // "ef2" | "txt"
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let ef2 = body.kind == "ef2";
    let Some(path) = rfd::FileDialog::new()
        .add_filter(if ef2 { "Download list" } else { "Text file" }, &[if ef2 { "ef2" } else { "txt" }])
        .pick_file()
    else {
        return Ok(json!({ "cancelled": true }));
    };
    let text = std::fs::read_to_string(&path).map_err(|e| bad(format!("{e}")))?;
    let items = ef2::parse(&text);
    if items.is_empty() {
        return Err(bad(t("No download addresses were found in this file.")));
    }
    let count = items.len();
    for item in items {
        st.mgr.add(NewDownload {
            url: item.url,
            file_name: item.file_name,
            description: item.description,
            headers: RequestHeaders {
                referer: item.referer,
                cookies: item.cookies,
                user_agent: item.user_agent,
                ..Default::default()
            },
            start: false,
            ..Default::default()
        });
    }
    Ok(json!({ "ok": true, "count": count }))
}

fn handle_export(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        kind: String, // "ef2" | "txt"
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let ef2 = body.kind == "ef2";
    let Some(path) = rfd::FileDialog::new()
        .set_file_name(if ef2 { "dodo-dm1-list.ef2" } else { "dodo-dm1-links.txt" })
        .add_filter(if ef2 { "Download list" } else { "Text file" }, &[if ef2 { "ef2" } else { "txt" }])
        .save_file()
    else {
        return Ok(json!({ "cancelled": true }));
    };
    let text = if ef2 {
        let items: Vec<Ef2Item> = st
            .mgr
            .snapshot()
            .into_iter()
            .map(|v| Ef2Item {
                url: v.parent_page.clone().filter(|_| v.kind == DownloadKind::Dash).unwrap_or(v.url.clone()),
                referer: v.headers.referer.clone(),
                cookies: v.headers.cookies.clone(),
                user_agent: v.headers.user_agent.clone(),
                file_name: Some(v.file_name),
                description: v.description,
            })
            .collect();
        ef2::write(&items)
    } else {
        st.mgr.all_urls().join("\r\n")
    };
    std::fs::write(&path, text).map_err(|e| bad(format!("{e}")))?;
    Ok(json!({ "ok": true, "path": path.to_string_lossy() }))
}

// ----------------- Browser Integration -----------------
fn browsers_json() -> Value {
    let list = browser::detect();
    let items: Vec<Value> = list
        .iter()
        .enumerate()
        .map(|(i, b)| {
            json!({
                "index": i,
                "name": b.name,
                "installed": b.exe.is_some(),
                "extensions_page": b.extensions_page,
                "firefox": b.firefox,
                "color": b.color,
            })
        })
        .collect();
    let ext_dir = browser::extension_dir(false).map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    json!({
        "browsers": items,
        "extension_folder": ext_dir,
        "link_report": browser::link_report(),
    })
}

fn handle_browsers_action(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        action: String,
        #[serde(default)]
        index: usize,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    match body.action.as_str() {
        "add" => {
            let list = browser::detect();
            let Some(b) = list.get(body.index) else { return Err(bad("browser not found")); };
            let Some(exe) = &b.exe else {
                return Err(bad(tf("{} is not installed on this computer.", &[&b.name])));
            };
            if b.firefox {
                if let Some(xpi) = browser::firefox_xpi() {
                    let _ = std::process::Command::new(exe).arg(&xpi).spawn();
                    return Ok(json!({
                        "ok": true,
                        "folder": xpi.to_string_lossy(),
                        "steps": t("Firefox opened the DODO DM1 add-on.\n1. Click \"Add\" in the message Firefox shows.\n2. Then click \"OK\"."),
                    }));
                } else {
                    let proxy = swiftget_engine::http::ProxyConfig::from_settings(&st.mgr.settings());
                    let xpi = st.rt.block_on(browser::fetch_firefox_xpi(proxy)).map_err(|e| bad(err_text(&format!("{e:#}"))))?;
                    let _ = std::process::Command::new(exe).arg(&xpi).spawn();
                    return Ok(json!({
                        "ok": true,
                        "folder": xpi.to_string_lossy(),
                        "steps": t("Firefox opened the DODO DM1 add-on.\n1. Click \"Add\" in the message Firefox shows.\n2. Then click \"OK\"."),
                    }));
                }
            }
            let Some(dir) = browser::extension_dir(false) else {
                return Err(bad(t("The extension folder was not found next to DodoDM1.exe.")));
            };
            let path = dir.to_string_lossy().into_owned();
            if let Ok(mut c) = arboard::Clipboard::new() {
                let _ = c.set_text(path.clone());
            }
            let _ = std::process::Command::new(exe).arg(b.extensions_page).spawn();
            return Ok(json!({
                "ok": true,
                "folder": path,
                "steps": tf("{} opened its extensions page.\n1. Turn on \"Developer mode\".\n2. Click \"Load unpacked\".\n3. Paste the folder path (Ctrl+V – already copied) and click \"Select folder\".", &[&b.name]),
            }));
        }
        "open_folder" => {
            if let Some(dir) = browser::extension_dir(false) {
                let _ = open::that_detached(&dir);
            }
            Ok(json!({ "ok": true }))
        }
        "repair" => {
            let ok = browser::repair_extension();
            let msg = if ok {
                t("The add-in's files were put back. It starts again by itself within a minute (or click Reload on it in the browser's extensions page).")
            } else {
                t("Some files of the add-in could not be written. Close the browser and click \"Repair the add-in\" again.")
            };
            Ok(json!({ "ok": ok, "message": msg }))
        }
        "reinstall_host" => {
            crate::nativehost::install(&default_data_dir());
            Ok(json!({ "ok": true, "link_report": browser::link_report() }))
        }
        "test_link" => Ok(json!({ "ok": true, "link_report": browser::link_report() })),
        _ => Err(bad("unknown browser action")),
    }
}

// ----------------- Updates, Pairing & Power -----------------
fn effective_update_source(s: &Settings) -> Option<(String, bool)> {
    let custom = s.update_url.trim();
    if !custom.is_empty() {
        return Some((custom.to_string(), false));
    }
    selfupdate::default_update_url().map(|u| (u, true))
}

fn update_state_json(st: &Arc<WebUiState>) -> Value {
    let mut u = st.update_state.lock_ok().clone();
    if u.source_url.is_empty() {
        if let Some((src, _)) = effective_update_source(&st.mgr.settings()) {
            u.configured = true;
            u.source_url = src;
        }
    }
    serde_json::to_value(u).unwrap_or(json!({}))
}

pub fn spawn_app_update_checker(st: Arc<WebUiState>) {
    st.rt.clone().spawn(async move {
        tokio::time::sleep(Duration::from_secs(3)).await;
        let mut last_notified = String::new();
        loop {
            let s = st.mgr.settings();
            if s.auto_check_updates {
                if let Some((src, req_sig)) = effective_update_source(&s) {
                    let client = st.mgr.client();
                    if let Ok(Some(rel)) = selfupdate::check_from(&client, &src, req_sig).await {
                        {
                            let mut u = st.update_state.lock_ok();
                            if !u.downloading {
                                u.checking = false;
                                u.done = true;
                                u.available = true;
                                u.configured = true;
                                u.source_url = src.clone();
                                u.latest_version = Some(rel.version.clone());
                                u.release_url = Some(rel.url.clone());
                                u.setup_sha256 = Some(rel.sha256.clone());
                                u.error = None;
                                u.message = tf("New version available: {}", &[&rel.version]);
                            }
                        }
                        if last_notified != rel.version {
                            last_notified = rel.version.clone();
                            st.push_event(json!({
                                "type": "update_available",
                                "version": rel.version,
                            }));
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_secs(6 * 3600)).await;
        }
    });
}

fn handle_update_check(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize, Default)]
    struct Req {
        #[serde(default)]
        update_url: Option<String>,
    }
    let body: Req = read_json_body(req).unwrap_or_default();
    if let Some(url) = body.update_url {
        let mut s = st.mgr.settings();
        let trimmed = url.trim().to_string();
        if s.update_url != trimmed {
            s.update_url = trimmed;
            let _ = st.mgr.set_settings(s);
        }
    }

    let s = st.mgr.settings();
    let src_opt = effective_update_source(&s);
    let (src, req_sig) = match src_opt {
        Some(pair) => pair,
        None => {
            let mut u = st.update_state.lock_ok();
            u.checking = false;
            u.downloading = false;
            u.done = true;
            u.available = false;
            u.configured = false;
            u.source_url.clear();
            u.latest_version = None;
            u.release_url = None;
            u.setup_sha256 = None;
            u.error = None;
            u.message = t("No update source URL configured yet. Enter your version.json link or folder below.");
            return Ok(json!({ "ok": true }));
        }
    };

    {
        let mut u = st.update_state.lock_ok();
        u.checking = true;
        u.done = false;
        u.available = false;
        u.configured = true;
        u.source_url = src.clone();
        u.latest_version = None;
        u.release_url = None;
        u.setup_sha256 = None;
        u.error = None;
        u.progress = -1.0;
        u.downloaded_bytes = 0;
        u.setup_bytes = None;
        u.message = t("Checking for updates…");
    }
    let client = st.mgr.client();
    let u_arc = st.update_state.clone();
    st.rt.spawn(async move {
        match selfupdate::check_from(&client, &src, req_sig).await {
            Ok(Some(rel)) => {
                let mut u = u_arc.lock_ok();
                u.checking = false;
                u.done = true;
                u.available = true;
                u.latest_version = Some(rel.version.clone());
                u.release_url = Some(rel.url.clone());
                u.setup_sha256 = Some(rel.sha256.clone());
                u.message = tf("New version available: {}", &[&rel.version]);
            }
            Ok(None) => {
                let mut u = u_arc.lock_ok();
                u.checking = false;
                u.done = true;
                u.available = false;
                u.message = tf("This is the newest version ({}).", &[&selfupdate::current()]);
            }
            Err(e) => {
                let mut u = u_arc.lock_ok();
                u.checking = false;
                u.done = true;
                u.available = false;
                let err_str = format!("{e:#}");
                u.error = Some(err_str.clone());
                u.message = tf("Could not check for updates: {}", &[&err_text(&err_str)]);
            }
        }
    });
    Ok(json!({ "ok": true }))
}

fn handle_update_install(st: &Arc<WebUiState>) -> ApiRes {
    {
        let mut u = st.update_state.lock_ok();
        if u.downloading {
            return Ok(json!({ "ok": true }));
        }
        u.downloading = true;
        u.error = None;
        u.progress = 0.0;
        u.downloaded_bytes = 0;
        u.message = t("Downloading update…");
    }
    let s = st.mgr.settings();
    let Some((src, req_sig)) = effective_update_source(&s) else {
        let mut u = st.update_state.lock_ok();
        u.downloading = false;
        u.error = Some(t("No update source URL configured yet."));
        u.message = t("No update source URL configured yet.");
        return Ok(json!({ "ok": false }));
    };

    let client = st.mgr.client();
    let u_arc = st.update_state.clone();
    let st2 = st.clone();
    st.rt.spawn(async move {
        let dir = default_data_dir().join("update");
        match selfupdate::check_from(&client, &src, req_sig).await {
            Ok(Some(rel)) => {
                let u_prog = u_arc.clone();
                let ver = rel.version.clone();
                let sha = rel.sha256.clone();
                let progress = move |done: u64, total: Option<u64>| {
                    let mut u = u_prog.lock_ok();
                    u.downloaded_bytes = done;
                    u.setup_bytes = total;
                    u.progress = match total {
                        Some(tot) if tot > 0 => ((done as f64 / tot as f64) * 100.0).clamp(0.0, 100.0) as f32,
                        _ => -1.0,
                    };
                    u.message = tf("Downloading version {}…", &[&ver]);
                };
                match selfupdate::download_with_progress(&client, &rel, &dir, &progress).await {
                    Ok(setup) => {
                        {
                            let mut u = u_arc.lock_ok();
                            u.progress = 100.0;
                            u.setup_path = Some(setup.to_string_lossy().into_owned());
                            u.message = tf("Installing version {}…", &[&rel.version]);
                        }
                        if let Err(e) = selfupdate::run_installer(&setup, &sha, true) {
                            let mut u = u_arc.lock_ok();
                            u.downloading = false;
                            let err_str = format!("{e:#}");
                            u.error = Some(err_str.clone());
                            u.message = tf("Could not start the update: {}", &[&err_text(&err_str)]);
                        } else {
                            st2.send_window(WindowCmd::Quit);
                        }
                    }
                    Err(e) => {
                        let mut u = u_arc.lock_ok();
                        u.downloading = false;
                        let err_str = format!("{e:#}");
                        u.error = Some(err_str.clone());
                        u.message = tf("Could not get the update: {}", &[&err_text(&err_str)]);
                    }
                }
            }
            Ok(None) => {
                let mut u = u_arc.lock_ok();
                u.downloading = false;
                u.available = false;
                u.message = tf("This is the newest version ({}).", &[&selfupdate::current()]);
            }
            Err(e) => {
                let mut u = u_arc.lock_ok();
                u.downloading = false;
                let err_str = format!("{e:#}");
                u.error = Some(err_str.clone());
                u.message = tf("Could not check for updates: {}", &[&err_text(&err_str)]);
            }
        }
    });
    Ok(json!({ "ok": true }))
}

fn handle_update_tools(st: &Arc<WebUiState>) -> ApiRes {
    let client = st.mgr.client();
    let st2 = st.clone();
    st.rt.spawn(async move {
        let r = tokio::task::spawn_blocking(ytdlp::update_now).await;
        tools::update_all(client, default_data_dir()).await;
        let msg = match r {
            Ok(Ok(m)) => format!("yt-dlp & ffmpeg: {m}"),
            Ok(Err(e)) => format!("{e:#}"),
            Err(e) => format!("{e}"),
        };
        st2.push_event(json!({ "type": "toast", "level": "info", "message": msg }));
    });
    Ok(json!({ "ok": true }))
}

fn handle_pair_respond(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        pair_id: u64,
        allow: bool,
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    if let Some(tx) = st.pair_channels.lock_ok().remove(&body.pair_id) {
        let _ = tx.send(body.allow);
    }
    Ok(json!({ "ok": true }))
}

fn handle_power(req: &mut Request, st: &Arc<WebUiState>) -> ApiRes {
    #[derive(Deserialize)]
    struct Req {
        action: String, // "cancel" | "now"
    }
    let body: Req = read_json_body(req).map_err(bad)?;
    let taken = st.power_countdown.lock_ok().take();
    if body.action == "now" {
        if let Some((act, _)) = taken {
            execute_power(st, act);
        }
    }
    Ok(json!({ "ok": true }))
}

fn execute_power(st: &Arc<WebUiState>, action: AfterDone) {
    if action == AfterDone::Exit {
        st.send_window(WindowCmd::Quit);
        return;
    }
    let force = st.mgr.settings().force_shutdown;
    st.mgr.shutdown();
    system::power(action, force);
    if action == AfterDone::Shutdown {
        st.send_window(WindowCmd::Quit);
    }
}

// ----------------- Events from API, Tray, Clipboard, Engine Tick -----------------
pub fn handle_api_event(st: &Arc<WebUiState>, event: ApiEvent) {
    match event {
        ApiEvent::Show => st.send_window(WindowCmd::Show),
        ApiEvent::Quit => {
            note("closed for the setup");
            st.send_window(WindowCmd::Quit);
        }
        ApiEvent::Pair(answer) => {
            let pid = st.next_pair_id.fetch_add(1, Ordering::Relaxed);
            st.pair_channels.lock_ok().insert(pid, answer);
            st.send_window(WindowCmd::Show);
            st.push_event(json!({ "type": "pair_ask", "pair_id": pid }));
        }
        ApiEvent::OldFirefoxAddon => {
            st.send_window(WindowCmd::Show);
            st.push_event(json!({ "type": "old_firefox_addon" }));
        }
        ApiEvent::OpenTorrent(s) => {
            st.send_window(WindowCmd::Show);
            st.push_event(json!({ "type": "open_torrent", "source": s }));
        }
        ApiEvent::Playlist(url) => {
            st.send_window(WindowCmd::Show);
            st.push_event(json!({ "type": "open_playlist", "url": url }));
        }
        ApiEvent::Links(l) => {
            st.send_window(WindowCmd::Show);
            let links: Vec<Value> = l.links.iter().map(|x| json!({ "url": x.url, "text": x.text })).collect();
            st.push_event(json!({
                "type": "open_grabber_links",
                "url": l.page,
                "links": links,
                "cookies": l.cookies,
                "user_agent": l.user_agent,
            }));
        }
        ApiEvent::Cli(ask) => {
            let dir = ask
                .folder
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(PathBuf::from);
            let url = ask.url.unwrap_or_default();
            if ask.quiet && !url.is_empty() {
                let _ = st.mgr.add(NewDownload {
                    url,
                    file_name: ask.name,
                    save_dir: dir,
                    queue: ask.later.then_some(MAIN_QUEUE),
                    start: !ask.later,
                    ..Default::default()
                });
            } else if !url.is_empty() {
                st.send_window(WindowCmd::Show);
                st.push_event(json!({
                    "type": "open_add",
                    "url": url,
                    "file_name": ask.name,
                    "save_dir": dir.map(|p| p.to_string_lossy().into_owned()),
                    "later": ask.later,
                }));
            }
            if ask.start_queue {
                st.mgr.start_queue(MAIN_QUEUE);
            }
        }
        ApiEvent::Add(req) => {
            let repeat = {
                let mut l = st.last_api_add.lock_ok();
                let now = Instant::now();
                let same = l.as_ref().map(|(u, at)| *u == req.url && now.duration_since(*at) < Duration::from_secs(10)).unwrap_or(false);
                *l = Some((req.url.clone(), now));
                same
            };
            if repeat {
                return;
            }
            let mut headers = RequestHeaders {
                referer: req.referrer.clone(),
                cookies: req.cookies.clone(),
                user_agent: req.user_agent.clone(),
                extra: Vec::new(),
                auth: None,
                post: req.post.clone().filter(|p| !p.is_empty() && p.len() <= 1 << 20),
                post_type: req.post_type.clone(),
            };
            if let Some(list) = &req.headers {
                ytdlp::apply_headers(&mut headers, list);
            }
            if torrent::is_magnet(&req.url) {
                st.send_window(WindowCmd::Show);
                st.push_event(json!({ "type": "open_torrent", "source": req.url }));
                return;
            }
            if looks_like_torrent(&req.url, req.file_name.as_deref()) {
                let st2 = st.clone();
                let mgr = st.mgr.clone();
                let url = req.url.clone();
                let file_name = req.file_name.clone();
                st.rt.spawn(async move {
                    match mgr.fetch_torrent_file(&url, &headers).await {
                        Ok(path) => {
                            st2.send_window(WindowCmd::Show);
                            st2.push_event(json!({ "type": "open_torrent", "source": path.to_string_lossy() }));
                        }
                        Err(_) => {
                            st2.send_window(WindowCmd::Show);
                            st2.push_event(json!({ "type": "open_add", "url": url, "file_name": file_name }));
                        }
                    }
                });
                return;
            }
            // Refused download relayed via browser
            let relayed_id = st
                .relayed
                .lock_ok()
                .get(&req.url)
                .filter(|(_, at, times)| *times == 1 && at.elapsed() < Duration::from_secs(300))
                .map(|(id, _, _)| *id);
            if let Some(id) = relayed_id.filter(|id| st.mgr.get(*id).is_some()) {
                st.mgr.set_url(id, &req.url, Some(headers));
                st.mgr.start(id);
                return;
            }
            // Clip request from extension panel
            if let Some(c) = req.clip.as_ref().and_then(|c| Clip::new(c.start, c.end, c.exact)) {
                let key = req.source_key.clone().unwrap_or_default();
                let name = req.file_name.clone().unwrap_or_else(|| "video.mp4".into());
                let (stem, ext) = swiftget_engine::filename::split_ext(&name);
                let id = st.mgr.add(NewDownload {
                    url: req.url,
                    file_name: Some(part_name(stem, &ext.to_ascii_lowercase(), &key)),
                    headers,
                    audio_url: req.audio_url,
                    source_page: req.source_page,
                    source_key: req.source_key,
                    clip: Some(c),
                    start: true,
                    ..Default::default()
                });
                let dl_view = st.mgr.get(id).map(|v| serialize_download(&v, &st.mgr.settings()));
                st.send_window(WindowCmd::Show);
                st.push_event(json!({ "type": "progress_focus", "id": id, "download": dl_view }));
                return;
            }
            let s = st.mgr.settings();
            if !s.show_start_dialog && st.mgr.find_url(&req.url).is_none() {
                let id = st.mgr.add(NewDownload {
                    url: req.url,
                    file_name: req.file_name,
                    headers,
                    audio_url: req.audio_url,
                    source_page: req.source_page,
                    source_key: req.source_key,
                    start: true,
                    ..Default::default()
                });
                if s.show_progress_window && s.progress_mode != 2 {
                    let dl_view = st.mgr.get(id).map(|v| serialize_download(&v, &s));
                    st.send_window(WindowCmd::Show);
                    st.push_event(json!({ "type": "progress_focus", "id": id, "download": dl_view }));
                }
            } else {
                st.send_window(WindowCmd::Show);
                st.push_event(json!({
                    "type": "open_add",
                    "url": req.url,
                    "file_name": req.file_name,
                    "referrer": req.referrer,
                    "cookies": req.cookies,
                    "user_agent": req.user_agent,
                    "post": req.post,
                    "post_type": req.post_type,
                    "audio_url": req.audio_url,
                    "source_page": req.source_page,
                    "source_key": req.source_key,
                }));
            }
        }
    }
}

pub fn handle_tray_action(st: &Arc<WebUiState>, action: TrayAction) {
    match action {
        TrayAction::Show => st.send_window(WindowCmd::Show),
        TrayAction::Toggle => st.send_window(WindowCmd::Toggle),
        TrayAction::AddUrl => {
            st.send_window(WindowCmd::Show);
            st.push_event(json!({ "type": "open_add", "url": "" }));
        }
        TrayAction::ResumeAll => st.mgr.start_all(),
        TrayAction::StopAll => st.mgr.pause_all(),
        TrayAction::ToggleLimiter => {
            let mut s = st.mgr.settings();
            s.speed_limit_on = !s.speed_limit_on;
            let on = s.speed_limit_on;
            let _ = st.mgr.set_settings(s);
            if let Some(cb) = st.limiter_sync_cb.lock_ok().as_ref() {
                cb(on);
            }
        }
        TrayAction::Scheduler => {
            st.send_window(WindowCmd::Show);
            st.push_event(json!({ "type": "open_scheduler" }));
        }
        TrayAction::Options => {
            st.send_window(WindowCmd::Show);
            st.push_event(json!({ "type": "open_settings" }));
        }
        TrayAction::About => {
            st.send_window(WindowCmd::Show);
            st.push_event(json!({ "type": "open_about" }));
        }
        TrayAction::Exit => st.send_window(WindowCmd::Quit),
    }
}

/// Periodic tick (1 Hz): completion events, sounds, quota, power countdown, temp cleanup.
pub fn tick_1s(st: &Arc<WebUiState>) {
    let s = st.mgr.settings();
    let completed = st.mgr.take_completed();
    if !completed.is_empty() {
        let mut files = Vec::new();
        for id in &completed {
            if let Some(v) = st.mgr.get(*id) {
                if s.virus_scan && !s.virus_program.trim().is_empty() {
                    system::virus_scan(&s.virus_program, &s.virus_args, &v.save_path);
                }
                if s.show_complete_dialog {
                    files.push(serialize_download(&v, &s));
                }
            }
        }
        if !files.is_empty() {
            st.push_event(json!({ "type": "download_complete", "files": files }));
        }
    }

    for ev in st.mgr.take_events() {
        match ev {
            swiftget_engine::Event::Completed(_) => {
                if s.sounds_on {
                    sound::play(&s.sound_complete);
                }
            }
            swiftget_engine::Event::Failed(id) => {
                if s.sounds_on {
                    sound::play(&s.sound_failed);
                }
                if let Some(v) = st.mgr.get(id) {
                    if let Some(err) = &v.error {
                        if err.contains("server answered HTTP 403") || err.contains("server answered HTTP 401") {
                            let target = v.parent_page.clone().unwrap_or(v.url.clone());
                            if target.starts_with("http://") || target.starts_with("https://") {
                                api::leave_to_browser(&target);
                                st.relayed.lock_ok().insert(target.clone(), (id, Instant::now(), 1));
                                let _ = open::that_detached(&target);
                            }
                        }
                    }
                }
            }
            swiftget_engine::Event::QueueStarted(_) => {
                if s.sounds_on {
                    sound::play(&s.sound_queue_start);
                }
            }
            swiftget_engine::Event::QueueDone(_) => {
                if s.sounds_on {
                    sound::play(&s.sound_queue_done);
                }
            }
            swiftget_engine::Event::QuotaReached => {
                if s.quota_warn {
                    st.push_event(json!({ "type": "toast", "level": "warn", "message": t("Download quota reached. Downloads stopped.") }));
                }
            }
            swiftget_engine::Event::OpenFile(id) => {
                if let Some(v) = st.mgr.get(id) {
                    let _ = open::that_detached(&v.save_path);
                }
            }
        }
    }

    if st.mgr.take_exit_request() {
        st.send_window(WindowCmd::Quit);
        return;
    }

    if let Some(power_act) = st.mgr.take_power_request() {
        if power_act == AfterDone::Exit {
            st.send_window(WindowCmd::Quit);
            return;
        }
        *st.power_countdown.lock_ok() = Some((power_act, 30));
    }

    // Power countdown tick
    let mut exec_act = None;
    {
        let mut p = st.power_countdown.lock_ok();
        if let Some((act, secs)) = p.as_mut() {
            if *secs <= 1 {
                exec_act = Some(*act);
                *p = None;
            } else {
                *secs -= 1;
            }
        }
    }
    if let Some(act) = exec_act {
        execute_power(st, act);
    }

    preview::clean_up();
}
