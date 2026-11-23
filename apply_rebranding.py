import os
import re

ROOT = r"C:\Users\dodo\Desktop\aidm 2027\DODO-DM1"

def replace_in_file(rel_path, replacements):
    path = os.path.join(ROOT, rel_path)
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    modified = content
    for old, new in replacements:
        modified = modified.replace(old, new)
        
    if modified != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(modified)
        print(f"Updated: {rel_path}")
    else:
        print(f"No changes made in: {rel_path}")

def rebrand_all():
    print("--- 1. Updating crates/app/src/main.rs ---")
    replace_in_file(r"crates\app\src\main.rs", [
        ('pub(crate) const APP: &str = "Ezoo Download";', 'pub(crate) const APP: &str = "DODO DM1";'),
        ('Ezoo Download', 'DODO DM1'),
        ('EzooDownload.exe', 'DodoDM1.exe'),
        ('EzooDownload', 'DodoDM1'),
    ])

    print("--- 2. Updating crates/app/src/nativehost.rs ---")
    replace_in_file(r"crates\app\src\nativehost.rs", [
        ('pub(crate) const NAME: &str = "com.ezoo.download";', 'pub(crate) const NAME: &str = "com.dododm1.download";'),
        ('ezoo-host.exe', 'dodo-host.exe'),
        ('ezoo-host', 'dodo-host'),
        ('com.ezoo.download', 'com.dododm1.download'),
    ])

    print("--- 3. Updating crates/app/src/assoc.rs ---")
    replace_in_file(r"crates\app\src\assoc.rs", [
        ('Ezoo Download', 'DODO DM1'),
        ('EzooDownload.torrent', 'DodoDM1.torrent'),
        ('EzooDownload.exe', 'DodoDM1.exe'),
        ('ezoodownload.exe', 'dododm1.exe'),
    ])

    print("--- 4. Updating crates/app/src/autostart.rs ---")
    replace_in_file(r"crates\app\src\autostart.rs", [
        ('const NAME: &str = "EzooDownload";', 'const NAME: &str = "DodoDM1";'),
        (r'HKCU\Software\Ezoo\EzooDownload', r'HKCU\Software\Dodo\DodoDM1'),
    ])

    print("--- 5. Updating crates/app/src/browser.rs ---")
    replace_in_file(r"crates\app\src\browser.rs", [
        ('Ezoo Download', 'DODO DM1'),
        ('ezoo-download-firefox.xpi', 'dodo-dm1-firefox.xpi'),
    ])

    print("--- 6. Updating crates/app/src/tray.rs ---")
    replace_in_file(r"crates\app\src\tray.rs", [
        ('Ezoo Download', 'DODO DM1'),
    ])

    print("--- 7. Updating crates/app/src/extra.rs (removing donation logic) ---")
    extra_path = os.path.join(ROOT, r"crates\app\src\extra.rs")
    with open(extra_path, "r", encoding="utf-8") as f:
        extra_content = f.read()

    # Replace finished_well and ask_support_when_free
    extra_pattern = re.compile(r'// -+ support.*?(const TIPS: \[&str; 14\] = \[)', re.DOTALL)
    extra_replacement = """// ---------------------------------------------------------------- finished well

/// `n` downloads just finished well: count them in settings.
pub(crate) fn finished_well(ui: &Ui, n: usize) {
    if n == 0 {
        return;
    }
    let mut s = ui.ctx.mgr.settings();
    s.finished_count = s.finished_count.saturating_add(n as u64);
    let _ = ui.ctx.mgr.set_settings(s);
}

\\1"""
    extra_content = extra_pattern.sub(extra_replacement, extra_content)
    
    # Replace Ezoo Download in TIPS
    extra_content = extra_content.replace('Ezoo Download', 'DODO DM1')

    # Remove support_word_after_50_then_once_a_month test
    test_pattern = re.compile(r'#\[test\]\s+fn support_word_after_50_then_once_a_month\(\) \{.*?\}', re.DOTALL)
    extra_content = test_pattern.sub('// support test removed', extra_content)
    extra_content = extra_content.replace('use super::{is_web_address, support_due};', 'use super::is_web_address;')

    with open(extra_path, "w", encoding="utf-8") as f:
        f.write(extra_content)
    print("Cleaned up extra.rs (donation triggers removed).")

    print("--- 8. Updating crates/app/src/i18n.rs ---")
    replace_in_file(r"crates\app\src\i18n.rs", [
        ('Ezoo Download', 'DODO DM1'),
        ('EzooDownload.exe', 'DodoDM1.exe'),
        ('Support Ezoo Download with PayPal from Help > About.', 'DODO DM1 delivers high-speed multi-threaded downloads.'),
        ('ادعم Ezoo Download عبر PayPal من مساعدة > حول.', 'يمنحك DODO DM1 أقصى سرعة تحميل بتقسيم الملفات المتعدد.'),
    ])

    print("--- 9. Updating crates/app/src/api.rs ---")
    replace_in_file(r"crates\app\src\api.rs", [
        ('Ezoo Download', 'DODO DM1'),
        ('EzooDownload', 'DodoDM1'),
        ('"app":"Ezoo"', '"app":"DODO"'),
        ('"app":"EzooDownload"', '"app":"DodoDM1"'),
        ('ezoo-api-', 'dodo-api-'),
        ('ezoo-host', 'dodo-host'),
        ('ezoo-helper-', 'dodo-helper-'),
        ('EZOO_HOST_BIN', 'DODO_HOST_BIN'),
    ])

    print("--- 10. Updating crates/host/src/main.rs ---")
    replace_in_file(r"crates\host\src\main.rs", [
        ('Ezoo Download', 'DODO DM1'),
        (r'Ezoo\EzooDownload\data\settings.json', r'Dodo\DodoDM1\data\settings.json'),
        ('ezoo-host', 'dodo-host'),
    ])

    print("--- 11. Updating crates/engine/src/config.rs ---")
    replace_in_file(r"crates\engine\src\config.rs", [
        ('Ezoo Download', 'DODO DM1'),
    ])

    print("--- 12. Updating crates/engine/src/manager.rs ---")
    replace_in_file(r"crates\engine\src\manager.rs", [
        ('Ezoo Download', 'DODO DM1'),
        ('ProjectDirs::from("com", "Ezoo", "EzooDownload")', 'ProjectDirs::from("com", "Dodo", "DodoDM1")'),
        ('PathBuf::from("ezoo-data")', 'PathBuf::from("dodo-data")'),
    ])

    print("--- 13. Updating crates/engine/src/tools.rs ---")
    replace_in_file(r"crates\engine\src\tools.rs", [
        ('ProjectDirs::from("com", "Ezoo", "EzooDownload")', 'ProjectDirs::from("com", "Dodo", "DodoDM1")'),
        ('.ezoo-write-test', '.dodo-write-test'),
        ('ezoo-tools-test-', 'dodo-tools-test-'),
    ])

    print("--- 14. Updating crates/engine/src/ytdlp.rs ---")
    replace_in_file(r"crates\engine\src\ytdlp.rs", [
        ('Ezoo Download', 'DODO DM1'),
        ('EzooDownload.exe', 'DodoDM1.exe'),
        ('ezoo-cookies-', 'dodo-cookies-'),
    ])

    print("--- 15. Updating crates/engine/src/ef2.rs & lib.rs & clipserve.rs ---")
    replace_in_file(r"crates\engine\src\ef2.rs", [('Ezoo Download', 'DODO DM1')])
    replace_in_file(r"crates\engine\src\lib.rs", [('Ezoo Download', 'DODO DM1')])
    replace_in_file(r"crates\engine\src\clipserve.rs", [('ezoo-clip', 'dodo-clip')])

    print("--- 16. Updating crates/app/ui/app.slint ---")
    replace_in_file(r"crates\app\ui\app.slint", [
        ('Ezoo Download', 'DODO DM1'),
    ])

    print("--- 17. Updating crates/app/ui/dialogs.slint ---")
    dialogs_path = os.path.join(ROOT, r"crates\app\ui\dialogs.slint")
    with open(dialogs_path, "r", encoding="utf-8") as f:
        d_content = f.read()

    # Replace AboutDialog contents:
    about_pattern = re.compile(r'export component AboutDialog inherits ThemedWindow \{.*?HRow \{\s*alignment: end;\s*Button \{\s*text: @tr\("Close"\);', re.DOTALL)
    about_replacement = """export component AboutDialog inherits ThemedWindow {
    in property <bool> front;
    always-on-top: root.front;
    title: @tr("About DODO DM1");
    preferred-width: 440px;
    min-width: 380px;
    in property <string> version;
    callback open-link(string);
    callback close-window();
    VerticalLayout {
        padding: 24px;
        spacing: 12px;
        HRow {
            alignment: center;
            Image {
                source: @image-url("icon.png");
                width: 72px;
                height: 72px;
            }
        }
        Text {
            text: "DODO DM1";
            horizontal-alignment: center;
            font-size: 22px * Theme.font-scale;
            font-weight: 700;
            color: Theme.accent;
        }
        Text {
            text: @tr("Version {}", root.version);
            horizontal-alignment: center;
            color: Theme.muted;
        }
        Text {
            text: @tr("High-Speed Multi-Connection Download Manager");
            horizontal-alignment: center;
            font-size: 13px * Theme.font-scale;
            color: Theme.text;
        }
        Text {
            text: @tr("© 2026 DODO DM1 – All rights reserved");
            horizontal-alignment: center;
            font-size: 12px * Theme.font-scale;
            font-weight: 600;
            color: Theme.muted;
        }
        Rectangle {
            height: 8px;
        }
        AboutSlint {
            preferred-height: 85px;
        }
        HRow {
            alignment: end;
            Button {
                text: @tr("Close");"""
    d_content = about_pattern.sub(about_replacement, d_content)

    # Neutralize SupportDialog so it does nothing
    support_pattern = re.compile(r'export component SupportDialog inherits ThemedWindow \{.*?\}\s*// After an update: what is new', re.DOTALL)
    support_replacement = """export component SupportDialog inherits ThemedWindow {
    in property <bool> front;
    callback open-link(string);
    callback close-window();
}

// After an update: what is new"""
    d_content = support_pattern.sub(support_replacement, d_content)

    # Remove donation rectangle in WhatsNewDialog
    whatsnew_donation_pattern = re.compile(r'// the program is free: a way to say thank you\s*Rectangle \{.*?Image \{\s*source: @image-url\("instapay-qr\.png"\);.*?\}\s*\}\s*\}\s*\}\s*HRow \{\s*alignment: end;\s*Button \{\s*text: @tr\("OK"\);', re.DOTALL)
    whatsnew_donation_replacement = """HRow {
            alignment: end;
            Button {
                text: @tr("OK");"""
    d_content = whatsnew_donation_pattern.sub(whatsnew_donation_replacement, d_content)

    # Replace remaining Ezoo Download with DODO DM1
    d_content = d_content.replace('Ezoo Download', 'DODO DM1')
    d_content = d_content.replace('EzooDownload', 'DodoDM1')

    with open(dialogs_path, "w", encoding="utf-8") as f:
        f.write(d_content)
    print("Cleaned and rebranded dialogs.slint (AboutDialog & WhatsNewDialog & SupportDialog updated).")

    print("--- 18. Updating extension files ---")
    replace_in_file(r"extension\manifest.json", [
        ('"Ezoo Download"', '"DODO DM1"'),
        ('"Ezoo Download extension."', '"DODO DM1 browser integration."'),
    ])
    replace_in_file(r"extension\manifest.firefox.json", [
        ('"Ezoo Download"', '"DODO DM1"'),
        ('"Ezoo Download extension."', '"DODO DM1 browser integration."'),
        ('ezoo-download', 'dodo-dm1'),
    ])
    replace_in_file(r"extension\background.js", [
        ('const HOST = "com.ezoo.download";', 'const HOST = "com.dododm1.download";'),
        ('Ezoo Download', 'DODO DM1'),
        ('EzooDownload', 'DodoDM1'),
        ('Download with Ezoo Download', 'Download with DODO DM1'),
        ('Download all links with Ezoo Download', 'Download all links with DODO DM1'),
        ('Download video with Ezoo Download', 'Download video with DODO DM1'),
    ])
    replace_in_file(r"extension\popup.html", [('Ezoo Download', 'DODO DM1')])
    replace_in_file(r"extension\options.html", [('Ezoo Download', 'DODO DM1')])
    replace_in_file(r"extension\popup.js", [('Ezoo Download', 'DODO DM1')])
    replace_in_file(r"extension\options.js", [('Ezoo Download', 'DODO DM1')])

    print("--- 19. Updating translation PO files ---")
    po_path = os.path.join(ROOT, r"crates\app\lang\ar\LC_MESSAGES\swiftget.po")
    if os.path.exists(po_path):
        with open(po_path, "r", encoding="utf-8") as f:
            po = f.read()
        po = po.replace('Ezoo Download', 'DODO DM1')
        po = po.replace('EzooDownload', 'DodoDM1')
        with open(po_path, "w", encoding="utf-8") as f:
            f.write(po)
        print("Updated Arabic PO file.")

    for l in ["de", "es", "fr", "pt", "ru", "tr"]:
        p = os.path.join(ROOT, f"crates\\app\\lang\\{l}\\LC_MESSAGES\\swiftget.po")
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                content = f.read()
            content = content.replace('Ezoo Download', 'DODO DM1').replace('EzooDownload', 'DodoDM1')
            with open(p, "w", encoding="utf-8") as f:
                f.write(content)

    print("--- 20. Creating installer/dodo.iss ---")
    iss_old = os.path.join(ROOT, r"installer\ezoo.iss")
    iss_new = os.path.join(ROOT, r"installer\dodo.iss")
    with open(iss_old, "r", encoding="utf-8") as f:
        iss = f.read()
    
    iss = iss.replace('#define MyAppName "Ezoo Download"', '#define MyAppName "DODO DM1"')
    iss = iss.replace('#define MyAppExe "EzooDownload.exe"', '#define MyAppExe "DodoDM1.exe"')
    iss = iss.replace('{F5837666-2925-4FD9-8CE9-728BE9C5D7E4}', '{D0D00001-2925-4FD9-8CE9-728BE9C5D7E4}')
    iss = iss.replace('AppPublisher=Ahmed Ezzat', 'AppPublisher=DODO')
    iss = iss.replace('DefaultDirName={localappdata}\\Programs\\Ezoo Download', 'DefaultDirName={localappdata}\\Programs\\DODO DM1')
    iss = iss.replace('OutputBaseFilename=EzooDownload-Setup', 'OutputBaseFilename=DodoDM1-Setup')
    iss = iss.replace('VersionInfoCompany=Ezoo', 'VersionInfoCompany=DODO')
    iss = iss.replace('VersionInfoDescription=Ezoo Download Setup', 'VersionInfoDescription=DODO DM1 Setup')
    iss = iss.replace('VersionInfoCopyright=Copyright (C) 2026 Ahmed Ezzat', 'VersionInfoCopyright=Copyright (C) 2026 DODO DM1')
    iss = iss.replace('AppPublisherURL=https://www.youtube.com/@Ezoo-Tech', 'AppPublisherURL=https://dodo-dm1.local')
    iss = iss.replace('Ezoo Download', 'DODO DM1')
    iss = iss.replace('EzooDownload', 'DodoDM1')
    iss = iss.replace('ezoo-host.exe', 'dodo-host.exe')
    iss = iss.replace('ezoo-download-firefox', 'dodo-dm1-firefox')

    with open(iss_new, "w", encoding="utf-8") as f:
        f.write(iss)
    print("Created installer/dodo.iss")

    print("--- 21. Creating build-windows.ps1 for DODO DM1 ---")
    ps1_path = os.path.join(ROOT, "build-windows.ps1")
    with open(ps1_path, "r", encoding="utf-8") as f:
        ps1 = f.read()
    ps1 = ps1.replace('EzooDownload.exe', 'DodoDM1.exe')
    ps1 = ps1.replace('EzooDownload-Setup.exe', 'DodoDM1-Setup.exe')
    ps1 = ps1.replace('EzooDownload-Setup', 'DodoDM1-Setup')
    ps1 = ps1.replace('EzooDownload', 'DodoDM1')
    ps1 = ps1.replace('Ezoo Download', 'DODO DM1')
    ps1 = ps1.replace('ezoo-host.exe', 'dodo-host.exe')
    ps1 = ps1.replace('ezoo-host', 'dodo-host')
    ps1 = ps1.replace('ezoo.iss', 'dodo.iss')
    ps1 = ps1.replace('ezoo-setup-build', 'dodo-setup-build')
    ps1 = ps1.replace('ezoo-download-firefox', 'dodo-dm1-firefox')
    with open(ps1_path, "w", encoding="utf-8") as f:
        f.write(ps1)
    print("Updated build-windows.ps1")

    print("--- 22. Creating BUILD.bat ---")
    bat_path = os.path.join(ROOT, "BUILD.bat")
    with open(bat_path, "w", encoding="utf-8") as f:
        f.write('@powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-windows.ps1"\n')
    print("Updated BUILD.bat")

    print("--- 23. Creating README.md for DODO DM1 ---")
    readme_path = os.path.join(ROOT, "README.md")
    readme_content = """# DODO DM1

برنامج إدارة وتنزيل الملفات عالي السرعة لنظام Windows مكتوب بلغة Rust.

## المميزات الرئيسية
- **اتصالات متعددة متزامنة:** تقسيم الملف إلى ما يصل إلى 32 اتصال لزيادة سرعة التحميل إلى الحد الأقصى.
- **استئناف التحميل:** استئناف التحميلات غير المكتملة في أي وقت حتى بعد إغلاق البرنامج أو إعادة تشغيل الجهاز.
- **تكامل المتصفحات:** دعم كامل لمتصفحات Chrome و Edge و Firefox و Brave عبر Native Messaging.
- **تنزيل الفيديو والصوت:** استخراج الفيديو وقوائم التشغيل بأعلى دقة متوفرة.
- **التصنيف الذكي:** فرز وتصنيف تلقائي للملفات وفق نوعها (برامج، فيديو، صوت، مستندات، مضغوطة).
- **قوائم الانتظار والجدولة:** جدولة المهام للتحميل في أوقات محددة وإيقاف تشغيل الجهاز تلقائياً بعد الاكتمال.
- **تحديد السرعة:** حماية استقرار الشبكة وتخصيص سرعات محددة للتحميل.
- **واجهة مستخدم احترافية:** دعم كامل للغة العربية (RTL) واللغة الإنجليزية، مع دعم الوضعين الليلي والنهاري (Dark & Light Mode).
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)
    print("Updated README.md")

if __name__ == "__main__":
    rebrand_all()
    print("All rebranding tasks executed successfully!")
