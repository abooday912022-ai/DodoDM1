//! Pure helper functions and domain metadata shared between the WebUI backend
//! and the optional classic Slint UI.

use crate::i18n::{t, tf};
use sha2::{Digest, Sha256};
use std::path::Path;
use swiftget_engine::{default_data_dir, filename, ytdlp};

pub(crate) const APP: &str = "DODO DM1";

pub(crate) const SHORTCUTS: &str = "Keyboard shortcuts\n\n\
Ctrl+N or Ctrl+V: add a download (a copied address)\n\
Ctrl+B: add several addresses\n\
Enter: open the download (its window, or the file)\n\
Alt+Enter: properties\n\
F2: rename / move the file\n\
Ctrl+R: resume\n\
Ctrl+S: stop\n\
Ctrl+O: open the file\n\
Ctrl+E: open its folder\n\
Ctrl+C: copy the address\n\
Delete: delete\n\
Up / Down, Home / End: move in the list (with Shift: select)\n\
Ctrl+A: select all\n\
Ctrl+F, F3: find, find the next";

pub(crate) const WHATS_NEW: [&str; 19] = [
    "The Site Grabber finds the files behind download links that show no file name and asks the server for their real names and sizes, a playlist shows one \"Download complete\" window at the end instead of one for every file, and the computer is never shut down or put to sleep while a file is still being put together.",
    "Torrents are shared by the program itself now, with no helper program: they start sooner, use less of the computer, and a stopped torrent goes on after a restart without checking all its pieces again.",
    "FTP and FTPS links download like web links: in parts, with resume, and with the user name and password kept apart from the address.",
    "Checksum: paste an MD5, SHA-1 or SHA-256 value in Download File Info (or the site gives one) and the file is checked when it finishes.",
    "Torrents have their own tab in Properties: the files (choose them while it runs), the people, the trackers and the pieces. Add a tracker, check the files again, copy the magnet link, first and last pieces first, and stop sharing at a ratio you choose.",
    "Safer resume: a file that changed on the server is noticed instead of being joined with the old parts, links that lead through a few pages to the file are followed, and downloads that need a form sent from the browser work.",
    "The speed limit can work only while you use the computer, and a scheduled queue can wake the computer from sleep to start.",
    "Keyboard shortcuts for the list (F1 shows them), a command line for other programs and scripts, and Help > Add DODO DM1 to my browser > Test the link checks the add-in step by step.",
    "The add-in works in private windows too (allow it there in the browser), keeps the browser's own download when the program is closed, and its video button can be moved or hidden on a site.",
    "Four new 3D looks (View): 3D, Aurora glass, Soft clay and Cyber neon, with raised buttons, colored pictures, downloads on floating cards and a new download window with a progress ring and the speed.",
    "The setup asks for the language of the program at the first install, and can let torrents through the Windows firewall.",
    "Options > Torrents: make DODO DM1 the main program for torrents, or leave magnet links and .torrent files to your own torrent program.",
    "A torrent that is connected but gets nothing looks for other people by itself, and says why it waits.",
    "Playlists: names in the program's language, right-to-left names shown from the right, a few videos at a time, and a video that fails is tried again by itself.",
    "The add-in has one tab for the whole video and one for a part of it, and it never downloads the video that played before in the same player.",
    "The right-click menu of the list is a real Windows menu that is never cut off, in the look of the program.",
    "Sites that refuse extra connections: the download goes on with fewer. Up to 64 connections. A site that asks for a robot check says so, and the Firefox add-on is fetched from the official page when it is missing.",
    "The add-in talks to the program directly, without a port: no more \"DODO DM1 is not running\" while it runs, and a closed program is opened for a download.",
    "A power cut no longer loses the download list, the end of a download is never held by one slow connection, and a file that is already in the folder asks whether to replace it.",
];

pub(crate) fn note(what: &str) {
    let dir = default_data_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("events.log");
    if std::fs::metadata(&path).map(|m| m.len() > 128 * 1024).unwrap_or(false) {
        let _ = std::fs::rename(&path, path.with_extension("old.log"));
    }
    let line = format!("{} {} {}\n", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), env!("CARGO_PKG_VERSION"), what);
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(line.as_bytes());
    }
}

pub(crate) fn install_crash_log() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let path = default_data_dir().join("crash.log");
        if std::fs::metadata(&path).map(|m| m.len() > 256 * 1024).unwrap_or(false) {
            let _ = std::fs::remove_file(&path);
        }
        let place = info.location().map(|l| format!("{}:{}", l.file(), l.line())).unwrap_or_default();
        let what = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_default();
        let line = format!(
            "{} version {} thread {:?}: {} at {}\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            env!("CARGO_PKG_VERSION"),
            std::thread::current().name().unwrap_or("?"),
            what,
            place
        );
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
            let _ = f.write_all(line.as_bytes());
        }
        previous(info);
    }));
}

pub(crate) fn elevated() -> bool {
    #[cfg(windows)]
    {
        unsafe { windows_sys::Win32::UI::Shell::IsUserAnAdmin() != 0 }
    }
    #[cfg(not(windows))]
    false
}

pub(crate) fn end_process(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let exe = std::env::current_exe().ok().and_then(|e| e.file_name().map(|n| n.to_string_lossy().to_string()));
        let exe = exe.unwrap_or_else(|| "DodoDM1.exe".into());
        let _ = std::process::Command::new(swiftget_engine::system::windows_tool("taskkill.exe"))
            .args(["/F", "/PID", &pid.to_string(), "/FI", &format!("IMAGENAME eq {exe}")])
            .creation_flags(0x0800_0000)
            .status();
    }
    #[cfg(not(windows))]
    let _ = pid;
}

pub(crate) fn is_download_address(t: &str) -> bool {
    let l = t.trim_start().to_ascii_lowercase();
    ["http://", "https://", "ftp://", "ftps://"].iter().any(|p| l.starts_with(p))
}

pub(crate) fn extract_links(text: &str) -> Vec<String> {
    text.split_whitespace()
        .map(|l| l.trim_matches(|c| c == '"' || c == '\'' || c == '<' || c == '>' || c == ','))
        .filter(|l| is_download_address(l) && url::Url::parse(l).is_ok())
        .map(|l| l.to_string())
        .collect()
}

pub(crate) fn kind_for(name: &str) -> &'static str {
    match filename::extension(name).as_str() {
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "ts" | "3gp" | "mpg" | "mpeg" | "vob"
        | "rm" | "rmvb" | "ogv" | "asf" => "video",
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "wma" | "opus" | "mid" | "mka" => "audio",
        "zip" | "rar" | "7z" | "tar" | "gz" | "tgz" | "bz2" | "xz" | "zst" | "cab" | "arj" | "lzh" => "archive",
        "iso" | "img" | "dmg" => "disc",
        "pdf" => "pdf",
        "doc" | "docx" | "odt" | "rtf" | "epub" => "doc",
        "xls" | "xlsx" | "csv" | "ods" => "sheet",
        "ppt" | "pptx" | "odp" | "pps" => "slides",
        "txt" | "md" | "log" | "json" | "xml" => "text",
        "exe" | "msi" | "msix" | "appx" | "bat" | "jar" | "deb" | "rpm" => "exe",
        "apk" | "xapk" => "apk",
        "torrent" => "torrent",
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "svg" | "tif" | "tiff" | "heic" | "ico" | "psd" => "image",
        _ => "general",
    }
}

pub(crate) fn part_name(title: &str, ext: &str, key: &str) -> String {
    let ext = if key == ytdlp::MP3_KEY {
        "mp3"
    } else if key.starts_with("audio|") && matches!(ext, "webm" | "opus") {
        "ogg"
    } else if key.starts_with("audio|") {
        "m4a"
    } else {
        "mp4"
    };
    let stem = filename::sanitize(title.trim());
    let stem = if stem.is_empty() { "video".to_string() } else { stem };
    format!("{stem}.{ext}")
}

pub(crate) fn looks_like_torrent(url: &str, file_name: Option<&str>) -> bool {
    let path = url::Url::parse(url).map(|u| u.path().to_ascii_lowercase()).unwrap_or_default();
    (url.starts_with("http://") || url.starts_with("https://"))
        && (path.ends_with(".torrent") || file_name.is_some_and(|n| n.trim().to_ascii_lowercase().ends_with(".torrent")))
}

pub(crate) fn expand_pattern(pattern: &str, letters: bool, from: &str, to: &str, size: usize) -> Result<Vec<String>, String> {
    let pattern = pattern.trim();
    if !(pattern.starts_with("http://") || pattern.starts_with("https://")) {
        return Err(t("The address must start with http:// or https://"));
    }
    if !pattern.contains('*') {
        return Err(t("Put a * in the address where the number goes"));
    }
    let mut out = Vec::new();
    if letters {
        let a = from.trim().chars().next().filter(|c| c.is_ascii_alphabetic()).ok_or_else(|| t("From must be a letter"))?;
        let b = to.trim().chars().next().filter(|c| c.is_ascii_alphabetic()).ok_or_else(|| t("To must be a letter"))?;
        let (a, b) = (a as u8, b as u8);
        if a > b {
            return Err(t("From must come before To"));
        }
        for c in a..=b {
            out.push(pattern.replace('*', &(c as char).to_string()));
        }
    } else {
        let a: u64 = from.trim().parse().map_err(|_| t("From must be a number"))?;
        let b: u64 = to.trim().parse().map_err(|_| t("To must be a number"))?;
        if a > b {
            return Err(t("From must be smaller than To"));
        }
        if b - a >= 10_000 {
            return Err(t("That's more than 10000 files"));
        }
        for n in a..=b {
            out.push(pattern.replace('*', &format!("{n:0size$}")));
        }
    }
    Ok(out)
}

pub(crate) fn err_text(e: &str) -> String {
    if e.contains("needs a login or an age check") {
        t("This video needs a login or an age check. Open it once in the browser where you are signed in (with the DODO DM1 extension), then try again.")
    } else if e.contains("BitLocker") || e.contains("-2144272384") {
        t("The drive of the download folder is locked by BitLocker. Unlock it in Windows, or choose another folder (right-click the download > Properties).")
    } else if e.contains("is already registered") {
        t("This torrent is already running (it may still be sharing its files). Wait a little, or exit DODO DM1 and open it again.")
    } else if let Some(rest) = e.split("the link stopped working - getting a new one in ").nth(1) {
        let secs = rest.split(' ').next().unwrap_or("?");
        tf("The link stopped working. A new one is fetched in {} s and checked before the download goes on.", &[&secs])
    } else if let Some(rest) = e.split("the server can't resume, starting again in ").nth(1) {
        let secs = rest.split(' ').next().unwrap_or("?");
        tf("The server had trouble and can't resume this file, so it starts again from the beginning in {} s.", &[&secs])
    } else if e.contains(swiftget_engine::http::CAPTCHA) {
        t("The site asks to confirm you are not a robot. Open the link in the browser, confirm there, then click Resume.")
    } else if e.contains(swiftget_engine::TORRENT_DRY_TEXT) {
        t("Connected to people who send nothing yet (they don't have the missing pieces, or they are busy). DODO DM1 keeps looking for others who have the file.")
    } else if e.contains("server answered HTTP 403") || e.contains("server answered HTTP 401") {
        t("The server refused DODO DM1 (it lets only the browser in). The link was opened in the browser, which hands it back with the site's sign-in; if the site still refuses, the browser downloads it itself.")
    } else if e.contains("DRM") {
        t("This video is protected by its site (DRM): no download program can save it. It can only be watched on the site.")
    } else if e.contains("nobody shares this torrent right now") {
        t("Nobody shares this torrent right now. It keeps looking and starts by itself as soon as someone does. If it stays like this, the torrent has no sharers left, or your internet provider or firewall blocks torrents.")
    } else if e.contains("ffmpeg.exe is missing") {
        t("ffmpeg.exe (it joins the video and the sound) is missing and could not be downloaded again. Allow it in your antivirus or install DODO DM1 again, then click Resume: nothing downloaded is lost.")
    } else if let Some(rest) = e.split("Not enough free space on the disk ").nth(1) {
        let (disk, rest) = rest.split_once(": the file needs ").unwrap_or(("", rest));
        let (need, free) = rest.split_once(" more, only ").unwrap_or((rest, ""));
        let free = free.trim_end_matches(" free.");
        tf(
            "Not enough free space on the disk {}: the file needs {} more, only {} is free. Choose a folder on another disk (right-click the download > Move / Rename), or free some space, then click Resume.",
            &[&disk, &need, &free],
        )
    } else if e.contains("the site gave a list of pieces of a video stream") || e.contains("the site gave a web page, not the video") {
        t("The site gave a page instead of the video (it protects its videos, or the link expired), so no broken file was kept. Play the video on its page and use the DODO DM1 button that appears on it.")
    } else if e.contains("the downloaded data is gone") {
        t("The downloaded data is gone: its temporary file was removed while it downloaded (an antivirus or a cleaning program?). Click Redownload; if it happens again, allow the download folder in the antivirus.")
    } else if e.contains("ffmpeg could not cut the part") {
        t("The part could not be cut. Try the quick cut, or another quality.")
    } else if e.contains("the part asked for is after the end of the video") {
        t("The part you chose is after the end of the video.")
    } else if e.contains("the new link is not the same file") {
        t("The new link gives another file, so nothing more was written. Right-click the download and use \"Refresh download address\".")
    } else if e.contains("the link has expired or the file was removed") {
        t("The link has expired or the file was removed. Right-click the download and use \"Refresh download address\".")
    } else if e.contains("the downloaded file is damaged: its checksum") {
        t("The downloaded file is damaged: its checksum is not the one it should have. Click Redownload.")
    } else if e.contains(swiftget_engine::http_download::FILE_CHANGED) {
        t("The file on the server changed since the download began, so its parts would not fit together. Click Redownload.")
    } else if e.contains("the link opens one web page after another") {
        t("The link opens one web page after another, not a file. Open it in the browser and download it from there.")
    } else if e.contains("file names that lead out of its folder") {
        t("This torrent has file names that lead out of its folder, so it was stopped to keep your other files safe.")
    } else {
        e.to_string()
    }
}

pub(crate) fn open_with_dialog(path: &Path) {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new(swiftget_engine::system::windows_tool("rundll32.exe"))
            .arg("shell32.dll,OpenAs_RunDLL")
            .arg(path)
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = open::that_detached(path);
    }
}

pub(crate) fn open_folder_select(path: &Path) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        if path.exists() {
            let _ = std::process::Command::new(swiftget_engine::system::windows_tool("explorer.exe"))
                .raw_arg(format!("/select,\"{}\"", path.display()))
                .spawn();
        } else if let Some(parent) = path.parent() {
            let _ = open::that_detached(parent);
        }
    }
    #[cfg(not(windows))]
    {
        if let Some(parent) = path.parent() {
            let _ = open::that_detached(parent);
        }
    }
}

pub(crate) fn sha256_file(path: &Path) -> anyhow::Result<String> {
    use std::io::Read;
    let mut f = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let digest = hasher.finalize();
    Ok(digest.iter().map(|b| format!("{b:02x}")).collect())
}
