// DODO DM1 — desktop app (React + WebView2 + Rust Engine).
#![recursion_limit = "512"]
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod api;
mod assoc;
mod autostart;
mod browser;
mod cli;
mod clipboard;
mod common;
mod i18n;
mod nativehost;
mod preview;
mod sound;
mod tray;
mod webui;

pub(crate) use common::{
    elevated, end_process, err_text, install_crash_log, is_download_address, looks_like_torrent,
    note, APP,
};
use serde_json::json;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};
use swiftget_engine::config::Settings;
use swiftget_engine::{default_data_dir, Manager, NewDownload};
use tao::dpi::LogicalSize;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tao::window::{Icon, WindowBuilder};
use webui::WindowCmd;
use wry::{DragDropEvent, WebViewBuilder};

fn main() {
    install_crash_log();
    if let Err(e) = run() {
        let text = format!("{e:#}");
        note(&format!("could not start: {text}"));
        let _ = rfd::MessageDialog::new()
            .set_title(APP)
            .set_level(rfd::MessageLevel::Error)
            .set_description(format!(
                "DODO DM1 could not start:\n\n{text}\n\nتعذّر تشغيل DODO DM1. أعد تشغيل الجهاز ثم جرّب مرة أخرى."
            ))
            .show();
        std::process::exit(1);
    }
}

fn run() -> anyhow::Result<()> {
    let background = std::env::args().any(|a| a == "--background" || a == "--from-browser");
    let backend_only = std::env::args().any(|a| a == "--backend" || a == "--headless");
    let data_dir = default_data_dir();

    let (port, token) = {
        let path = data_dir.join("settings.json");
        let first_start = !path.exists();
        let mut s = Settings::load(&path);
        if first_start {
            if let Some(lang) = autostart::setup_value("Language").filter(|l| i18n::LANGS.iter().any(|(c, _)| c == l)) {
                s.language = lang;
            }
            if let Some(t) = autostart::setup_value("Torrents") {
                s.torrent_main = t != "0";
            }
            let _ = std::fs::create_dir_all(&data_dir);
            let _ = s.save(&path);
        }
        if s.api_token.len() < 32 {
            s.api_token = swiftget_engine::secret::random_token();
            let _ = std::fs::create_dir_all(&data_dir);
            let _ = s.save(&path);
        }
        (s.browser_port, s.api_token)
    };
    let _ = api::TOKEN.set(token.clone());

    if std::env::args().any(|a| a == "--quit") {
        api::notify_quit(port);
        return Ok(());
    }

    note(&format!(
        "start (React UI){}{}",
        if background { " (with Windows)" } else { "" },
        if elevated() { " (as administrator)" } else { "" }
    ));

    let mut first = api::bind(port);
    if first.is_err() && std::env::args().any(|a| a == "--restarted") {
        for _ in 0..60 {
            std::thread::sleep(Duration::from_millis(250));
            first = api::bind(port);
            if first.is_ok() {
                break;
            }
        }
    }

    let open_torrent = std::env::args().skip(1).find(|a| api::torrent_source_ok(a));
    let cli_ask = cli::parse(std::env::args().skip(1)).filter(|c| !c.is_empty());

    let server = match first {
        Ok(s) => Some(s),
        Err(_) => {
            if let Some(src) = &open_torrent {
                if api::notify_open_torrent(port, src) {
                    return Ok(());
                }
            }
            if let Some(ask) = &cli_ask {
                let own = Settings::load(&data_dir.join("settings.json")).api_port;
                if api::notify_cli(port, ask) || (own != 0 && api::notify_cli(own, ask)) {
                    return Ok(());
                }
            }
            match api::notify_existing(port) {
                api::Existing::Shown => {
                    note("already open: brought to the front");
                    return Ok(());
                }
                api::Existing::Hangs(pid) => {
                    note(&format!("already open but not answering (process {pid})"));
                    let yes = matches!(
                        rfd::MessageDialog::new()
                            .set_title(APP)
                            .set_level(rfd::MessageLevel::Warning)
                            .set_description(
                                "DODO DM1 is already open but does not answer.\nClose it and open it again?\n\n\
                                 DODO DM1 مفتوح بالفعل لكنه لا يستجيب.\nهل تريد إغلاقه وفتحه من جديد؟",
                            )
                            .set_buttons(rfd::MessageButtons::YesNo)
                            .show(),
                        rfd::MessageDialogResult::Yes
                    );
                    if !yes || pid == 0 || pid == std::process::id() {
                        return Ok(());
                    }
                    end_process(pid);
                    let mut got = None;
                    for _ in 0..40 {
                        std::thread::sleep(Duration::from_millis(250));
                        if let Ok(s) = api::bind(port) {
                            got = Some(s);
                            break;
                        }
                    }
                    got
                }
                api::Existing::None if api::show_on_own_port(Settings::load(&data_dir.join("settings.json")).api_port) => {
                    note("already open (its own port): brought to the front");
                    return Ok(());
                }
                api::Existing::None => {
                    note(&format!("port {port} can't be opened: using own port"));
                    None
                }
            }
        }
    };

    api::FRONT_OPEN.store(server.is_some(), Ordering::Relaxed);
    let main_server = {
        let path = data_dir.join("settings.json");
        let mut s = Settings::load(&path);
        let got = api::bind_main(s.api_port);
        if let Some((_, p)) = &got {
            api::MAIN_PORT.store(*p, Ordering::Relaxed);
            if s.api_port != *p {
                s.api_port = *p;
                let _ = s.save(&path);
            }
        }
        browser::prepare_extension_folders();
        let dir = data_dir.clone();
        std::thread::spawn(move || nativehost::install(&dir));
        got.map(|(srv, _)| srv)
    };

    let workers = std::thread::available_parallelism()
        .map(|n| n.get().clamp(8, 16))
        .unwrap_or(8);
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(workers)
        .enable_all()
        .build()?;
    let mgr = Manager::new(rt.handle().clone(), data_dir.clone())?;
    swiftget_engine::tools::spawn_updater(rt.handle(), mgr.client(), data_dir.clone());

    {
        let mut s = mgr.settings();
        if !s.autostart_set {
            if !autostart::installed_by_setup() {
                autostart::set(true);
            }
            s.autostart_set = true;
            let _ = mgr.set_settings(s);
        }
    }

    i18n::apply(i18n::effective(&mgr.settings().language));

    let event_loop = EventLoopBuilder::<WindowCmd>::with_user_event().build();
    let proxy = event_loop.create_proxy();

    let ui_state = webui::start_server(
        mgr.clone(),
        rt.handle().clone(),
        Box::new(move |cmd| {
            let _ = proxy.send_event(cmd);
        }),
    )?;
    webui::spawn_app_update_checker(ui_state.clone());

    let ui_url = format!("http://127.0.0.1:{}/?t={}", ui_state.ui_port, ui_state.session_token);
    if backend_only {
        println!("DODO_UI_URL={ui_url}");
        let _ = std::io::Write::flush(&mut std::io::stdout());
    }

    // Wire extension servers
    let (api_tx, api_rx) = std::sync::mpsc::channel::<api::ApiEvent>();
    if let Some(main_srv) = main_server {
        let tx = api_tx.clone();
        let m = mgr.clone();
        api::serve(main_srv, api::Door::Main, move || api::config_json(&m.settings()), move |ev| {
            let _ = tx.send(ev);
        });
    }
    if let Some(front_srv) = server {
        let tx = api_tx.clone();
        let m = mgr.clone();
        api::serve(front_srv, api::Door::Front, move || api::config_json(&m.settings()), move |ev| {
            let _ = tx.send(ev);
        });
    }

    // Clipboard monitor
    {
        let mgr_clip = mgr.clone();
        let st_clip = ui_state.clone();
        let own_exts = {
            let mgr_c = mgr.clone();
            move || -> Vec<String> {
                mgr_c
                    .settings()
                    .capture_exts
                    .split_whitespace()
                    .map(|s| s.trim_start_matches('.').to_ascii_lowercase())
                    .collect()
            }
        };
        clipboard::spawn(
            {
                let mgr_e = mgr_clip.clone();
                move || mgr_e.settings().clipboard_monitor
            },
            own_exts,
            move |url| {
                let s = mgr_clip.settings();
                if s.auto_start_clipboard {
                    if mgr_clip.find_url(&url).is_none() {
                        let _ = mgr_clip.add(NewDownload {
                            url,
                            start: true,
                            ..Default::default()
                        });
                    }
                } else {
                    st_clip.push_event(json!({ "type": "clipboard_url", "url": url }));
                }
            },
        );
    }

    // Handle initial startup torrent or CLI args
    if let Some(src) = open_torrent {
        ui_state.push_event(json!({ "type": "open_torrent", "source": src }));
    }
    if let Some(ask) = cli_ask {
        webui::handle_api_event(&ui_state, api::ApiEvent::Cli(ask));
    }

    let tray = tray::Tray::new();
    if let Some(tr) = &tray {
        tr.set_limiter(mgr.settings().speed_limit_on);
    }

    // Headless / Electron backend loop
    if backend_only {
        loop {
            api::UI_ALIVE.store(api::now_secs(), Ordering::Relaxed);
            while let Ok(ev) = api_rx.try_recv() {
                webui::handle_api_event(&ui_state, ev);
            }
            if let Some(tr) = &tray {
                tr.set_limiter(mgr.settings().speed_limit_on);
                for act in tr.poll() {
                    if matches!(act, tray::TrayAction::Exit) {
                        ui_state.shutdown_requested.store(true, Ordering::Relaxed);
                    } else {
                        webui::handle_tray_action(&ui_state, act);
                    }
                }
            }
            webui::tick_1s(&ui_state);
            if ui_state.shutdown_requested.load(Ordering::Relaxed) {
                break;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        preview::clean_all();
        mgr.shutdown();
        return Ok(());
    }

    // Create native WebView2 React desktop window
    let win_icon = Icon::from_rgba(include_bytes!("../ui/tray32.rgba").to_vec(), 32, 32).ok();
    let window = WindowBuilder::new()
        .with_title("DODO DM1")
        .with_inner_size(LogicalSize::new(1180.0, 740.0))
        .with_min_inner_size(LogicalSize::new(860.0, 560.0))
        .with_decorations(false)
        .with_window_icon(win_icon)
        .with_visible(!background)
        .build(&event_loop)?;

    let st_drop = ui_state.clone();
    let _webview = WebViewBuilder::new()
        .with_url(&ui_url)
        .with_background_color((15, 23, 42, 255))
        .with_devtools(cfg!(debug_assertions))
        .with_drag_drop_handler(move |e| {
            if let DragDropEvent::Drop { paths, .. } = e {
                for p in paths {
                    let s = p.to_string_lossy().into_owned();
                    let lower = s.to_ascii_lowercase();
                    if lower.ends_with(".torrent") {
                        st_drop.push_event(json!({ "type": "open_torrent", "source": s }));
                    } else if lower.ends_with(".ef2") || lower.ends_with(".txt") {
                        if let Ok(text) = std::fs::read_to_string(&p) {
                            let links: Vec<String> = swiftget_engine::ef2::parse(&text)
                                .into_iter()
                                .map(|i| i.url)
                                .collect();
                            if !links.is_empty() {
                                st_drop.push_event(json!({ "type": "open_batch_clipboard", "links": links }));
                            }
                        }
                    } else if is_download_address(&s) || looks_like_torrent(&s, None) {
                        st_drop.push_event(json!({ "type": "open_add", "url": s }));
                    }
                }
                return true;
            }
            false
        })
        .build(&window)?;

    let mut last_tick = Instant::now();
    let mut cleaned = false;

    event_loop.run(move |event, _, control_flow| {
        let next = Instant::now() + Duration::from_millis(120);
        *control_flow = ControlFlow::WaitUntil(next);

        api::UI_ALIVE.store(api::now_secs(), Ordering::Relaxed);

        // Drain browser extension / CLI events
        while let Ok(ev) = api_rx.try_recv() {
            webui::handle_api_event(&ui_state, ev);
        }

        // Poll tray actions
        if let Some(tr) = &tray {
            tr.set_limiter(mgr.settings().speed_limit_on);
            for act in tr.poll() {
                webui::handle_tray_action(&ui_state, act);
            }
        }

        // 1 Hz engine tick
        if last_tick.elapsed() >= Duration::from_secs(1) {
            last_tick = Instant::now();
            webui::tick_1s(&ui_state);
        }

        match event {
            Event::UserEvent(cmd) => match cmd {
                WindowCmd::Show => {
                    window.set_visible(true);
                    window.set_minimized(false);
                    window.set_focus();
                }
                WindowCmd::Hide => {
                    window.set_visible(false);
                }
                WindowCmd::Toggle => {
                    let vis = window.is_visible() && !window.is_minimized();
                    if vis {
                        window.set_visible(false);
                    } else {
                        window.set_visible(true);
                        window.set_minimized(false);
                        window.set_focus();
                    }
                }
                WindowCmd::Minimize => {
                    window.set_minimized(true);
                }
                WindowCmd::MaximizeToggle => {
                    window.set_maximized(!window.is_maximized());
                }
                WindowCmd::Drag => {
                    let _ = window.drag_window();
                }
                WindowCmd::Quit => {
                    if !cleaned {
                        cleaned = true;
                        preview::clean_all();
                        mgr.shutdown();
                    }
                    *control_flow = ControlFlow::Exit;
                }
            },
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                if mgr.settings().close_to_tray && tray.is_some() {
                    window.set_visible(false);
                } else {
                    if !cleaned {
                        cleaned = true;
                        preview::clean_all();
                        mgr.shutdown();
                    }
                    *control_flow = ControlFlow::Exit;
                }
            }
            _ => {}
        }
    });
}
