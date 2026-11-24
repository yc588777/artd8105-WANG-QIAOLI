$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  py -3 -m venv (Join-Path $root ".venv")
}
& $python -m pip install -r (Join-Path $root "requirements.txt")
$frontend = Join-Path $root "frontend"
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Push-Location $frontend
  npm install
  Pop-Location
}
$backend = Join-Path $root "backend"
Start-Process -FilePath $python -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8787") -WorkingDirectory $backend
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev") -WorkingDirectory $frontend
Write-Host "API  http://127.0.0.1:8787/api/health"
Write-Host "WEB  http://127.0.0.1:5173"
Write-Host "如果网页打不开，查看新开的两个窗口里的报错。未看到进程时不要认为服务已启动。"
