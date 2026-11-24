"""Assemble last night's lab into a browser folder. Does not edit the lab source."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
OUT = LAB / "dist" / "HaiTangWeaveLab-Browser"
SKIP = {"__pycache__", ".pyc"}

INCLUDE = [
    LAB / "backend" / "app",
    LAB / "assets",
    LAB / "frontend" / "dist",
]


def copy_tree(src: Path, dest: Path) -> None:
    for path in src.rglob("*"):
        if any(part in SKIP or part.endswith(".pyc") for part in path.parts):
            continue
        if path.is_dir():
            continue
        target = dest / path.relative_to(src)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    copy_tree(LAB / "backend" / "app", OUT / "backend" / "app")
    copy_tree(LAB / "assets", OUT / "assets")
    copy_tree(LAB / "frontend" / "dist", OUT / "frontend" / "dist")
    # The page itself is served from this folder, so the built files also sit at the web root.
    copy_tree(LAB / "frontend" / "dist", OUT)
    fonts = OUT / "vendor" / "fonts"
    fonts.mkdir(parents=True)
    windows = Path(r"C:\Windows\Fonts")
    for name in ("msjh.ttc", "msjhbd.ttc"):
        source = windows / name
        if source.exists():
            shutil.copy2(source, fonts / name)
    shutil.copy2(Path(__file__).with_name("runtime.py"), OUT / "runtime.py")
    shutil.copy2(Path(__file__).with_name("boot.js"), OUT / "boot.js")
    (OUT / "index.html").write_text(
        """<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>海棠經緯 · HAITANG WEAVE LAB</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Noto+Sans+SC:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;600&family=Noto+Serif+SC:wght@560;600&family=Noto+Serif+TC:wght@560;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" crossorigin href="/assets/index-DDGzD2DE.css">
    <script src="https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.js"></script>
  </head>
  <body>
    <div id="boot" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f4efe6;color:#1c1915;font:16px/1.5 'Noto Sans TC',sans-serif;z-index:9">正在打开海棠經緯</div>
    <div id="root"></div>
    <script src="/boot.js"></script>
  </body>
</html>
""",
        encoding="utf-8",
    )
    needed = []
    for path in OUT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(OUT).as_posix()
        if rel.startswith("frontend/dist/") or rel in {"index.html", "boot.js", "manifest.json"}:
            continue
        if rel.startswith("assets/index-") or rel == "assets/meshWorker-u-KdIzb8.js":
            continue
        needed.append(rel)
    (OUT / "manifest.json").write_text(json.dumps(sorted(needed), ensure_ascii=False), encoding="utf-8")
    print(f"{OUT} files={len(needed)}")


if __name__ == "__main__":
    main()
