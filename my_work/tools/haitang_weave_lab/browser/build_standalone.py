"""Build one offline HTML file. The lab source is copied, not edited."""
from __future__ import annotations

import base64
import struct
import zipfile
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
PACK = LAB / "dist" / "HaiTangWeaveLab-Browser"
PY = Path(__file__).with_name("vendor") / "pyodide"
OUT = LAB / "dist" / "HaiTangWeaveLab-Browser.html"
SKIP = {"index.html", "boot.js", "manifest.json"}


def pack_files(paths: list[tuple[str, Path]]) -> bytes:
    buf = bytearray()
    for name, path in paths:
        raw_name = name.encode("utf-8")
        data = path.read_bytes()
        buf += struct.pack("<I", len(raw_name))
        buf += raw_name
        buf += struct.pack("<I", len(data))
        buf += data
    return bytes(buf)


def lab_zip() -> bytes:
    buffer_path = LAB / "dist" / "_lab.zip"
    with zipfile.ZipFile(buffer_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in PACK.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(PACK).as_posix()
            if rel in SKIP or rel.startswith("frontend/") or rel == "runtime.py":
                continue
            if Path(rel).name in SKIP:
                continue
            archive.write(path, rel)
        archive.write(Path(__file__).with_name("runtime.py"), "runtime.py")
        archive.write(Path(__file__).with_name("manifold3d.py"), "vendor/shim/manifold3d.py")
    data = buffer_path.read_bytes()
    buffer_path.unlink()
    return data


def main() -> None:
    manifold = Path(__file__).with_name("vendor") / "manifold"
    py_paths = [(path.name, path) for path in sorted(PY.iterdir()) if path.is_file()]
    py_paths += [(path.name, path) for path in (manifold / "manifold.js", manifold / "manifold.wasm")]
    py_b64 = base64.b64encode(pack_files(py_paths)).decode("ascii")
    lab_b64 = base64.b64encode(lab_zip()).decode("ascii")
    script = Path(__file__).with_name("standalone.js").read_text(encoding="utf-8")
    html = f"""<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>海棠經緯 · HAITANG WEAVE LAB</title>
</head>
<body>
  <p id="needjs" style="margin:48px auto;max-width:36em;font:16px/1.6 sans-serif;color:#1c1915">这个文件里的算法要由浏览器执行。iPad 的文件预览只显示文字，不会把程序跑起来。</p>
  <div id="boot" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f4efe6;color:#1c1915;font:16px/1.5 sans-serif;z-index:9;padding:24px;text-align:center">正在打开海棠經緯</div>
  <div id="root"></div>
  <script>window.PY_B64={py_b64!r};window.LAB_B64={lab_b64!r};</script>
  <script>
{script}
  </script>
</body>
</html>
"""
    OUT.write_text(html, encoding="utf-8")
    print(OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
