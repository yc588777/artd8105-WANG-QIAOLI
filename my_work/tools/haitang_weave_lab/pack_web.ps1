$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outRoot = Join-Path $root "dist"
$name = "HaiTangWeaveLab-Web"
$bundle = Join-Path $outRoot $name
$zip = Join-Path $outRoot "HaiTangWeaveLab-Web.zip"

Write-Host "Building frontend..."
Push-Location (Join-Path $root "frontend")
npm run build
Pop-Location

if (Test-Path $bundle) { Remove-Item -Recurse -Force $bundle }
if (Test-Path $zip) { Remove-Item -Force $zip }
New-Item -ItemType Directory -Path $bundle | Out-Null

function Copy-Tree($from, $to) {
  New-Item -ItemType Directory -Path $to -Force | Out-Null
  Get-ChildItem $from -Force | ForEach-Object {
    if ($_.Name -in @("__pycache__", ".DS_Store", "node_modules")) { return }
    if ($_.PSIsContainer) {
      Copy-Tree $_.FullName (Join-Path $to $_.Name)
    } else {
      Copy-Item $_.FullName (Join-Path $to $_.Name) -Force
    }
  }
}

Copy-Tree (Join-Path $root "backend") (Join-Path $bundle "backend")
Copy-Tree (Join-Path $root "frontend\dist") (Join-Path $bundle "frontend\dist")
Copy-Tree (Join-Path $root "assets") (Join-Path $bundle "assets")
foreach ($file in @("requirements.txt", "Dockerfile", "render.yaml", ".dockerignore", "serve.py")) {
  Copy-Item (Join-Path $root $file) (Join-Path $bundle $file) -Force
}

$readme = @"
海棠經緯是一個網站。手機、平板、電腦都用瀏覽器打開，不需要安裝 App。

同一台電腦上先試
1. 安裝 Python 3.12。
2. 在這個資料夾執行：
   py -3.12 -m pip install -r requirements.txt
   py -3.12 serve.py
3. 瀏覽器打開終端裡印出的網址。同一網路裡的手機和平板也打開那個網址。

放到網上，讓任何地方的裝置打開
這個資料夾裡的 Dockerfile 就是網站本身。把它部署到一台雲端主機後，會得到一個 https 網址。
任何裝置的瀏覽器打開那個網址就能操作，不再依賴你現在這台電腦。
render.yaml 是 Render 的免費方案設定，地區為新加坡，健康檢查是 /api/health。

頁面和計算介面由同一個服務提供，介面使用相對路徑 /api/，所以換網址不用改程式。
"@
[System.IO.File]::WriteAllText((Join-Path $bundle "README.txt"), $readme, [System.Text.UTF8Encoding]::new($false))

Compress-Archive -Path (Join-Path $bundle "*") -DestinationPath $zip -Force
Write-Host "Wrote $zip"
