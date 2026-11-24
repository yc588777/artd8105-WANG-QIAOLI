$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root ".venv\Scripts\python.exe"
$backend = Join-Path $root "backend"
$logDir = Join-Path $root "logs"
$port = 8787

function Listening {
  return [bool](netstat -ano | Select-String -Pattern ":$port\s+.+\s+LISTENING")
}

if (Listening) { exit 0 }
if (-not (Test-Path $python)) {
  throw "Missing $python"
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path (Join-Path $logDir "start.log") -Value "[$stamp] starting uvicorn on 0.0.0.0:$port"

Start-Process -FilePath $python -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "uvicorn.out.log") -RedirectStandardError (Join-Path $logDir "uvicorn.err.log") -ArgumentList @(
  "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$port"
)

for ($i = 0; $i -lt 50; $i++) {
  Start-Sleep -Milliseconds 300
  if (Listening) { exit 0 }
}
exit 1
