$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root ".venv\Scripts\python.exe"
$srcPython = "C:\Users\汪俏黎\AppData\Local\Programs\Python\Python313"
$outRoot = Join-Path $root "dist"
$name = "HaiTangWeaveLab"
$bundle = Join-Path $outRoot $name
$zip = Join-Path $outRoot "HaiTangWeaveLab-Windows.zip"

Write-Host "Building frontend..."
Push-Location (Join-Path $root "frontend")
npm run build
Pop-Location

if (Test-Path $bundle) { Remove-Item -Recurse -Force $bundle }
if (Test-Path $zip) { Remove-Item -Force $zip }
New-Item -ItemType Directory -Path $bundle | Out-Null

function Copy-Tree($from, $to, $excludeDir = @()) {
  New-Item -ItemType Directory -Path $to -Force | Out-Null
  Get-ChildItem $from -Force | ForEach-Object {
    if ($_.PSIsContainer) {
      if ($excludeDir -contains $_.Name) { return }
      Copy-Tree $_.FullName (Join-Path $to $_.Name) $excludeDir
    } else {
      if ($_.Name -eq ".DS_Store") { return }
      Copy-Item $_.FullName (Join-Path $to $_.Name) -Force
    }
  }
}

Write-Host "Copying slim Python runtime..."
$runtime = Join-Path $bundle "runtime"
New-Item -ItemType Directory -Path $runtime | Out-Null
foreach ($file in @("python.exe", "pythonw.exe", "python3.dll", "python313.dll", "vcruntime140.dll", "vcruntime140_1.dll")) {
  Copy-Item (Join-Path $srcPython $file) (Join-Path $runtime $file)
}
Copy-Tree (Join-Path $srcPython "DLLs") (Join-Path $runtime "DLLs")
Copy-Tree (Join-Path $srcPython "Lib") (Join-Path $runtime "Lib") @("test", "idlelib", "turtledemo", "ensurepip", "__pycache__", "site-packages")
Copy-Tree (Join-Path $root ".venv\Lib\site-packages") (Join-Path $runtime "Lib\site-packages") @("__pycache__", "pytest", "_pytest", "py.py")

@"
.
DLLs
Lib
Lib\site-packages
../backend
import site
"@ | Set-Content -Path (Join-Path $runtime "python313._pth") -Encoding ASCII

Write-Host "Copying app files..."
Copy-Tree (Join-Path $root "backend\app") (Join-Path $bundle "backend\app") @("__pycache__")
Copy-Tree (Join-Path $root "frontend\dist") (Join-Path $bundle "frontend\dist")
Copy-Tree (Join-Path $root "assets") (Join-Path $bundle "assets")
New-Item -ItemType Directory -Path (Join-Path $bundle "data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $bundle "exports") -Force | Out-Null
Copy-Item (Join-Path $root "requirements.txt") (Join-Path $bundle "requirements.txt")

function Write-Utf8NoBom($path, $text) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($path, $text, $utf8)
}

Write-Utf8NoBom (Join-Path $bundle "launch.py") @'
import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT / "backend")
sys.path.insert(0, str(ROOT / "backend"))
PORT = 8787


def lan_urls() -> list[str]:
    found: list[str] = []
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        found.append(sock.getsockname()[0])
        sock.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.append(info[4][0])
    except OSError:
        pass
    urls: list[str] = []
    for ip in found:
        if ip.startswith("127."):
            continue
        url = f"http://{ip}:{PORT}/"
        if url not in urls:
            urls.append(url)
    return urls


def open_page() -> None:
    time.sleep(1.6)
    webbrowser.open(f"http://127.0.0.1:{PORT}/")


if __name__ == "__main__":
    print("海棠经纬已启动。请保持这个窗口开着。")
    print(f"这台电脑： http://127.0.0.1:{PORT}/")
    urls = lan_urls()
    if urls:
        print("同一 Wi-Fi 的 iPad、手机或另一台电脑，用浏览器打开：")
        for url in urls:
            print("   ", url)
    else:
        print("没有读到局域网地址。iPad 需要和这台电脑在同一个 Wi-Fi。")
    print("若 iPad 打不开，先双击 Allow-iPad.bat，点「是」，只需一次。")
    threading.Thread(target=open_page, daemon=True).start()
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, log_level="info")
'@

Write-Utf8NoBom (Join-Path $bundle "Start-HaiTang.bat") @"
@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONHOME=
set PYTHONPATH=%~dp0backend
set PYTHONUTF8=1
set PYTHONNOUSERSITE=1
echo Starting Haitang Weave Lab...
echo Keep this window open.
"%~dp0runtime\python.exe" "%~dp0launch.py"
if errorlevel 1 pause
"@

Write-Utf8NoBom (Join-Path $bundle "Allow-iPad.bat") @'
@echo off
chcp 65001 >nul
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="Haitang Weave Lab" >nul 2>&1
netsh advfirewall firewall add rule name="Haitang Weave Lab" dir=in action=allow protocol=TCP localport=8787 profile=any
echo.
echo 已放行 8787。iPad 请打开 Start-HaiTang.bat 窗口里打印的地址。
echo.
pause
'@

Write-Utf8NoBom (Join-Path $bundle "README.txt") @'
海棠经纬 / Haitang Weave Lab

这个文件夹自带运行环境。另一台 Windows 电脑不需要安装 Python、Node 或 Cursor。
iPad、手机和 Mac 不能运行这个文件夹，它们用浏览器打开正在运行的那台 Windows。

一、在另一台 Windows 电脑上自己打开
1. 解压整个 HaiTangWeaveLab-Windows.zip（Windows 10/11，64 位）。
2. 双击 Start-HaiTang.bat。
3. 黑窗口不要关。浏览器会打开 http://127.0.0.1:8787/
4. 要停止，关掉黑窗口。

二、让 iPad、手机、Mac 或另一台电脑直接打开
1. 先在一台 Windows 上双击 Start-HaiTang.bat，窗口保持开着。
2. iPad 和这台电脑连接同一个 Wi-Fi。
3. 第一次双击 Allow-iPad.bat，在系统提示里点「是」。只需一次。
4. 看黑窗口里打印的地址，例如 http://192.168.1.8:8787/ ，用 Safari 或浏览器打开它。
5. iPad 横过来用。关掉 Windows 上的黑窗口后，iPad 上的页面会停。

第一次运行 python.exe 时，杀毒软件可能会询问，请允许。
不要把 http://127.0.0.1:8787 当成文件去打开，它是这个窗口启动的页面。
'@

Write-Host "Checking the bundled runtime..."
$runtimePy = Join-Path $bundle "runtime\python.exe"
& $runtimePy -c "import fastapi, uvicorn, numpy, PIL, manifold3d, app.main; print(app.main.app.title)"
if ($LASTEXITCODE -ne 0) { throw "Bundled Python could not import the app." }

Write-Host "Zipping..."
Compress-Archive -Path $bundle -DestinationPath $zip -CompressionLevel Optimal
Get-Item $zip | ForEach-Object { Write-Host ("ZIP {0:N1} MB  {1}" -f ($_.Length/1MB), $_.FullName) }
Write-Host "Folder $bundle"
