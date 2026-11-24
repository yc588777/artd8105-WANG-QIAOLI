$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $root "start_server.ps1"
$cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""

schtasks /Delete /TN "HaiTangWeaveLab" /F 2>$null | Out-Null
schtasks /Delete /TN "HaiTangWeaveLabWatch" /F 2>$null | Out-Null
schtasks /Create /TN "HaiTangWeaveLab" /TR $cmd /SC ONLOGON /IT /RL LIMITED /F
schtasks /Create /TN "HaiTangWeaveLabWatch" /TR $cmd /SC MINUTE /MO 3 /RL LIMITED /F

$startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\HaiTangWeaveLab.cmd"
@"
@echo off
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$script"
"@ | Set-Content -Path $startup -Encoding ASCII

& $script
if ($LASTEXITCODE -ne 0 -and -not (netstat -ano | Select-String -Pattern ":8787\s+.+\s+LISTENING")) {
  throw "Server did not start on port 8787"
}
Write-Host "Autostart installed. Open http://127.0.0.1:8787/"
