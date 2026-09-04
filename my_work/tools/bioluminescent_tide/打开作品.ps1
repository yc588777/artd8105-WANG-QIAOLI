$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$url = "http://127.0.0.1:8787/"
$online = "https://yc588777.github.io/artd8105-WANG-QIALI/"

function Get-TideHeader {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return [string]$r.Headers["X-Tide-Server"]
  } catch {
    return ""
  }
}

function Stop-Port8787 {
  Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

if ((Get-TideHeader) -ne "1") {
  Stop-Port8787
  Start-Sleep -Milliseconds 400

  $launcher = $null
  $args = @()
  if (Get-Command py -ErrorAction SilentlyContinue) {
    $launcher = "py"
    $args = @("-3", "serve.py")
  } elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $launcher = "python"
    $args = @("serve.py")
  } else {
    Write-Host "未找到 Python，改为打开网上的作品页面。"
    Start-Process $online
    exit 0
  }

  Start-Process -FilePath $launcher -ArgumentList $args -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

  $ok = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 300
    if ((Get-TideHeader) -eq "1") { $ok = $true; break }
  }
  if (-not $ok) {
    Write-Host "本地网页没有启动成功，改为打开网上的作品页面。"
    Start-Process $online
    exit 0
  }
}

Start-Process $url
