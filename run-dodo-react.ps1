# Launch DODO DM1 with React UI
Set-Location -Path "$PSScriptRoot\dodo-react-ui"
Write-Host "Launching DODO DM1 (Modern React UI)..." -ForegroundColor Cyan
Start-Process "npx" -ArgumentList "electron ." -NoNewWindow
