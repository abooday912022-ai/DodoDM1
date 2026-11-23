# DODO DM1 - one-click Windows build
# Installs what is missing (Visual Studio C++ Build Tools, Rust), builds
# DodoDM1.exe, gets ffmpeg + yt-dlp and makes dist\DodoDM1-Setup.exe.

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) {
    Write-Host ""
    Write-Host "ERROR: $text" -ForegroundColor Red
    Write-Host "Send a screenshot of this window to Claude." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}
function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" +
                "$env:USERPROFILE\.cargo\bin"
}

Write-Host "DODO DM1 build" -ForegroundColor Green
Write-Host "The first run downloads a few GB and can take 20-40 minutes. Later runs are fast."

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail "winget was not found. Install 'App Installer' from the Microsoft Store, then run this again."
}

# ---------------------------------------------------------------- 1. C++ build tools
Step "Checking Visual Studio C++ Build Tools"
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVc = $false
if (Test-Path $vswhere) {
    $vc = & $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vc) { $hasVc = $true }
}
if (-not $hasVc) {
    Step "Installing Visual Studio C++ Build Tools (big download, please wait; accept the admin prompt)"
    winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements `
        --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 3010) { Fail "Installing the C++ Build Tools failed (code $LASTEXITCODE)." }
} else {
    Write-Host "Found."
}

# ---------------------------------------------------------------- 2. Rust
Step "Checking Rust"
Refresh-Path
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Step "Installing Rust"
    winget install --id Rustlang.Rustup -e --accept-package-agreements --accept-source-agreements
    Refresh-Path
    if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) { Fail "Rust was installed but not found. Restart the computer and run this again." }
}
rustup default stable-msvc | Out-Null
cargo --version

# the version comes from Cargo.toml ([workspace.package] version = "...")
$version = ([regex]::Match((Get-Content (Join-Path $PSScriptRoot "Cargo.toml") -Raw), '(?m)^version\s*=\s*"([^"]+)"')).Groups[1].Value
if (-not $version) { $version = "1.0.0" }
Write-Host "Version $version"

# ---------------------------------------------------------------- 3. build
# a running copy would lock the files we replace
Get-Process DodoDM1, SwiftGet, dodo-host -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Step "Building React Desktop UI (dodo-react-ui)"
Push-Location (Join-Path $PSScriptRoot "dodo-react-ui")
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { Fail "React UI build failed (npm run build)." }
} finally {
    Pop-Location
}

Step "Building DodoDM1.exe (first time: 5-15 minutes)"
cargo build --release
if ($LASTEXITCODE -ne 0) { Fail "The build failed. Scroll up to see the first red 'error' lines." }

# ---------------------------------------------------------------- 4. package
# The result is ONE file: dist\DodoDM1-Setup.exe (+ dist\version.json
# for the GitHub release). Everything that goes into the setup is gathered
# first in build-cache\stage, which is not part of the result:
#   DodoDM1.exe, tools\yt-dlp.exe + ffmpeg.exe, extension, extension-firefox
Step "Preparing the files for the setup"
$dist = Join-Path $PSScriptRoot "dist"
$cache = Join-Path $PSScriptRoot "build-cache"
$stage = Join-Path $cache "stage"
$tools = Join-Path $stage "tools"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $dist, $stage, $tools, $cache | Out-Null
# what older builds left in dist: only the setup stays there
foreach ($old in @("DodoDM1.exe", "ffmpeg.exe", "yt-dlp.exe")) {
    Remove-Item (Join-Path $dist $old) -Force -ErrorAction SilentlyContinue
}
foreach ($old in @("extension", "portable", "store", "redist")) {
    if (Test-Path "$dist\$old") { Remove-Item -Recurse -Force "$dist\$old" }
}

Copy-Item "target\release\DodoDM1.exe" $stage -Force
# the helper the browser starts to talk to the program (no port)
Copy-Item "target\release\dodo-host.exe" $stage -Force
foreach ($name in @("extension", "extension-firefox")) {
    $to = Join-Path $stage $name
    if (Test-Path $to) { Remove-Item -Recurse -Force $to }
    Copy-Item -Recurse "extension" $to
    Remove-Item -Recurse -Force "$to\test" -ErrorAction SilentlyContinue
}
# Firefox wants its own manifest; the others ignore this file
Copy-Item -Force "$stage\extension-firefox\manifest.firefox.json" "$stage\extension-firefox\manifest.json"
Remove-Item "$stage\extension-firefox\manifest.firefox.json" -Force
Remove-Item "$stage\extension\manifest.firefox.json" -Force -ErrorAction SilentlyContinue

# yt-dlp (finds video links): downloaded once into build-cache, the app
# keeps it updated by itself afterwards
# The SHA-256 of a file from a checksum list ("<sha256>  <name>" lines), checked.
function Assert-Sha256($file, $sumsUrl, $name) {
    $text = (Invoke-WebRequest $sumsUrl -UseBasicParsing).Content
    if ($text -is [byte[]]) { $text = [Text.Encoding]::UTF8.GetString($text) }
    $want = ($text -split "`n" | Where-Object { $_ -match "^([0-9a-fA-F]{64})\s+\*?$([regex]::Escape($name))\s*$" } |
        ForEach-Object { ($_ -split '\s+')[0] } | Select-Object -First 1)
    $got = (Get-FileHash $file -Algorithm SHA256).Hash
    if (-not $want -or $got -ne $want.ToUpper()) {
        Remove-Item -Force $file -ErrorAction SilentlyContinue
        throw "$name does not match its published SHA-256"
    }
}
# ffmpeg: our own small build (tools\ffmpeg\build.sh; GitHub builds it for
# every release). A ready one in tools\ffmpeg\win64 is used when it is there;
# the big public build of earlier versions is not used any more.
$ours = Join-Path $PSScriptRoot "tools\ffmpeg\win64"
if (Test-Path "$ours\ffmpeg.exe") {
    foreach ($f in @("ffmpeg.exe", "ffmpeg-LICENSE.txt", "lame-COPYING.txt", "openh264-LICENSE.txt", "ffmpeg-version.txt")) {
        if (Test-Path "$ours\$f") { Copy-Item "$ours\$f" $cache -Force }
    }
}
# keep ffmpeg.exe if present in cache
if (-not (Test-Path "$cache\yt-dlp.exe")) {
    Step "Downloading yt-dlp (finds the links of videos)"
    try {
        $yt = Invoke-RestMethod "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest" -Headers @{ "User-Agent" = "DodoDM1-build" }
        $ytExe = $yt.assets | Where-Object { $_.name -eq "yt-dlp.exe" } | Select-Object -First 1
        $ytSums = $yt.assets | Where-Object { $_.name -eq "SHA2-256SUMS" } | Select-Object -First 1
        Invoke-WebRequest $ytExe.browser_download_url -OutFile "$cache\yt-dlp.exe"
        Assert-Sha256 "$cache\yt-dlp.exe" $ytSums.browser_download_url "yt-dlp.exe"
    } catch {
        Write-Host "Could not download yt-dlp now. DODO DM1 gets it by itself later." -ForegroundColor Yellow
    }
}
# Visual C++ runtime: the program already carries it (static CRT, see
# .cargo\config.toml). Optional: put Microsoft's vc_redist.x64.exe into
# build-cache yourself and the installer also installs it where it is missing.
$redist = Join-Path $cache "redist"
New-Item -ItemType Directory -Force $redist | Out-Null
if (Test-Path "$cache\vc_redist.x64.exe") { Copy-Item "$cache\vc_redist.x64.exe" $redist -Force }
Copy-Item "THIRD-PARTY-NOTICES.txt" $stage -Force
Copy-Item "LICENSE" (Join-Path $stage "LICENSE.txt") -Force
# the Firefox add-on signed by Mozilla for this version (stays in Firefox for good)
$extVersion = (Get-Content (Join-Path $PSScriptRoot "extension\manifest.firefox.json") -Raw | ConvertFrom-Json).version
# Firefox keeps only add-ons signed by Mozilla (an unsigned one is gone
# when Firefox closes). Only a signed add-on of exactly this version goes
# into the setup: an older one would put the old add-on back into Firefox.
# Kept here (extension-signed), or the one of the newest release when that
# release is this version; otherwise the setup has none (a release signs it).
function Get-XpiVersion([string]$path) {
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
        try {
            $entry = $zip.GetEntry("manifest.json")
            if (-not $entry) { return $null }
            $reader = New-Object System.IO.StreamReader($entry.Open())
            try { return ($reader.ReadToEnd() | ConvertFrom-Json).version } finally { $reader.Close() }
        } finally { $zip.Dispose() }
    } catch { return $null }
}
$signedXpi = "extension-signed\dodo-dm1-firefox-$extVersion.xpi"
$xpiOut = Join-Path $stage "dodo-dm1-firefox.xpi"
Remove-Item $xpiOut -Force -ErrorAction SilentlyContinue
if ((Test-Path $signedXpi) -and ((Get-XpiVersion $signedXpi) -eq $extVersion)) {
    Copy-Item $signedXpi $xpiOut -Force
} else {
    try {
        Invoke-WebRequest "https://github.com/AhmedEzo686/ezoo-download/releases/latest/download/dodo-dm1-firefox.xpi" -OutFile $xpiOut
        if ((Get-XpiVersion $xpiOut) -ne $extVersion) { Remove-Item $xpiOut -Force }
    } catch {
        Remove-Item $xpiOut -Force -ErrorAction SilentlyContinue
    }
}
if (-not (Test-Path $xpiOut)) {
    Write-Warning "No signed Firefox add-on $extVersion yet: this setup has none (the release signs it). Firefox users of this build add it from the folder."
}
foreach ($f in @("ffmpeg.exe", "yt-dlp.exe", "ffmpeg-version.txt", "ffmpeg-LICENSE.txt", "lame-COPYING.txt", "openh264-LICENSE.txt")) {
    if (Test-Path "$cache\$f") { Copy-Item "$cache\$f" $tools -Force }
}
if (Test-Path (Join-Path $PSScriptRoot "update-url.txt")) {
    Copy-Item (Join-Path $PSScriptRoot "update-url.txt") $stage -Force
}

# ---------------------------------------------------------------- 4b. signing (optional)
# With a code signing certificate antivirus programs and Windows SmartScreen
# trust the program. Put it in signing\ezoo.pfx and its password in
# signing\password.txt - everything is then signed automatically.
$pfx = Join-Path $PSScriptRoot "signing\ezoo.pfx"
$signtool = $null
if (Test-Path $pfx) {
    $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "x64" } | Select-Object -First 1 -ExpandProperty FullName
}
function Sign-File($file) {
    if (-not $signtool) { return }
    $pw = (Get-Content (Join-Path $PSScriptRoot "signing\password.txt") -Raw).Trim()
    & $signtool sign /fd SHA256 /f $pfx /p $pw /tr "http://timestamp.digicert.com" /td SHA256 /d "DODO DM1" $file | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "Signed $file" } else { Write-Host "Could not sign $file" -ForegroundColor Yellow }
}
if ($signtool) {
    Step "Signing DodoDM1.exe"
    Sign-File "$stage\DodoDM1.exe"
    Sign-File "$stage\dodo-host.exe"
}


# ---------------------------------------------------------------- 5. installer
Step "Creating the installer (DodoDM1-Setup.exe)"
function Find-Iscc {
    @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
      "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
      "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
}
$iscc = Find-Iscc
if (-not $iscc) {
    Write-Host "Installing Inno Setup (makes the installer)..."
    winget install --id JRSoftware.InnoSetup -e --accept-package-agreements --accept-source-agreements | Out-Null
    $iscc = Find-Iscc
}
$setup = Join-Path $dist "DodoDM1-Setup.exe"
if ($iscc) {
    # Antivirus / OneDrive often lock a new .exe for a moment while Inno Setup
    # writes its icon into it ("EndUpdateResource failed"). So: build in a
    # temp folder, retry a few times, and as a last resort build without the
    # installer's own icon.
    $out = Join-Path $env:TEMP "dodo-setup-build"
    New-Item -ItemType Directory -Force $out | Out-Null
    $iss = Join-Path $PSScriptRoot "installer\dodo.iss"
    $ok = $false
    foreach ($extra in @("", "", "/DNoIcon")) {
        Remove-Item (Join-Path $out "DodoDM1-Setup.exe") -Force -ErrorAction SilentlyContinue
        $flags = @("/Q", "/O$out", "/DMyAppVersion=$version")
        if ($extra) { $flags += $extra }
        & $iscc @flags $iss
        if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $out "DodoDM1-Setup.exe"))) { $ok = $true; break }
        Write-Host "Retrying (the antivirus was probably scanning the file)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
    if ($ok) {
        Copy-Item (Join-Path $out "DodoDM1-Setup.exe") $setup -Force
        Sign-File $setup
        # version.json: the program reads it to detect and verify updates
        # (version + SHA-256 + Ed25519 signature when signing\update-signing-key.txt exists)
        $hash = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()
        $sig = ""
        $updKeyFile = Join-Path $PSScriptRoot "signing\update-signing-key.txt"
        if (Test-Path $updKeyFile) {
            $env:UPDATE_SIGNING_KEY = (Get-Content $updKeyFile -Raw).Trim()
            $sig = (cargo run --quiet --release -p swiftget-engine --example sign_update -- $version $hash | Out-String).Trim()
            Remove-Item Env:UPDATE_SIGNING_KEY -ErrorAction SilentlyContinue
        }
        $setupUrl = "DodoDM1-Setup.exe"
        $updUrlFile = Join-Path $PSScriptRoot "update-url.txt"
        if (Test-Path $updUrlFile) {
            $baseUpd = (Get-Content $updUrlFile -Raw).Trim()
            if ($baseUpd -match "^https?://.*/[^/]+$") {
                $setupUrl = ($baseUpd -replace "/[^/]+$", "/DodoDM1-Setup.exe")
            }
        }
        $json = "{`n  ""version"": ""$version"",`n  ""url"": ""$setupUrl"",`n  ""sha256"": ""$hash"",`n  ""sig"": ""$sig""`n}`n"
        [IO.File]::WriteAllText((Join-Path $dist "version.json"), $json)
    } else {
        Fail "Could not create the setup. Tip: move this folder out of Desktop/OneDrive (e.g. to C:\Ezoo) and run BUILD.bat again."
    }
} else {
    Fail "Inno Setup is not available, so the setup could not be made. Install Inno Setup 6 and run BUILD.bat again."
}

Write-Host ""
Write-Host "DONE!" -ForegroundColor Green
if (Test-Path $setup) {
    Write-Host ""
    Write-Host "  >> Double-click  dist\DodoDM1-Setup.exe  to install DODO DM1 <<" -ForegroundColor Green
    Write-Host "     (Start Menu folder, desktop shortcut, starts with Windows, uninstall from Settings > Apps)"
}
if (Test-Path "$dist\version.json") {
    Write-Host ""
    Write-Host "Also in $dist : version.json (it goes into the GitHub release together with the setup)"
}
# Done
Write-Host "Build and packaging finished successfully!" -ForegroundColor Green
