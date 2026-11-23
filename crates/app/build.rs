use std::path::{Path, PathBuf};

fn collect_files(base: &Path, dir: &Path, out: &mut Vec<(String, PathBuf)>) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for entry in rd.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_files(base, &path, out);
        } else if path.is_file() {
            if let Ok(rel) = path.strip_prefix(base) {
                let web_path = format!("/{}", rel.to_string_lossy().replace('\\', "/"));
                out.push((web_path, std::fs::canonicalize(&path).unwrap_or(path)));
            }
        }
    }
}

fn mime_for(path: &str) -> &'static str {
    if path.ends_with(".html") {
        "text/html; charset=utf-8"
    } else if path.ends_with(".js") || path.ends_with(".mjs") {
        "application/javascript; charset=utf-8"
    } else if path.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".ico") {
        "image/x-icon"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".json") {
        "application/json; charset=utf-8"
    } else {
        "application/octet-stream"
    }
}

fn generate_web_assets() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let dist_dir = manifest_dir.join("../../dodo-react-ui/dist");
    println!("cargo:rerun-if-changed={}", dist_dir.display());
    let mut files = Vec::new();
    if dist_dir.is_dir() {
        collect_files(&dist_dir, &dist_dir, &mut files);
    }
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let mut code = String::from("pub fn web_asset(path: &str) -> Option<(&'static str, &'static [u8])> {\n    match path {\n");
    for (web_path, abs_path) in files {
        let abs_str = abs_path.to_string_lossy().replace('\\', "/");
        println!("cargo:rerun-if-changed={}", abs_path.display());
        let mime = mime_for(&web_path);
        code.push_str(&format!(
            "        {:?} => Some(({:?}, include_bytes!({:?}))),\n",
            web_path, mime, abs_str
        ));
    }
    code.push_str("        _ => None,\n    }\n}\n");
    std::fs::write(out_dir.join("web_assets.rs"), code).expect("write web_assets.rs");
}

fn main() {
    generate_web_assets();

    #[cfg(feature = "classic")]
    {
        let config = slint_build::CompilerConfiguration::new()
            .with_style("fluent".into())
            .with_bundled_translations("lang")
            .with_default_translation_context(slint_build::DefaultTranslationContext::None);
        for lang in ["ar", "fr", "es", "de", "pt", "tr", "ru"] {
            println!("cargo:rerun-if-changed=lang/{lang}/LC_MESSAGES/dodo-dm1.po");
        }
        println!("cargo:rerun-if-changed=lang/rs");
        slint_build::compile_with_config("ui/app.slint", config).expect("Slint UI failed to compile");
    }

    // Icon, full version information and a standard manifest for
    // DodoDM1.exe. Antivirus programs trust a program more when it says
    // clearly who made it, what it is and that it runs without admin rights.
    #[cfg(windows)]
    {
        let version = env!("CARGO_PKG_VERSION");
        let mut res = winresource::WindowsResource::new();
        res.set_icon("icon.ico");
        res.set("ProductName", "DODO DM1");
        res.set("FileDescription", "DODO DM1 – Download Manager");
        res.set("CompanyName", "DODO");
        res.set("LegalCopyright", "Copyright (C) 2026 DODO DM1");
        res.set("OriginalFilename", "DodoDM1.exe");
        res.set("InternalName", "DodoDM1");
        res.set("ProductVersion", version);
        res.set("FileVersion", version);
        res.set_manifest(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity type="win32" name="Dodo.DodoDM1" version="1.0.0.0" processorArchitecture="*"/>
  <description>DODO DM1 - Download Manager</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
    </dependentAssembly>
  </dependency>
</assembly>
"#,
        );
        if let Err(e) = res.compile() {
            println!("cargo:warning=could not embed the Windows icon: {e}");
        }
    }
}
