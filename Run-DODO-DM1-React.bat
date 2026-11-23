@echo off
title DODO DM1 - React Desktop UI
cd /d "%~dp0dodo-react-ui"
if not exist "..\target\release\DodoDM1.exe" (
    echo Building DODO DM1 release binary first...
    pushd ..
    cargo build --release
    popd
)
if not exist "dist\index.html" (
    call npm run build
)
echo Starting DODO DM1 (Full Rust Engine + React UI)...
start "" npx.cmd electron .
exit
