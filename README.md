<div align="center">

<img src="dodo_dm1_logo.png" alt="DODO DM1 Logo" width="128" height="128" />

# DODO DM1 - Advanced Download Manager

**مدير تنزيلات متقدم وسريع لنظام Windows مبني بمحرك Rust وواجهة React + WebView2 عصرية**
*A Windows desktop download manager powered by an asynchronous Rust engine and a modern React + WebView2 interface.*

[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-0078D6?style=for-the-badge&logo=windows)](https://github.com/abooday912022-ai/DodoDM1)
[![Version](https://img.shields.io/badge/Version-1.0.12-0ea5e9?style=for-the-badge)](Cargo.toml)
[![Engine](https://img.shields.io/badge/Engine-Rust%202021-f97316?style=for-the-badge&logo=rust)](crates/engine/Cargo.toml)
[![UI](https://img.shields.io/badge/UI-React%2018%20%2B%20WebView2-06b6d4?style=for-the-badge&logo=react)](dodo-react-ui/package.json)
[![Torrents](https://img.shields.io/badge/Torrents-librqbit%209.1-a855f7?style=for-the-badge)](crates/engine/Cargo.toml)
[![Extension](https://img.shields.io/badge/Extension-Manifest%20V3-22c55e?style=for-the-badge&logo=googlechrome)](extension/manifest.json)
[![Repository](https://img.shields.io/badge/GitHub-abooday912022--ai%2FDodoDM1-181717?style=for-the-badge&logo=github)](https://github.com/abooday912022-ai/DodoDM1)
[![Issues](https://img.shields.io/badge/Support-GitHub%20Issues-ef4444?style=for-the-badge&logo=github)](https://github.com/abooday912022-ai/DodoDM1/issues)

[**🇸🇦 النسخة العربية**](#arabic-docs) &nbsp;•&nbsp; [**🇺🇸 English Documentation**](#english-docs) &nbsp;•&nbsp; [**📦 Releases**](https://github.com/abooday912022-ai/DodoDM1/releases) &nbsp;•&nbsp; [**🐛 Issues**](https://github.com/abooday912022-ai/DodoDM1/issues)

</div>

---

<a id="arabic-docs"></a>
<div dir="rtl">

## 🇸🇦 التوثيق باللغة العربية

### 📖 نظرة عامة

**DODO DM1** هو برنامج سطح مكتب لإدارة وتنزيل الملفات لنظام **Windows (x64)**، يجمع بين محرك تنزيل مكتوب بلغة **Rust** (`swiftget-engine`) وواجهة رسومية حديثة مبنية بـ **React 18** تعمل داخل نافذة **WebView2** أصلية (`wry` / `tao`) مع دعم تشغيل بديل عبر **Electron**.

يدعم البرنامج تقسيم التنزيلات ديناميكياً عبر اتصالات متوازية، الاستئناف الآمن بعد الإغلاق أو انقطاع الاتصال، بروتوكولات `HTTP/HTTPS` و`FTP/FTPS` و`HLS (.m3u8)` و`DASH`، محرك **BitTorrent / Magnet** مدمج، استخراج الوسائط وقوائم التشغيل واقتطاع مقاطع الفيديو عبر `yt-dlp` و`ffmpeg`، جامع المواقع، قوائم الانتظار والجدولة، إضافةً إلى تكامل كامل مع المتصفحات عبر **Native Messaging**.

---

### 📑 جدول المحتويات

- [✨ المميزات الحقيقية](#ar-features)
- [🛠️ التقنيات ولغات البرمجة المستخدمة](#ar-tech)
- [📁 بنية المشروع ومجلداته](#ar-structure)
- [💻 متطلبات التشغيل والتثبيت](#ar-requirements)
- [🔨 خطوات بناء نسخة Windows](#ar-build)
- [🌐 تكامل المتصفحات المدعومة](#ar-browsers)
- [🖼️ واجهة البرنامج](#ar-ui)
- [❓ الأسئلة الشائعة](#ar-faq)
- [🐛 الإبلاغ عن المشاكل وطلبات التطوير](#ar-issues)
- [📦 الإصدارات (Releases)](#ar-releases)
- [📄 الترخيص وإشعارات الطرف الثالث](#ar-license)

---

<a id="ar-features"></a>
### ✨ المميزات الحقيقية

#### ⚡ محرك التنزيل المتعدد الاتصالات والاستئناف
- **التجزئة الديناميكية (Dynamic Segmentation):** تقسيم الملف تلقائياً إلى `32` اتصالاً افتراضياً (قابل للتعديل من `1` إلى `64` اتصالاً) مع حد أدنى لحجم التجزئة (`min_split_kb`).
- **سرقة العمل وتقسيم الذيل (Work Stealing & Tail Splitting):** عند انتهاء اتصال مبكراً، يقوم تلقائياً بتقسيم أكبر جزء متبقٍ إلى نصفين (حتى حد `32 KB` في نهاية التنزيل) لمنع اتصال بطيء واحد من تعطيل إتمام الملف، كما يستبدل الاتصالات شديدة البطء تلقائياً.
- **الاستئناف الآمن وحماية البيانات:** كتابة البيانات مرحلياً في ملفات `.sgpart` مؤقتة مع تخزين مؤقت للكتابة (`256 KB`) وحفظ ذري لجدول الأجزاء والحالة (`store.rs` مع نسخة احتياطية `.bak`).
- **التحقق من تغيّر الملف على الخادم:** إرسال والتحقق من `ETag` و`Last-Modified` (`If-Range`) لاكتشاف تغيّر الملف على الخادم ومنع تلف الملف النهائي.
- **إعادة المحاولة والتكيّف التلقائي:** إعادة المحاولة التلقائية عند انقطاع الشبكة، وتقليل عدد الاتصالات تلقائياً عند تلقي أخطاء حدّ الاتصالات (`HTTP 403 / 429`) ثم زيادتها تدريجياً عند استقرار الخادم.

#### 🌐 البروتوكولات المدعومة
- **HTTP و HTTPS:** عبر `reqwest` و`native-tls-alpn` (SChannel على Windows) باستخدام اتصالات `HTTP/1.1` مستقلة (`http1_only`) لضمان فتح مسار TCP حقيقي لكل قناة، مع تمرير الكوكيز، `Referer`، `User-Agent`، طلبات `POST` للنماذج، وبيانات تسجيل الدخول.
- **FTP و FTPS:** دعم FTP العادي وFTPS الصريح (`AUTH TLS` على المنفذ `21`) والضمني (المنفذ `990`) مع تنزيل متعدد الاتصالات والاستئناف عند دعم الخادم لأمر `REST`.
- **بث الفيديو HLS (`.m3u8`):** تنزيل المقاطع بعدة اتصالات، اختيار الجودة، وفك تشفير `AES-128` (`aes` + `cbc`) ودمجها إلى MP4. *(يرفض المحرك البثوث المحمية بـ DRM مثل Widevine/FairPlay والبثوث المباشرة غير المنتهية `#EXT-X-ENDLIST`).*
- **بث DASH (فيديو + صوت منفصلان):** تنزيل مساري الفيديو والصوت بشكل متوازٍ ثم دمجهما تلقائياً عبر `FFmpeg` دون إعادة ترميز.

#### 🎬 تنزيل الفيديو، قوائم التشغيل، وقص المقاطع
- **استخراج روابط الفيديو:** استخراج صيغ وجودات الفيديو والصوت عبر `yt-dlp`، مع تحديث تلقائي يومي لـ `yt-dlp.exe` والتحقق من بصمة `SHA-256`.
- **تنزيل قوائم التشغيل (Playlists):** جلب قائمة المقاطع، اختيار الجودة (`best`, `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, أو صوت فقط `M4A` / `MP3` بمعدلات `128 / 192 / 256 / 320 kbps`)، التنزيل المتوازي لعدة فيديوهات، الترقيم التلقائي، وتنزيل ملفات الترجمة (Subtitles).
- **تنزيل جزء محدد من الفيديو (Clip):** تحديد وقت البداية والنهاية (حتى 24 ساعة) ومعاينة المقطع قبل تنزيله، مع خيار **القص السريع** (Copy) أو **القص الدقيق بالثانية** (إعادة ترميز H.264 عبر `OpenH264`) باستخدام خادم نطاقات محلي (`clipserve`) و`FFmpeg`.
- **التشغيل أثناء التنزيل (Play while downloading):** فتح الملف الجاري تنزيله مباشرة في مشغل الوسائط عبر الارتباطات الصلبة (Hard Links) أو إنشاء لقطة معاينة سريعة عبر `FFmpeg` لتنزيلات DASH.

#### 🧲 دعم BitTorrent وروابط Magnet المدمج
- **محرك مدمج بدون برامج وسيطة:** يعمل عبر مكتبة `librqbit` v9.1 مباشرة داخل `DodoDM1.exe` مع دعم `DHT` وملفات `.torrent` وروابط `magnet:`.
- **إدارة متقدمة للتورنت:** معاينة ملفات التورنت واختيار الملفات المطلوبة قبل التنزيل أو أثناءه، عرض الأقران (Peers) والقطع (Pieces) والمتتبعات (Trackers)، إضافة متتبعات يدوياً، أولوية القطع الأولى والأخيرة، إعادة فحص الملفات، وتحديد مدة الرفع أو نسبة المشاركة (`Seed Ratio`) أو سرعة الرفع القصوى.
- **التكامل مع Windows:** خيار ربط ملفات `.torrent` وروابط `magnet:` بـ DODO DM1، وتعقيم أسماء المسارات الخطرة على Windows (`SafeFiles`).

#### 🕸️ جامع المواقع، التحميل الدُفعي، وإدارة القوائم
- **جامع المواقع (Site Grabber):** استكشاف صفحات الويب بعمق قابل للتحديد (`depth`) وتوازي من `1` إلى `10` صفحات، مع خيارات البقاء ضمن نفس الموقع أو المجلد، الاستعلام عن الأسماء والأحجام الحقيقية، والتصفية حسب النوع (صور، فيديو، صوت، برامج وأرشيف، مستندات، صفحات ويب).
- **التحميل الدُفعي (Batch Download):** إضافة قائمة روابط دفعة واحدة أو توليد روابط متسلسلة باستخدام `*` (أرقام مع أصفار بادئة أو حروف حتى `10,000` ملف).
- **الاستيراد والتصدير:** دعم استيراد وتصدير قوائم التنزيل بصيغتي `.ef2` و`.txt`، مع دعم السحب والإفلات (Drag & Drop) ومراقبة الحافظة التلقائية (`Clipboard Monitor`).

#### ⏱️ قوائم الانتظار، المجدول، والتحكم في الشبكة
- **قوائم الانتظار والجدولة:** إنشاء وإدارة عدة قوائم انتظار بحد تزامن مخصص ومجلد حفظ وعدد محاولات، وجدولة البدء والإيقاف يومياً/أسبوعياً أو لمرة واحدة، مع خيار بدء القائمة عند تشغيل البرنامج وإيقاظ الحاسوب من السكون (`Wake`).
- **إجراءات ما بعد الاكتمال:** فتح الملف، فتح المجلد، إغلاق البرنامج، السكون (`Sleep`)، الإسبات (`Hibernate`)، أو إيقاف التشغيل (`Shutdown`) مع عدّ تنازلي قابل للإلغاء.
- **محدد السرعة والحصص:** محدد سرعة عام ولكل ملف بخوارزمية `Token Bucket`، وخيار تطبيق الحد فقط أثناء نشاط المستخدم، وحصة استهلاك بيانات دورية (`Quota MB / Hours`)، واستثناءات عدد الاتصالات لكل خادم (`Per-Server Limits`).
- **دعم البروكسي:** الاتصال المباشر، إعدادات بروكسي Windows التلقائية، أو بروكسي `HTTP/HTTPS` يدوي مع اسم مستخدم وكلمة مرور واستثناء النطاقات.

#### 🛡️ الأمان والتكامل مع نظام Windows
- **تشفير الأسرار محلياً (DPAPI):** تشفير كلمات مرور المواقع، كلمات مرور البروكسي، الكوكيز، ومفاتيح API على القرص باستخدام `CryptProtectData` الخاص بمستخدم Windows الحالي.
- **فحص سلامة الملفات (Checksums):** دعم `MD5` و`SHA-1` و`SHA-256` و`SHA-384` و`SHA-512` تلقائياً عند الإدخال أو من ترويسات الخادم (`Repr-Digest`, `Digest`, `x-goog-hash`, `Content-MD5`)، وفحص `SHA-256` يدوياً لأي ملف مكتمل.
- **التوافق مع أمان Windows:** إضافة علامة الإنترنت (`Zone.Identifier` / Mark of the Web) على ملفات NTFS، التحقق المسبق من المساحة الحرة وحد `4 GB` على أقراص `FAT32`، ودمج اختياري لفحص الفيروسات بعد الاكتمال.
- **تكامل سطح المكتب وCLI:** أيقونة شريط النظام (System Tray)، التشغيل مع بدء Windows، الحفاظ على تاريخ الخادم (`Last-Modified`)، إشعارات صوتية `.wav`، ودعم سطر الأوامر (`/d`, `/p`, `/f`, `/a`, `/n`, `/s`).
- **محدث ذاتي موثّق:** التحقق من `version.json` وفحص بصمة `SHA-256` وتوقيع `Ed25519` (`ring`) قبل تثبيت التحديثات.

#### 🎨 واجهة مستخدم عصرية ومتعددة اللغات
- **8 لغات مدمجة:** العربية (مع دعم كامل لاتجاه اليمين لليسار **RTL**)، الإنجليزية، الفرنسية، الإسبانية، الألمانية، البرتغالية، التركية، والروسية، مع الكشف التلقائي للغة Windows.
- **13 سمة مظهر (Themes):** `Light`، `Dark`، `Ocean blue`، `Midnight purple`، `Forest green`، `Black`، `Sunset`، `Teal night`، `Rose`، `3D`، `Aurora glass`، `Soft clay`، و`Cyber neon`، مع التحكم في مقياس الخط ونوعه وتخصيص أعمدة الجدول وعرض حي لقنوات التنزيل.

---

<a id="ar-tech"></a>
### 🛠️ التقنيات ولغات البرمجة المستخدمة

| الطبقة / المكون | اللغة / التقنية | أبرز المكتبات والحزم الفعلية (من `Cargo.toml` / `Cargo.lock` / `package.json`) |
| :--- | :--- | :--- |
| **محرك التنزيل (`crates/engine`)** | Rust (Edition 2021) | `tokio` 1.53, `reqwest` 0.12 (`native-tls-alpn`), `librqbit` 9.1, `ring` 0.17, `sha2`, `aes`, `cbc`, `socket2`, `regex`, `url`, `chrono`, `filetime`, `windows-sys` 0.59 |
| **تطبيق سطح المكتب (`crates/app`)** | Rust (Edition 2021) | `wry` 0.57, `tao` 0.37 (WebView2), `tiny_http` 0.12, `tray-icon` 0.19, `rfd` 0.15, `arboard` 3.7, `sys-locale` 0.3, `open` 5.4, `winresource` 0.1 *(مع ميزة اختيارية `classic` بـ `slint` ~1.18)* |
| **الوسيط الأصلي للمتصفح (`crates/host`)** | Rust (Edition 2021) | `serde_json`, `ring` 0.17 (HMAC-SHA256), `windows-sys` 0.59 (DPAPI) |
| **واجهة المستخدم (`dodo-react-ui`)** | JavaScript / React / CSS | `react` ^18.3.1, `react-dom` ^18.3.1, `vite` ^6.0.7, `lucide-react` ^1.16.0, pure CSS *(مع وضع تشغيل بديل عبر `electron` ^33.2.1)* |
| **إضافة المتصفح (`extension`)** | JavaScript / HTML / CSS | WebExtensions Manifest V3 (`background.js`, `content.js`, `early.js`, `yt-core.js`, `popup.*`, `options.*`) |
| **الأدوات المساعدة المرفقة (`tools`)** | C / Shell / Python | `yt-dlp` (مجلوب من إصداراته الرسمية بالتحقق من SHA-256) و`ffmpeg` مخصص (`tools/ffmpeg/build.sh` مع `LAME` و`OpenH264`) |
| **التغليف والتثبيت (`installer`)** | PowerShell / Batch / Inno Setup 6 | `BUILD.bat`, `build-windows.ps1`, `installer/dodo.iss`, `installer/lang/Arabic.isl` |

---

<a id="ar-structure"></a>
### 📁 بنية المشروع ومجلداته

</div>

```text
DODO-DM1/
├── Cargo.toml                  # إعداد مساحة عمل Rust (v1.0.12) والأعضاء الثلاثة
├── Cargo.lock                  # قفل إصدارات حزم Rust (861 حزمة مقفلة)
├── BUILD.bat                   # مشغّل البناء بنقرة واحدة عبر PowerShell
├── build-windows.ps1           # سكربت التحقق من الأدوات، بناء الواجهة والمحرك، وتوليد المثبّت
├── Run-DODO-DM1-React.bat      # تشغيل البرنامج بواجهة React عبر Electron (--backend)
├── run-dodo-react.ps1          # مشغّل PowerShell لوضع Electron
├── dodo_dm1_logo.png           # شعار البرنامج الرئيسي (512x512 RGBA)
├── make_dodo_icons.py          # سكربت توليد الأيقونات بمقاسات التطبيق والإضافة
├── LICENSE                     # ملف الترخيص وحقوق الملكية المرفق في المستودع
├── THIRD-PARTY-NOTICES.txt     # إشعارات تراخيص المكونات مفتوحة المصدر المستخدمة
├── .cargo/
│   ├── config.toml             # تفعيل الربط الساكن لـ CRT (+crt-static) على Windows
│   └── audit.toml              # إعدادات تدقيق الثغرات الأمنية (cargo-audit)
├── .github/workflows/
│   └── build.yml               # ملف سير عمل GitHub Actions (يحتوي مراجع سابقة قيد التحديث)
├── crates/
│   ├── engine/                 # نواة التنزيل (HTTP/HTTPS, FTP/FTPS, HLS, BitTorrent, yt-dlp, FFmpeg, Grabber, Limiter, Checksum, DPAPI)
│   │   ├── examples/           # أمثلة مساعدة (sign_update, fault_server)
│   │   └── tests/              # اختبارات تكامل ووحدة للمحرك (download, ftp, torrent, clip, grabber, faults...)
│   ├── app/                    # التطبيق الرئيسي DodoDM1.exe (خادم WebUI، غلاف WebView2، Tray، CLI، التكامل مع Windows)
│   │   ├── lang/               # ملفات الترجمة للغات الثماني (ar, de, es, fr, pt, ru, tr)
│   │   └── ui/                 # أيقونات التطبيق وملفات Slint الاختيارية لميزة classic
│   └── host/                   # الوسيط الأصلي للمتصفح dodo-host.exe (Native Messaging stdio <-> localhost HMAC)
├── dodo-react-ui/              # واجهة React + Vite الحديثة + غلاف Electron الاختياري
│   ├── public/                 # الشعار والأيقونة
│   └── src/                    # المكونات، السمات (13 سمة)، الترجمات، وجسر الاتصال بالخلفية
├── extension/                  # إضافة المتصفح (Manifest V3 لمتصفحات Chromium + manifest.firefox.json لمتصفح Firefox)
│   └── test/                   # اختبارات ومحاكاة الإضافة بـ Node.js
├── extension-signed/           # حزمة XPI موقّعة محفوظة محلياً
├── installer/                  # سكربت المثبّت Inno Setup 6 (dodo.iss) ودعم اللغة العربية (Arabic.isl)
└── tools/
    └── ffmpeg/build.sh         # سكربت بناء نسخة FFmpeg المصغّرة لنظام Windows (مع LAME وOpenH264)
```

<div dir="rtl">

---

<a id="ar-requirements"></a>
### 💻 متطلبات التشغيل والتثبيت

#### للمستخدم النهائي (Windows)
- **نظام التشغيل:** Windows 10 / 11 بمعمارية **64-bit (`x64`)** (محدد في `installer/dodo.iss`).
- **بيئة العرض:** **Microsoft Edge WebView2 Runtime** (متوفر افتراضياً في Windows 11 ومعظم أجهزة Windows 10).
- **مكتبات التشغيل:** يتم ربط `C/C++ Runtime` سكونياً داخل `DodoDM1.exe` عبر `.cargo/config.toml` (`+crt-static`)، مما يتيح تشغيل البرنامج حتى بدون تثبيت حزمة Visual C++ Redistributable منفصلة.
- **الصلاحيات:** يثبّت البرنامج للمستخدم الحالي في `%LOCALAPPDATA%\Programs\DODO DM1` دون الحاجة لصلاحيات المسؤول (باستثناء طلب UAC اختياري عند تفعيل قاعدة جدار الحماية للتورنت أثناء التثبيت).

#### للمطورين (لبناء البرنامج من المصدر)
- نظام **Windows (x64)** مع أداة **`winget`** (مثبّت التطبيقات من متجر Microsoft) في حال الرغبة باستخدام التثبيت التلقائي في `build-windows.ps1`.
- **Visual Studio 2022 C++ Build Tools** (حزمة `Microsoft.VisualStudio.Workload.VCTools`).
- **Rust Toolchain** (`rustup` مع المسار الافتراضي `stable-msvc`).
- **Node.js و npm** (لتثبيت وبناء واجهة `dodo-react-ui` عبر `Vite`).
- **Inno Setup 6** (`ISCC.exe`) لتوليد ملف المثبّت `dist\DodoDM1-Setup.exe`.
- *(اختياري)* بيئة Linux أو WSL مع `mingw-w64` و`nasm` و`pkg-config` و`make` في حال الرغبة ببناء نسخة `ffmpeg.exe` المخصصة عبر `tools/ffmpeg/build.sh` ووضعها في `tools\ffmpeg\win64\`.

---

<a id="ar-build"></a>
### 🔨 خطوات بناء نسخة Windows

#### الطريقة الأولى: البناء والتغليف التلقائي بنقرة واحدة
يوفّر المشروع السكربتات الجاهزة `BUILD.bat` و`build-windows.ps1` التي تقوم بالتحقق من وجود `VS C++ Build Tools` و`Rust` و`Inno Setup 6` (وتثبيتها عبر `winget` عند فقدانها)، ثم بناء الواجهة، ثم ترجمة المشروع، ثم تجهيز ملفات الإضافة و`yt-dlp.exe`، وإنشاء المثبّت النهائي.

1. تأكد من تثبيت حزم واجهة React أولاً عند البناء لأول مرة من مستنسخ جديد:

</div>

```powershell
cd dodo-react-ui
npm install
cd ..
```

<div dir="rtl">

2. شغّل ملف `BUILD.bat` بالنقر المزدوج أو عبر الطرفية:

</div>

```bat
BUILD.bat
```

<div dir="rtl">

أو نفّذ سكربت PowerShell مباشرة:

</div>

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-windows.ps1
```

<div dir="rtl">

**مخرجات البناء:**
- الملف التنفيذي للبرنامج: `target\release\DodoDM1.exe`
- وسيط المتصفح: `target\release\dodo-host.exe`
- حزمة التثبيت النهائية: `dist\DodoDM1-Setup.exe`
- ملف بيانات التحديث: `dist\version.json`

> [!NOTE]
> في حال توفر بناء محلي من `ffmpeg.exe` داخل المسار `tools\ffmpeg\win64\` يقوم `build-windows.ps1` بتضمينه داخل المثبّت؛ وإلا سيعمل البرنامج ويُبقي خيارات جلب/تحديث `yt-dlp.exe` متاحة، بينما تتطلب ميزات الدمج والقص والمعاينة وجود `ffmpeg.exe` في مجلد `tools` أو `PATH`.

#### الطريقة الثانية: البناء والتشغيل اليدوي للمطورين

</div>

```powershell
# 1. بناء ملفات واجهة React (تُدمج تلقائياً داخل DodoDM1.exe عبر crates/app/build.rs)
cd dodo-react-ui
npm install
npm run build
cd ..

# 2. بناء الملفات التنفيذية بصيغة Release
cargo build --release
```

<div dir="rtl">

**أوضاع تشغيل واختبار إضافية متوفرة في المشروع:**
- **تشغيل واجهة React داخل نافذة WebView2 الأصلية:** تشغيل `target\release\DodoDM1.exe` مباشرة.
- **تشغيل واجهة React عبر Electron (وضع الخلفية):** تشغيل `Run-DODO-DM1-React.bat` أو `run-dodo-react.ps1` (يقوم بتشغيل `DodoDM1.exe --backend` وربطه بـ Electron).
- **بناء الواجهة الكلاسيكية الاختيارية (Slint):**

</div>

```powershell
cargo build --release -p dodo-dm1 --features classic
```

<div dir="rtl">

- **أوامر الاختبارات المتاحة في المستودع:**

</div>

```powershell
# اختبارات محرك التنزيل
cargo test -p swiftget-engine

# اختبارات إضافة المتصفح
node extension/test/yt-core.test.js
node extension/test/background.sim.js
```

<div dir="rtl">

---

<a id="ar-browsers"></a>
### 🌐 تكامل المتصفحات المدعومة

وفقاً لما يثبته الكود في `crates/app/src/browser.rs` و`crates/app/src/nativehost.rs` و`installer/dodo.iss` و`extension/`، يدعم البرنامج المتصفحات التالية على نظام Windows:

| المتصفح | مسار الاكتشاف والتثبيت | تسجيل Native Messaging Host (`com.dododm1.download`) |
| :--- | :--- | :--- |
| **Google Chrome** | `chrome://extensions/` | `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.dododm1.download` |
| **Microsoft Edge** | `edge://extensions/` | `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.dododm1.download` |
| **Brave** | `brave://extensions/` | `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.dododm1.download` |
| **Opera / Opera GX** | `opera://extensions` | يعتمد على مسارات ومفاتيح Chromium/Chrome |
| **Chromium** | متوافق مع حزمة Chromium | `HKCU\Software\Chromium\NativeMessagingHosts\com.dododm1.download` |
| **Mozilla Firefox** | ملف `.xpi` موقّع أو `about:debugging#/runtime/this-firefox` | `HKCU\Software\Mozilla\NativeMessagingHosts\com.dododm1.download` *(Gecko >= 140.0)* |

#### كيف يعمل الربط مع المتصفح؟
1. **القناة الأساسية — Native Messaging (`dodo-host.exe`):** يقوم التطبيق عند بدئه بتسجيل الوسيط `dodo-host.exe` في سجل Windows للمستخدم الحالي (`HKCU`). يتواصل المتصفح مع الوسيط عبر `stdio`، ويحوّل الوسيط الطلبات إلى التطبيق عبر localhost بتوقيع **HMAC-SHA256** ومفتاح محمي بـ **DPAPI**، كما يمكنه تشغيل `DodoDM1.exe --from-browser` تلقائياً إذا كان البرنامج مغلقاً.
2. **القناة الاحتياطية — HTTP محلي:** منفذ محلي (`127.0.0.1:9614` افتراضياً يوجّه إلى منفذ التطبيق الديناميكي) مع حماية عبر رأس `X-SwiftGet` والتحقق من `Host`/`Origin` ونافذة موافقة الاقتران (`PairConfirmModal`).
3. **قدرات إضافة المتصفح (`extension/`):**
   - اعتراض تنزيلات المتصفح تلقائياً وفق الامتدادات المحددة (`captureExts`) مع استثناء المواقع والروابط المحددة ومفاتيح التخطي/الإجبار (`Alt` / `Shift` أو حسب الإعدادات).
   - تمرير الكوكيز (`chrome.cookies`) و`Referer` و`User-Agent` وبيانات نماذج `POST` لتعمل التنزيلات المحمية بتسجيل الدخول.
   - فحص استباقي (`/check`) لإرجاع الروابط أحادية الاستخدام أو صفحات تسجيل الدخول إلى المتصفح بدلاً من فشلها.
   - التقاط تدفقات الفيديو والصوت و`HLS` و`DASH` وعرض زر **"Download this video"** العائم القابل للتخصيص على مشغلات الويب (مع إمكانية اختيار الجودة أو تحميل جزء من الفيديو).
   - 5 عناصر في قائمة النقر بالزر الأيمن (تنزيل الرابط، تنزيل الوسائط، تنزيل الفيديو، تنزيل جميع الروابط في الصفحة، وتنزيل الروابط المحددة).
   - أدوات تشخيص وإصلاح مدمجة داخل البرنامج من **المتصفح (`Browser Integration`)**: **Test Link** و**Repair Extension** و**Reinstall Native Host**.

> [!IMPORTANT]
> روابط المتاجر الرسمية للإضافة (`STORE_CHROME`, `STORE_EDGE`, `STORE_FIREFOX`, إلخ) غير معيّنة حالياً في `crates/app/src/browser.rs`. لذلك يتم تثبيت الإضافة في متصفحات Chromium بتفعيل **Developer mode** ثم اختيار **Load unpacked** وتحديد مجلد `extension` (يوفر البرنامج زر نسخ وفتح المسار تلقائياً).

---

<a id="ar-ui"></a>
### 🖼️ واجهة البرنامج

> [!NOTE]
> لا توجد حالياً صور لقطات شاشة (Screenshots) للواجهة مرفقة داخل ملفات المستودع (يتوفر الشعار الرسمي `dodo_dm1_logo.png` وأيقونات البرنامج فقط).

من واقع ملفات الواجهة الفعلية في `dodo-react-ui/src/`، تتكون الواجهة من:
- **شريط عنوان مخصص (`Titlebar`):** يعرض شعار DODO DM1، ومبدّل سريع للغات الثماني (مع تحوّل فوري إلى **RTL** عند اختيار العربية)، ومبدّل سريع للسمات الـ **13**، وأزرار التحكم في النافذة.
- **شريط القوائم والأدوات (`MenuBar` & `Toolbar`):** وصول سريع لإضافة رابط، التحميل الدُفعي، جامع المواقع، قوائم التشغيل، قص الفيديو، التورنت، المجدول، محدد السرعة، تكامل المتصفحات، الإعدادات، وصندوق بحث فوري.
- **الشريط الجانبي (`Sidebar`):** تصفية حسب الحالة (`كل التحميلات`، `غير مكتمل`، `مكتمل`)، التصنيفات الذكية (`مضغوطات`، `مستندات`، `صوتيات`، `برامج`، `فيديو`، `صور`، `عام`)، وقوائم الانتظار، مع عرض المساحة الحرة وحالة توفر أدوات الوسائط.
- **جدول التنزيلات (`DownloadsTable`) ونافذة التقدم (`ProgressModal`):** أعمدة قابلة للإظهار والترتيب وتغيير العرض، وعارض حي لقنوات وأجزاء التحميل المتوازية (`SegmentsVisualizer`)، وتبويبات مخصصة للتورنت (الملفات، الأقران، المتتبعات، القطع).

---

<a id="ar-faq"></a>
### ❓ الأسئلة الشائعة

<details>
<summary><b>1. هل يحتاج DODO DM1 إلى صلاحيات المسؤول (Administrator) للتثبيت أو التشغيل؟</b></summary>

لا؛ يستخدم المثبّت (`installer/dodo.iss`) الوضع `PrivilegesRequired=lowest` ويثبّت الملفات في مجلد المستخدم المحلي `%LOCALAPPDATA%\Programs\DODO DM1`، كما تُحفظ مفاتيح المتصفحات وبدء التشغيل في `HKCU`. يظهر طلب صلاحيات UAC فقط إذا اخترت السماح للتورنت عبر جدار حماية Windows أثناء التثبيت.

</details>

<details>
<summary><b>2. لماذا تُضاف الإضافة في Chrome وEdge عبر وضع المطورين (Developer Mode)؟</b></summary>

بحسب `crates/app/src/browser.rs`، لم يتم ربط معرّفات المتاجر المنشورة بعد (`STORE_CHROME`, `STORE_EDGE`, إلخ). لهذا يفتح البرنامج صفحة الإضافات في المتصفح وينسخ مسار مجلد `extension` إلى الحافظة لتحميلها عبر **Load unpacked**، بينما يدعم Firefox ملف `.xpi` موقّعاً عند توفره أو التحميل المؤقت عبر `about:debugging`.

</details>

<details>
<summary><b>3. هل يدعم البرنامج تنزيل البثوث المباشرة (Live) أو الفيديوهات المحمية بـ DRM؟</b></summary>

لا. في `crates/engine/src/hls.rs` يرفض المحرك قصداً البثوث المشفرة بأنظمة DRM (مثل `SAMPLE-AES` و`Widevine` و`FairPlay`) وكذلك البثوث المباشرة التي لا تحتوي على نهاية (`#EXT-X-ENDLIST`).

</details>

<details>
<summary><b>4. ماذا يحدث إذا قام برنامج الحماية بحذف yt-dlp.exe أو ffmpeg.exe؟</b></summary>

يفحص المحرك (`crates/engine/src/tools.rs`) مجلد `tools` ومجلد بيانات البرنامج `%APPDATA%\Dodo\DodoDM1\data\tools`. يقوم البرنامج بتحديث وفحص `yt-dlp.exe` تلقائياً مع التحقق الصارم من بصمة `SHA-256`. أما `ffmpeg.exe` فيجب وضعه في مجلد `tools` (أو في `PATH`) عند البناء اليدوي.

</details>

<details>
<summary><b>5. ما الفرق بين تشغيل DodoDM1.exe مباشرة وتشغيل Run-DODO-DM1-React.bat؟</b></summary>

تشغيل `DodoDM1.exe` مباشرة يفتح واجهة React مدمجةً داخل نافذة **WebView2** أصلية دون الحاجة لـ Node.js أو Electron عند المستخدم النهائي. أما `Run-DODO-DM1-React.bat` فيُستخدم في بيئة التطوير لتشغيل `DodoDM1.exe --backend` وعرض الواجهة عبر **Electron**. كما توجد ميزة `--features classic` لبناء واجهة **Slint** الاختيارية.

</details>

---

<a id="ar-issues"></a>
### 🐛 الإبلاغ عن المشاكل وطلبات التطوير

نرحب بتقارير الأخطاء واقتراحات الميزات الجديدة عبر صفحة **GitHub Issues** الرسمية:

- 🔗 **[فتح بلاغ أو طلب ميزة جديدة](https://github.com/abooday912022-ai/DodoDM1/issues)**

لتسريع تشخيص المشكلة، يُفضّل إرفاق:
1. إصدار نظام **Windows** وإصدار **DODO DM1** (المعروض في `حول DODO DM1`).
2. خطوات واضحة لإعادة إنتاج المشكلة.
3. السجلات ذات الصلة (إن وُجدت) من مجلد بيانات البرنامج بعد إخفاء أي روابط أو بيانات خاصة:
   - `%APPDATA%\Dodo\DodoDM1\data\events.log`
   - `%APPDATA%\Dodo\DodoDM1\data\crash.log`

---

<a id="ar-releases"></a>
### 📦 الإصدارات (Releases)

يمكن متابعة الإصدارات الرسمية المنشورة عند توفرها عبر صفحة الإصدارات في المستودع:

- 🔗 **[صفحة Releases على GitHub](https://github.com/abooday912022-ai/DodoDM1/releases)**

عند بناء المشروع محلياً باستخدام `BUILD.bat` أو `build-windows.ps1`، يتم إنشاء المثبّت في `dist\DodoDM1-Setup.exe` مع ملف التعريف `dist\version.json`.

---

<a id="ar-license"></a>
### 📄 الترخيص وإشعارات الطرف الثالث

- راجع ملف [**LICENSE**](LICENSE) للاطلاع على شروط حقوق النشر والملكية المرفقة في المستودع *(ملاحظة: يذكر ملف `Cargo.toml` القيمة `license = "MIT"` بينما يحتوي ملف `LICENSE` الحالي على نص حقوق محفوظة الخاص بـ Ezoo Tech؛ يُرجى مراجعة الملفين قبل إعادة التوزيع)*.
- راجع ملف [**THIRD-PARTY-NOTICES.txt**](THIRD-PARTY-NOTICES.txt) للاطلاع على تراخيص المكونات مفتوحة المصدر المضمنة (`yt-dlp`, `FFmpeg`, `LAME`, `OpenH264`, `librqbit`, `Slint`, وحزم Rust).

</div>

---

<a id="english-docs"></a>

## 🇺🇸 English Documentation

### 📖 Overview

**DODO DM1** is a Windows (**x64**) desktop download manager combining an asynchronous **Rust** core (`swiftget-engine`) with a modern **React 18** interface hosted inside a native **WebView2** shell (`wry` / `tao`), alongside an optional **Electron** development launcher.

It provides dynamic multi-connection segmentation, crash-safe resume, support for `HTTP/HTTPS`, `FTP/FTPS`, `HLS (.m3u8)`, and `DASH` streams, built-in **BitTorrent / Magnet** downloading via `librqbit`, media extraction and clip cutting via `yt-dlp` and `ffmpeg`, a recursive site grabber, multi-queue scheduling, bandwidth limiting, and browser extension integration via **Native Messaging**.

---

### 📑 Table of Contents

- [✨ Verified Features](#en-features)
- [🛠️ Tech Stack & Languages](#en-tech)
- [📁 Project Structure](#en-structure)
- [💻 System & Build Requirements](#en-requirements)
- [🔨 Building for Windows](#en-build)
- [🌐 Browser Integration](#en-browsers)
- [🖼️ User Interface](#en-ui)
- [❓ Frequently Asked Questions](#en-faq)
- [🐛 Bug Reports & Feature Requests](#en-issues)
- [📦 Releases](#en-releases)
- [📄 License & Third-Party Notices](#en-license)

---

<a id="en-features"></a>
### ✨ Verified Features

#### ⚡ Multi-Connection Engine & Crash-Safe Resume
- **Dynamic Segmentation:** Splits downloads across `32` connections by default (configurable from `1` to `64`), governed by `min_split_kb`.
- **Work Stealing & Tail Splitting:** Idle workers automatically split the largest remaining active segment in half (down to `32 KB` tail segments) and replace stalled or underperforming connections so slow peers do not bottleneck completion.
- **Safe Partial Writes & Atomic Persistence:** Writes chunks into temporary `.sgpart` files with `256 KB` buffered coalesced writes and atomic JSON state persistence (`.bak` backup via `store.rs`).
- **Server Change Protection:** Tracks `ETag` and `Last-Modified` (`If-Range`) on resume to detect remote file modifications and avoid corrupting partial files.
- **Adaptive Rate Backoff:** Automatically retries network drops and throttles connection counts if a server rejects concurrent requests (`HTTP 403 / 429`), probing upward again after stabilization.

#### 🌐 Supported Protocols
- **HTTP & HTTPS:** Built on `reqwest` with `native-tls-alpn` (Windows SChannel) using dedicated `HTTP/1.1` TCP connections (`http1_only`) with title-case ordered headers, supporting cookies, `Referer`, `User-Agent`, form `POST` downloads, and saved site credentials.
- **FTP & FTPS:** Supports plain FTP, explicit FTPS (`AUTH TLS` on port `21`), and implicit FTPS (port `990`), with multi-connection segmented resume when the server supports `REST`.
- **HLS Streams (`.m3u8`):** Multi-connection segment downloading, variant selection, `AES-128` decryption (`aes` + `cbc`), and MP4 assembly. *(DRM-protected streams such as Widevine/FairPlay and unclosed live streams without `#EXT-X-ENDLIST` are intentionally refused.)*
- **DASH Media:** Parallel download of separated video and audio streams followed by lossless `FFmpeg` muxing.

#### 🎬 Video, Playlists & Clip Cutting
- **Media Extraction:** Resolves video/audio formats and qualities through `yt-dlp` (with daily `SHA-256`-verified auto-updates for `yt-dlp.exe`).
- **Playlist Downloader:** Fetches playlists, queues multiple videos in parallel with numbering and optional subtitles, and supports quality presets (`best`, `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, audio-only `M4A`, or `MP3` at `128 / 192 / 256 / 320 kbps`).
- **Download a Part of a Video (`Clip`):** Downloads and cuts only the chosen `[start, end]` time range (up to 24 hours) via an internal range proxy (`clipserve`) and `FFmpeg`—supporting both fast stream copy and frame-accurate H.264 re-encoding (`OpenH264`), plus pre-download clip preview.
- **Play While Downloading:** Launches in-progress media in the system player using file associations or hard links, or builds a quick playable `FFmpeg` snapshot for DASH streams.

#### 🧲 Integrated BitTorrent & Magnet Support
- **Built-in Torrent Engine:** Powered directly by `librqbit` v9.1 inside `DodoDM1.exe` (no external `aria2c` process), supporting `.torrent` files, `magnet:` links, and `DHT`.
- **Granular Controls:** File inspection and selective file downloading before and during transfers, live Peers/Pieces/Trackers views, custom tracker addition, first/last piece priority, piece recheck, configurable seeding duration / ratio / upload cap, and Windows `.torrent` / `magnet:` association with Windows-safe path sanitization (`SafeFiles`).

#### 🕸️ Site Grabber, Batch Downloads & Lists
- **Site Grabber:** Crawls web pages with configurable link depth, same-site and no-parent filters, `1..10` concurrent page workers, real filename/size probing, and category filters (Images, Video, Audio, Programs & Archives, Documents, Web Pages).
- **Batch Download:** Accepts pasted link lists or wildcard patterns (`*` numeric padding or alphabetic ranges up to `10,000` URLs).
- **Import/Export & Capture:** Imports and exports `.ef2` and `.txt` download lists, supports window drag-and-drop, and offers optional clipboard URL monitoring.

#### ⏱️ Queues, Scheduler & Bandwidth Control
- **Multiple Queues & Scheduling:** Per-queue max parallel downloads, target directory, retry count, one-time or weekday recurring start/stop schedules, run-on-startup, and optional system wake-from-sleep (`Wake`).
- **After-Completion Actions:** Open file, open folder, exit app, `Sleep`, `Hibernate`, or `Shutdown` with a cancelable countdown prompt.
- **Speed Limiter & Quotas:** Global and per-download token-bucket rate limiting (`SpeedLimiter`), optional "limit only while computer is active" mode, periodic bandwidth quota alerts/caps (`Quota MB / Hours`), and per-server max connection rules.
- **Proxy Support:** Direct connection, Windows system proxy, or manual `HTTP/HTTPS` proxy with authentication and host bypass list.

#### 🛡️ Security & Windows Integration
- **Local Secret Encryption (DPAPI):** Encrypts site logins, proxy passwords, cookies, HTTP auth credentials, and internal API tokens at rest via Windows `CryptProtectData`.
- **Checksum Verification:** Automatic verification against user-supplied hashes or server headers (`Repr-Digest`, `Digest`, `x-goog-hash`, `Content-MD5`) supporting `MD5`, `SHA-1`, `SHA-256`, `SHA-384`, and `SHA-512`, plus manual on-demand `SHA-256` checks.
- **Windows Safety & Utilities:** Writes NTFS Mark of the Web (`Zone.Identifier`), checks disk free space and `FAT32` 4 GB limits before downloading, supports optional post-download antivirus CLI scanning, preserves server `Last-Modified` timestamps, plays `.wav` notifications, integrates with the Windows System Tray and autostart (`HKCU\...\Run`), and accepts CLI arguments (`/d`, `/p`, `/f`, `/a`, `/n`, `/s`).
- **Signed Self-Updater:** Checks `version.json` and verifies both `SHA-256` and an `Ed25519` signature (`ring`) before launching an update installer.

#### 🎨 Modern Multilingual UI
- **8 Languages:** Arabic (with full **RTL** layout), English, French, Spanish, German, Portuguese, Turkish, and Russian, with automatic Windows locale detection.
- **13 Built-in Themes:** `Light`, `Dark`, `Ocean blue`, `Midnight purple`, `Forest green`, `Black`, `Sunset`, `Teal night`, `Rose`, `3D`, `Aurora glass`, `Soft clay`, and `Cyber neon`, with font scaling, custom font family, customizable columns, and a live download segments visualizer.

---

<a id="en-tech"></a>
### 🛠️ Tech Stack & Languages

| Component | Language / Runtime | Verified Libraries & Tools (`Cargo.toml` / `Cargo.lock` / `package.json`) |
| :--- | :--- | :--- |
| **Download Engine (`crates/engine`)** | Rust (Edition 2021) | `tokio` 1.53, `reqwest` 0.12 (`native-tls-alpn`), `librqbit` 9.1, `ring` 0.17, `sha2`, `aes`, `cbc`, `socket2`, `regex`, `url`, `chrono`, `filetime`, `windows-sys` 0.59 |
| **Desktop App (`crates/app`)** | Rust (Edition 2021) | `wry` 0.57, `tao` 0.37 (WebView2), `tiny_http` 0.12, `tray-icon` 0.19, `rfd` 0.15, `arboard` 3.7, `sys-locale` 0.3, `open` 5.4, `winresource` 0.1 *(optional `classic` feature with `slint` ~1.18)* |
| **Native Messaging Host (`crates/host`)** | Rust (Edition 2021) | `serde_json`, `ring` 0.17 (HMAC-SHA256), `windows-sys` 0.59 (DPAPI) |
| **Desktop Frontend (`dodo-react-ui`)** | JavaScript / React / CSS | `react` ^18.3.1, `react-dom` ^18.3.1, `vite` ^6.0.7, `lucide-react` ^1.16.0, pure CSS *(optional `electron` ^33.2.1 launcher)* |
| **Browser Extension (`extension`)** | JavaScript / HTML / CSS | WebExtensions Manifest V3 (`background.js`, `content.js`, `early.js`, `yt-core.js`, `popup.*`, `options.*`) |
| **Media Helpers (`tools`)** | C / Bash / Python | `yt-dlp` (fetched from official releases with SHA-256 check) & minimal custom `ffmpeg` (`tools/ffmpeg/build.sh` with `LAME` & `OpenH264`) |
| **Build & Installer (`installer`)** | PowerShell / Batch / Inno Setup 6 | `BUILD.bat`, `build-windows.ps1`, `installer/dodo.iss`, `installer/lang/Arabic.isl` |

---

<a id="en-structure"></a>
### 📁 Project Structure

```text
DODO-DM1/
├── Cargo.toml                  # Rust workspace manifest (v1.0.12; members: engine, app, host)
├── Cargo.lock                  # Locked dependency graph (861 packages)
├── BUILD.bat                   # One-click Windows build launcher
├── build-windows.ps1           # Full build & Inno Setup packaging script
├── Run-DODO-DM1-React.bat      # Electron launcher for React UI (--backend mode)
├── run-dodo-react.ps1          # PowerShell wrapper for Electron launcher
├── dodo_dm1_logo.png           # Application logo (512x512 RGBA)
├── make_dodo_icons.py          # Icon generation script for desktop & extension assets
├── LICENSE                     # Repository license notice
├── THIRD-PARTY-NOTICES.txt     # Open-source component notices
├── .cargo/
│   ├── config.toml             # Enables static CRT (+crt-static) on Windows MSVC targets
│   └── audit.toml              # cargo-audit advisory configuration
├── .github/workflows/
│   └── build.yml               # GitHub Actions workflow (contains legacy references pending update)
├── crates/
│   ├── engine/                 # Core downloader (HTTP/HTTPS, FTP/FTPS, HLS, BitTorrent, yt-dlp, FFmpeg, Grabber, Limiter, Checksum, DPAPI)
│   │   ├── examples/           # Helper examples (sign_update, fault_server)
│   │   └── tests/              # Engine integration tests (download, ftp, torrent, clip, grabber, faults...)
│   ├── app/                    # Desktop binary DodoDM1.exe (WebUI HTTP bridge, WebView2 shell, Tray, CLI, Windows integration)
│   │   ├── lang/               # Translation files for 8 languages (ar, de, es, fr, pt, ru, tr)
│   │   └── ui/                 # App icons and optional Slint UI files (--features classic)
│   └── host/                   # Native Messaging helper dodo-host.exe (stdio <-> authenticated localhost bridge)
├── dodo-react-ui/              # React 18 + Vite UI + optional Electron main/preload scripts
│   ├── public/                 # Public logo and favicon
│   └── src/                    # UI components, 13 themes, translation helpers, backend REST client
├── extension/                  # WebExtension (Manifest V3 for Chromium + manifest.firefox.json for Firefox)
│   └── test/                   # Node.js unit and simulation tests
├── extension-signed/           # Locally stored signed Firefox XPI artifact
├── installer/                  # Inno Setup 6 script (dodo.iss) and Arabic localization (Arabic.isl)
└── tools/
    └── ffmpeg/build.sh         # Cross-compile script for minimal static Windows ffmpeg.exe (LAME + OpenH264)
```

---

<a id="en-requirements"></a>
### 💻 System & Build Requirements

#### End-User Runtime (Windows)
- **OS:** Windows 10 / 11 **64-bit (`x64`)** (enforced by `installer/dodo.iss`).
- **WebView Runtime:** **Microsoft Edge WebView2 Runtime** (pre-installed on Windows 11 and most Windows 10 systems).
- **C++ Runtime:** `DodoDM1.exe` statically links the MSVC C/C++ runtime (`+crt-static` in `.cargo/config.toml`), so it runs without a separate Visual C++ Redistributable installation.
- **Privileges:** Per-user installation under `%LOCALAPPDATA%\Programs\DODO DM1` (`PrivilegesRequired=lowest`); administrator elevation is only requested if you opt into adding the Windows Firewall rule for torrents during setup.

#### Developer / Build Prerequisites
- **Windows (x64)** with **`winget`** (for automatic installation of missing dependencies via `build-windows.ps1`).
- **Visual Studio 2022 C++ Build Tools** (`Microsoft.VisualStudio.Workload.VCTools`).
- **Rust Toolchain** (`rustup`, `stable-msvc`, Edition 2021).
- **Node.js & npm** (to install dependencies and build `dodo-react-ui` via `Vite`).
- **Inno Setup 6** (`ISCC.exe`) to compile `dist\DodoDM1-Setup.exe`.
- *(Optional)* Linux/WSL with `mingw-w64`, `nasm`, `pkg-config`, and `make` to build a minimal static `ffmpeg.exe` via `tools/ffmpeg/build.sh` (placed in `tools\ffmpeg\win64\`).

---

<a id="en-build"></a>
### 🔨 Building for Windows

#### Option 1: One-Click Build & Installer Script
`BUILD.bat` invokes `build-windows.ps1`, which verifies/installs Visual Studio C++ Build Tools, Rust, and Inno Setup 6, builds `dodo-react-ui`, compiles the Rust workspace in release mode, downloads `yt-dlp.exe` (SHA-256 verified), stages the extensions and optional `ffmpeg.exe`, and builds the setup executable.

1. On a fresh clone, install the frontend dependencies first:

```powershell
cd dodo-react-ui
npm install
cd ..
```

2. Run `BUILD.bat` (or invoke `build-windows.ps1` directly):

```bat
BUILD.bat
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-windows.ps1
```

**Build Outputs:**
- Desktop application: `target\release\DodoDM1.exe`
- Native Messaging host: `target\release\dodo-host.exe`
- Windows installer: `dist\DodoDM1-Setup.exe`
- Update metadata manifest: `dist\version.json`

> [!NOTE]
> If a prebuilt `ffmpeg.exe` exists in `tools\ffmpeg\win64\`, `build-windows.ps1` bundles it into `tools\`; otherwise, FFmpeg-dependent operations (DASH muxing, video clipping, snapshot previews) require `ffmpeg.exe` to be placed in the `tools` folder or available on `PATH`.

#### Option 2: Manual Developer Build & Run

```powershell
# 1. Build React UI assets (embedded into DodoDM1.exe by crates/app/build.rs)
cd dodo-react-ui
npm install
npm run build
cd ..

# 2. Build Rust release binaries
cargo build --release
```

**Additional Launch & Test Commands:**
- **Native WebView2 UI:** Run `target\release\DodoDM1.exe` directly.
- **Electron Launcher Mode:** Run `Run-DODO-DM1-React.bat` or `run-dodo-react.ps1` (spawns `DodoDM1.exe --backend`).
- **Optional Classic Slint UI:**

```powershell
cargo build --release -p dodo-dm1 --features classic
```

- **Available Test Suites:**

```powershell
# Rust download engine tests
cargo test -p swiftget-engine

# Browser extension unit & simulation tests
node extension/test/yt-core.test.js
node extension/test/background.sim.js
```

---

<a id="en-browsers"></a>
### 🌐 Browser Integration

As implemented in `crates/app/src/browser.rs`, `crates/app/src/nativehost.rs`, `installer/dodo.iss`, and `extension/`, DODO DM1 supports the following browsers on Windows:

| Browser | Extension Setup Target | Native Messaging Registry Key (`com.dododm1.download`) |
| :--- | :--- | :--- |
| **Google Chrome** | `chrome://extensions/` | `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.dododm1.download` |
| **Microsoft Edge** | `edge://extensions/` | `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.dododm1.download` |
| **Brave** | `brave://extensions/` | `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.dododm1.download` |
| **Opera / Opera GX** | `opera://extensions` | Uses Chromium/Chrome host lookup |
| **Chromium** | Unpacked Chromium extension | `HKCU\Software\Chromium\NativeMessagingHosts\com.dododm1.download` |
| **Mozilla Firefox** | Signed `.xpi` or `about:debugging#/runtime/this-firefox` | `HKCU\Software\Mozilla\NativeMessagingHosts\com.dododm1.download` *(Gecko >= 140.0)* |

#### How Browser Communication Works
1. **Primary Channel — Native Messaging (`dodo-host.exe`):** At startup, `DodoDM1.exe` installs a content-hashed copy of `dodo-host.exe` into `%APPDATA%\Dodo\DodoDM1\data\host` and registers the `com.dododm1.download` manifests under `HKCU`. Requests pass via browser stdio and are forwarded locally with **HMAC-SHA256** signatures using the user's **DPAPI**-protected key. If the desktop app is closed when you start a download, `dodo-host.exe` automatically launches `DodoDM1.exe --from-browser`.
2. **Fallback Channel — Local HTTP API:** Listens on `127.0.0.1` (`9614` default port routing to the app's dynamic `api_port`), protected by `X-SwiftGet` headers, strict `Host`/`Origin` validation, and an interactive pairing confirmation modal.
3. **Extension Capabilities (`extension/`):**
   - Automatic download interception via `chrome.downloads` respecting configured extensions (`captureExts`), skipped sites/URLs, minimum size, and hold-to-skip/force modifier keys.
   - Forwards browser cookies, `Referer`, `User-Agent`, and `POST` form bodies for authenticated downloads.
   - Pre-flight check (`/check`) hands one-time or login-gated browser links back to the browser rather than failing.
   - Captures streaming video/audio/HLS/DASH traffic (`yt-core.js` + `webRequest`) and injects a customizable floating **"Download this video"** panel onto web video players (including clip selection).
   - Adds 5 right-click context menu actions (link, media, page video, all page links, selected links).
   - Built-in diagnostics in the app's **Browser Integration** dialog: **Test Link**, **Repair Extension**, and **Reinstall Native Host**.

> [!IMPORTANT]
> Browser web-store URLs (`STORE_CHROME`, `STORE_EDGE`, `STORE_FIREFOX`, etc.) are currently empty in `crates/app/src/browser.rs`. Chromium-based browsers load the local `extension` folder via **Developer mode → Load unpacked** (the app copies the folder path to your clipboard automatically), while Firefox uses a Mozilla-signed `.xpi` when bundled or temporary loading via `about:debugging`.

---

<a id="en-ui"></a>
### 🖼️ User Interface

> [!NOTE]
> No UI screenshot images are currently included in this repository (only the application logo `dodo_dm1_logo.png` and icons are present).

Based on the frontend implementation in `dodo-react-ui/src/`, the desktop UI includes:
- **Custom Titlebar:** Displays the DODO DM1 logo, instant switcher across **8 languages** (switching dynamically to **RTL** for Arabic), instant selector for **13 themes**, and native window controls.
- **Menu Bar & Toolbar:** Quick access to Add URL, Add Batch, Site Grabber, Playlist, Video Part, Torrent, Scheduler, Speed Limiter, Browsers, Options, and live search filtering.
- **Sidebar:** Filters by status (`All Downloads`, `Unfinished`, `Finished`), smart categories (`Compressed`, `Documents`, `Music`, `Programs`, `Video`, `Images`, `General`), and custom queues, plus free disk space and `yt-dlp`/`ffmpeg` readiness indicators.
- **Downloads Table & Progress Modal:** Customizable columns (visibility, order, width), live parallel channel/segment progress visualizer (`SegmentsVisualizer`), and dedicated Torrent inspection tabs (Files, Peers, Trackers, Pieces).

---

<a id="en-faq"></a>
### ❓ Frequently Asked Questions

<details>
<summary><b>1. Does DODO DM1 require Administrator privileges?</b></summary>

No. `installer/dodo.iss` specifies `PrivilegesRequired=lowest` and installs per-user into `%LOCALAPPDATA%\Programs\DODO DM1`. Registry keys for autostart, torrent associations, and Native Messaging live under `HKCU`. UAC elevation is only prompted if you opt into adding the Windows Firewall inbound rule for torrents during installation.

</details>

<details>
<summary><b>2. Why must Chromium extensions be loaded in Developer Mode?</b></summary>

Store listing URLs (`STORE_CHROME`, `STORE_EDGE`, etc.) in `crates/app/src/browser.rs` are not yet published. Until published on browser extension stores, DODO DM1 opens the browser extensions page and copies the path of its bundled `extension` folder so you can load it via **Load unpacked**.

</details>

<details>
<summary><b>3. Are live streams or DRM-protected videos supported?</b></summary>

No. `crates/engine/src/hls.rs` intentionally refuses DRM-encrypted streams (`SAMPLE-AES`, `Widevine`, `FairPlay`, etc.) and live playlists that lack `#EXT-X-ENDLIST`.

</details>

<details>
<summary><b>4. What if yt-dlp.exe or ffmpeg.exe is missing?</b></summary>

`crates/engine/src/tools.rs` checks the `tools\` folder next to `DodoDM1.exe` and `%APPDATA%\Dodo\DodoDM1\data\tools`. DODO DM1 automatically downloads and updates `yt-dlp.exe` with `SHA-256` verification. For `ffmpeg.exe`, place a binary (or build one via `tools/ffmpeg/build.sh`) in `tools\` or on your system `PATH`.

</details>

<details>
<summary><b>5. What is the difference between DodoDM1.exe, Run-DODO-DM1-React.bat, and --features classic?</b></summary>

Running `DodoDM1.exe` launches the built-in React UI inside a native Windows **WebView2** window (`wry` + `tao`) with no Node.js/Electron runtime required. `Run-DODO-DM1-React.bat` runs `DodoDM1.exe --backend` inside **Electron** for development/testing, while `cargo build --features classic` compiles the optional legacy **Slint** desktop UI.

</details>

---

<a id="en-issues"></a>
### 🐛 Bug Reports & Feature Requests

Please report bugs or propose enhancements via **GitHub Issues**:

- 🔗 **[Open a New Issue](https://github.com/abooday912022-ai/DodoDM1/issues)**

When filing a bug report, include:
1. Your **Windows version** and **DODO DM1 version**.
2. Clear steps to reproduce the issue.
3. Relevant logs (after redacting any private URLs or personal paths) from:
   - `%APPDATA%\Dodo\DodoDM1\data\events.log`
   - `%APPDATA%\Dodo\DodoDM1\data\crash.log`

---

<a id="en-releases"></a>
### 📦 Releases

Published installers and release notes (when available) can be viewed on the GitHub Releases page:

- 🔗 **[GitHub Releases](https://github.com/abooday912022-ai/DodoDM1/releases)**

Building locally via `BUILD.bat` or `build-windows.ps1` produces `dist\DodoDM1-Setup.exe` and `dist\version.json`.

---

<a id="en-license"></a>
### 📄 License & Third-Party Notices

- See [**LICENSE**](LICENSE) for the repository's copyright and distribution terms *(note: `Cargo.toml` specifies `license = "MIT"`, while the current `LICENSE` file contains an "All rights reserved" notice referencing Ezoo Tech; please review both files before redistributing)*.
- See [**THIRD-PARTY-NOTICES.txt**](THIRD-PARTY-NOTICES.txt) for licenses of bundled and linked open-source components (`yt-dlp`, `FFmpeg`, `LAME`, `OpenH264`, `librqbit`, `Slint`, and Rust crates).
