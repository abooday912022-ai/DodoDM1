; DODO DM1 — Windows installer (Inno Setup 6)
; Built automatically by BUILD.bat -> dist\DodoDM1-Setup.exe
;
; Installs for the current user (no admin needed) into
;   %LOCALAPPDATA%\Programs\DODO DM1
; so yt-dlp can update itself. Adds a Start Menu folder, an optional desktop
; shortcut, "start with Windows", and a normal uninstaller.

#define MyAppName "DODO DM1"
#define MyAppExe "DodoDM1.exe"
; BUILD.bat passes the version of Cargo.toml: /DMyAppVersion=1.0.1
; the files that go into the setup (gathered by BUILD.bat / the CI)
#ifndef Stage
  #define Stage "..\build-cache\stage"
#endif
#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif

[Setup]
AppId={{D0D00001-2925-4FD9-8CE9-728BE9C5D7E4}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher=DODO
DefaultDirName={localappdata}\Programs\DODO DM1
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=DodoDM1-Setup
#ifndef NoIcon
SetupIconFile=..\crates\app\icon.ico
#endif
UninstallDisplayIcon={app}\{#MyAppExe}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany=DODO
VersionInfoDescription=DODO DM1 Setup
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoCopyright=Copyright (C) 2026 DODO DM1
AppPublisherURL=https://dodo-dm1.local
UninstallDisplayName={#MyAppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no

; the language of the setup is also the language of the program: asked
; once, at the first install (Windows' own language is chosen at first);
; an update keeps it and asks nothing
ShowLanguageDialog=yes
UsePreviousLanguage=yes
LanguageDetectionMethod=uilanguage

[Languages]
; the names are the program's own language codes (see [Registry])
Name: "en"; MessagesFile: "compiler:Default.isl"
#if FileExists(AddBackslash(CompilerPath) + "Languages\Arabic.isl")
Name: "ar"; MessagesFile: "compiler:Languages\Arabic.isl"
#else
Name: "ar"; MessagesFile: "lang\Arabic.isl"
#endif
Name: "fr"; MessagesFile: "compiler:Languages\French.isl"
Name: "de"; MessagesFile: "compiler:Languages\German.isl"
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "pt"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "ru"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "tr"; MessagesFile: "compiler:Languages\Turkish.isl"

[CustomMessages]
en.GroupShortcuts=Shortcuts:
en.TaskDesktop=Create a desktop shortcut
en.GroupStartup=Startup:
en.TaskAutostart=Start DODO DM1 when Windows starts (recommended)
en.GroupTorrents=Torrents:
en.TaskTorrents=Make DODO DM1 the main program for torrents (.torrent files and magnet links)
en.TaskFirewall=Let torrents through the Windows firewall (faster torrents; Windows asks for permission once)
en.RunNow=Open DODO DM1 now
en.SystemFiles=Installing required system files...
ar.GroupShortcuts=الاختصارات:
ar.TaskDesktop=إنشاء اختصار على سطح المكتب
ar.GroupStartup=بدء التشغيل:
ar.TaskAutostart=تشغيل DODO DM1 مع بدء Windows (مُستحسن)
ar.GroupTorrents=التورنت:
ar.TaskTorrents=جعل DODO DM1 البرنامج الرئيسي للتورنت (ملفات ‎.torrent وروابط magnet)
ar.TaskFirewall=السماح للتورنت بالمرور من جدار حماية Windows (تورنت أسرع؛ يطلب Windows الإذن مرة واحدة)
ar.RunNow=فتح DODO DM1 الآن
ar.SystemFiles=جارٍ تثبيت ملفات النظام المطلوبة...
fr.GroupShortcuts=Raccourcis :
fr.TaskDesktop=Créer un raccourci sur le Bureau
fr.GroupStartup=Démarrage :
fr.TaskAutostart=Lancer DODO DM1 au démarrage de Windows (recommandé)
fr.GroupTorrents=Torrents :
fr.TaskTorrents=Faire d'DODO DM1 le programme principal pour les torrents (fichiers .torrent et liens magnet)
fr.TaskFirewall=Laisser passer les torrents dans le pare-feu Windows (torrents plus rapides ; Windows demande l'autorisation une fois)
fr.RunNow=Ouvrir DODO DM1 maintenant
fr.SystemFiles=Installation des fichiers système nécessaires...
de.GroupShortcuts=Verknüpfungen:
de.TaskDesktop=Desktop-Verknüpfung erstellen
de.GroupStartup=Systemstart:
de.TaskAutostart=DODO DM1 beim Start von Windows starten (empfohlen)
de.GroupTorrents=Torrents:
de.TaskTorrents=DODO DM1 zum Hauptprogramm für Torrents machen (.torrent-Dateien und Magnet-Links)
de.TaskFirewall=Torrents durch die Windows-Firewall lassen (schnellere Torrents; Windows fragt einmal um Erlaubnis)
de.RunNow=DODO DM1 jetzt öffnen
de.SystemFiles=Benötigte Systemdateien werden installiert...
es.GroupShortcuts=Accesos directos:
es.TaskDesktop=Crear un acceso directo en el escritorio
es.GroupStartup=Inicio:
es.TaskAutostart=Iniciar DODO DM1 al iniciar Windows (recomendado)
es.GroupTorrents=Torrents:
es.TaskTorrents=Hacer de DODO DM1 el programa principal para torrents (archivos .torrent y enlaces magnet)
es.TaskFirewall=Dejar pasar los torrents por el firewall de Windows (torrents más rápidos; Windows pide permiso una vez)
es.RunNow=Abrir DODO DM1 ahora
es.SystemFiles=Instalando los archivos del sistema necesarios...
pt.GroupShortcuts=Atalhos:
pt.TaskDesktop=Criar um atalho na área de trabalho
pt.GroupStartup=Inicialização:
pt.TaskAutostart=Iniciar o DODO DM1 com o Windows (recomendado)
pt.GroupTorrents=Torrents:
pt.TaskTorrents=Tornar o DODO DM1 o programa principal para torrents (arquivos .torrent e links magnet)
pt.TaskFirewall=Liberar os torrents no firewall do Windows (torrents mais rápidos; o Windows pede permissão uma vez)
pt.RunNow=Abrir o DODO DM1 agora
pt.SystemFiles=Instalando os arquivos de sistema necessários...
ru.GroupShortcuts=Ярлыки:
ru.TaskDesktop=Создать ярлык на рабочем столе
ru.GroupStartup=Автозапуск:
ru.TaskAutostart=Запускать DODO DM1 вместе с Windows (рекомендуется)
ru.GroupTorrents=Торренты:
ru.TaskTorrents=Сделать DODO DM1 основной программой для торрентов (файлы .torrent и magnet-ссылки)
ru.TaskFirewall=Пропускать торренты через брандмауэр Windows (торренты быстрее; Windows один раз спросит разрешение)
ru.RunNow=Открыть DODO DM1 сейчас
ru.SystemFiles=Установка необходимых системных файлов...
tr.GroupShortcuts=Kısayollar:
tr.TaskDesktop=Masaüstü kısayolu oluştur
tr.GroupStartup=Başlangıç:
tr.TaskAutostart=DODO DM1'ı Windows ile başlat (önerilir)
tr.GroupTorrents=Torrentler:
tr.TaskTorrents=DODO DM1'ı torrentler için ana program yap (.torrent dosyaları ve magnet bağlantıları)
tr.TaskFirewall=Torrentlerin Windows güvenlik duvarından geçmesine izin ver (daha hızlı torrentler; Windows bir kez izin ister)
tr.RunNow=DODO DM1'ı şimdi aç
tr.SystemFiles=Gerekli sistem dosyaları yükleniyor...

[Tasks]
Name: "desktopicon"; Description: "{cm:TaskDesktop}"; GroupDescription: "{cm:GroupShortcuts}"
Name: "autostart"; Description: "{cm:TaskAutostart}"; GroupDescription: "{cm:GroupStartup}"
Name: "torrents"; Description: "{cm:TaskTorrents}"; GroupDescription: "{cm:GroupTorrents}"
Name: "firewall"; Description: "{cm:TaskFirewall}"; GroupDescription: "{cm:GroupTorrents}"

[Files]
Source: "{#Stage}\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion
; the helper the browser starts (the program copies it into its data folder)
Source: "{#Stage}\dodo-host.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#Stage}\THIRD-PARTY-NOTICES.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#Stage}\LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; the helpers go into {app}\tools; the app updates them there by itself
Source: "{#Stage}\tools\*"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#Stage}\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#Stage}\extension-firefox\*"; DestDir: "{app}\extension-firefox"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#Stage}\dodo-dm1-firefox.xpi"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#Stage}\update-url.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; system runtime files, installed only when they are missing (see [Code])
#ifexist "..\build-cache\redist\vc_redist.x64.exe"
  #define HaveRedist
Source: "..\build-cache\redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: dontcopy
#endif

[InstallDelete]
; remove leftover DLLs from older builds in {app}
Type: files; Name: "{app}\DodoDM1.Core.dll"
Type: files; Name: "{app}\DodoDM1.Database.dll"
Type: files; Name: "{app}\DodoDM1.dll"
Type: files; Name: "{app}\DodoDM1.DownloadEngine.dll"
Type: files; Name: "{app}\DodoDM1.Security.dll"
Type: files; Name: "{app}\DodoDM1.Services.dll"
Type: files; Name: "{app}\DodoDM1.Updates.dll"
Type: files; Name: "{app}\e_sqlite3.dll"
Type: files; Name: "{app}\Microsoft.Data.Sqlite.dll"
Type: files; Name: "{app}\SQLitePCLRaw*.dll"
; older versions kept the helpers next to the program
Type: files; Name: "{app}\yt-dlp.exe"
Type: files; Name: "{app}\ffmpeg.exe"
; torrents are shared by the program itself now: the old helper goes
Type: files; Name: "{app}\tools\aria2c.exe"
Type: files; Name: "{app}\tools\aria2-COPYING.txt"
; the browser add-in is put in again whole: nothing of an older version
; stays behind to clash with the new one (the folder is the same, so the
; browser keeps the add-in; the program writes its key in again at start)
Type: filesandordirs; Name: "{app}\extension"
Type: filesandordirs; Name: "{app}\extension-firefox"
; the Firefox add-on of an older version never stays: only this setup's own
; one (or none) is there to be added to Firefox
Type: files; Name: "{app}\dodo-dm1-firefox.xpi"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"
Name: "{group}\Browser extension folder"; Filename: "{app}\extension"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Tasks: desktopicon

[Registry]
; tells the app the installer already decided about "start with Windows"
Root: HKCU; Subkey: "Software\Dodo\DodoDM1"; ValueType: string; ValueName: "Installed"; ValueData: "1"; Flags: uninsdeletekey
; the first start of the program takes these (its own settings win later)
Root: HKCU; Subkey: "Software\Dodo\DodoDM1"; ValueType: string; ValueName: "Language"; ValueData: "{language}"
Root: HKCU; Subkey: "Software\Dodo\DodoDM1"; ValueType: string; ValueName: "Torrents"; ValueData: "1"; Tasks: torrents
Root: HKCU; Subkey: "Software\Dodo\DodoDM1"; ValueType: string; ValueName: "Torrents"; ValueData: "0"; Tasks: not torrents
; start in the background (next to the clock) when the user signs in
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "DodoDM1"; ValueData: """{app}\{#MyAppExe}"" --background"; Flags: uninsdeletevalue; Tasks: autostart
; the browsers' entry for the program's helper (the program fills it in at
; start): gone again when DODO DM1 is removed
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\com.dododm1.download"; ValueType: none; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Chromium\NativeMessagingHosts\com.dododm1.download"; ValueType: none; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts\com.dododm1.download"; ValueType: none; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.dododm1.download"; ValueType: none; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Mozilla\NativeMessagingHosts\com.dododm1.download"; ValueType: none; Flags: uninsdeletekey
; "Open DODO DM1" in the browser add-in (ezoo-download://open). The
; address given by the browser is never passed to the program.
Root: HKCU; Subkey: "Software\Classes\ezoo-download"; ValueType: string; ValueName: ""; ValueData: "URL:DODO DM1"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\ezoo-download"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\ezoo-download\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExe},0"
Root: HKCU; Subkey: "Software\Classes\ezoo-download\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExe}"" --from-browser"

; .torrent files and magnet: links (only when chosen while installing).
; Windows may still ask once which program to use.
Root: HKCU; Subkey: "Software\Classes\.torrent\OpenWithProgids"; ValueType: string; ValueName: "DodoDM1.torrent"; ValueData: ""; Flags: uninsdeletevalue; Tasks: torrents
Root: HKCU; Subkey: "Software\Classes\.torrent"; ValueType: string; ValueName: ""; ValueData: "DodoDM1.torrent"; Flags: uninsdeletevalue; Tasks: torrents
Root: HKCU; Subkey: "Software\Classes\DodoDM1.torrent"; ValueType: string; ValueName: ""; ValueData: "Torrent file"; Flags: uninsdeletekey; Tasks: torrents
Root: HKCU; Subkey: "Software\Classes\DodoDM1.torrent\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExe},0"; Tasks: torrents
Root: HKCU; Subkey: "Software\Classes\DodoDM1.torrent\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExe}"" ""%1"""; Tasks: torrents
Root: HKCU; Subkey: "Software\Classes\magnet"; ValueType: string; ValueName: ""; ValueData: "URL:Magnet link"; Flags: uninsdeletekey; Tasks: torrents
Root: HKCU; Subkey: "Software\Classes\magnet"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""; Tasks: torrents
Root: HKCU; Subkey: "Software\Classes\magnet\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExe},0"; Tasks: torrents
Root: HKCU; Subkey: "Software\Classes\magnet\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExe}"" ""%1"""; Tasks: torrents

[Run]
Filename: "{app}\{#MyAppExe}"; Description: "{cm:RunNow}"; Flags: nowait postinstall skipifsilent
; after an automatic update: start the new version again
Filename: "{app}\{#MyAppExe}"; Flags: nowait; Check: IsAutoUpdate


[UninstallRun]
Filename: "{cmd}"; Parameters: "/C taskkill /IM {#MyAppExe} /F"; Flags: runhidden; RunOnceId: "StopDodo"
Filename: "{cmd}"; Parameters: "/C taskkill /IM dodo-host-* /F"; Flags: runhidden; RunOnceId: "StopDodoHost"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\extension"
Type: filesandordirs; Name: "{app}\extension-firefox"
Type: filesandordirs; Name: "{app}\tools"
Type: filesandordirs; Name: "{userappdata}\Dodo\DodoDM1\data\host"

[Code]
function IsAutoUpdate: Boolean;
begin
  Result := ExpandConstant('{param:AUTOUPDATE|0}') = '1';
end;

{ the Visual C++ 2015-2022 runtime (vcruntime140.dll) }
function RuntimeMissing: Boolean;
var
  Installed: Cardinal;
begin
  Result := True;
  if RegQueryDWordValue(HKLM64, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', Installed) and (Installed = 1)
     and FileExists(ExpandConstant('{sys}\vcruntime140.dll'))
     and FileExists(ExpandConstant('{sys}\vcruntime140_1.dll'))
     and FileExists(ExpandConstant('{sys}\msvcp140.dll')) then
    Result := False;
end;

procedure InstallRuntime;
var
  Code: Integer;
begin
#ifdef HaveRedist
  if not RuntimeMissing then exit;
  { an automatic update must not show any window }
  if WizardSilent then exit;
  try
    ExtractTemporaryFile('vc_redist.x64.exe');
  except
    exit;
  end;
  WizardForm.StatusLabel.Caption := CustomMessage('SystemFiles');
  { needs administrator rights: Windows asks once. If that is refused the
    program still works, it carries its own copy of these files. }
  ShellExec('runas', ExpandConstant('{tmp}\vc_redist.x64.exe'), '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, Code);
#endif
end;

{ the program takes people's connections for torrents: Windows' firewall
  lets it (needs administrator rights: Windows asks once; refused = torrents
  still work, a little slower) }
procedure AllowTorrents;
var
  Code: Integer;
  Tool: String;
begin
  if WizardSilent then exit;
  Tool := ExpandConstant('{app}\{#MyAppExe}');
  ShellExec('runas', ExpandConstant('{sys}\cmd.exe'),
    '/C netsh advfirewall firewall delete rule name="DODO DM1 torrents" >nul 2>&1 & ' +
    'netsh advfirewall firewall add rule name="DODO DM1 torrents" dir=in action=allow program="' + Tool + '" enable=yes profile=any >nul 2>&1',
    '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    InstallRuntime;
    if WizardIsTaskSelected('firewall') then
      AllowTorrents;
  end;
end;

{ true while DodoDM1.exe still runs }
function AppRunning: Boolean;
var
  Code: Integer;
begin
  Result := Exec(ExpandConstant('{cmd}'), '/C tasklist /NH /FI "IMAGENAME eq {#MyAppExe}" | find /I "{#MyAppExe}" >nul', '', SW_HIDE, ewWaitUntilTerminated, Code) and (Code = 0);
end;

{ ask the open program to close by itself: it saves the list and the
  downloads (they go on after the update). Versions before 1.0.8 don't
  know this; they are closed below. }
procedure AskAppToQuit;
var
  Http: Variant;
begin
  try
    Http := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    Http.SetTimeouts(1000, 1000, 2000, 2000);
    Http.Open('POST', 'http://127.0.0.1:9614/quit', False);
    Http.SetRequestHeader('X-SwiftGet', '1');
    Http.Send('');
  except
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code, I: Integer;
begin
  { the running program locks its files: close it before copying }
  if AppRunning then
  begin
    AskAppToQuit;
    for I := 1 to 20 do
    begin
      if not AppRunning then break;
      Sleep(500);
    end;
  end;
  if AppRunning then
  begin
    Exec(ExpandConstant('{cmd}'), '/C taskkill /IM {#MyAppExe} >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, Code);
    Sleep(2000);
  end;
  if AppRunning then
  begin
    Exec(ExpandConstant('{cmd}'), '/C taskkill /F /IM {#MyAppExe} >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, Code);
    Sleep(800);
  end;
  Result := '';
end;
