"""Pack last night's lab as a static site. Does not edit the lab source."""
from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
PACK = LAB / "dist" / "HaiTangWeaveLab-Browser"
OUT = LAB / "dist" / "haitang-public"
ZIP = LAB / "dist" / "haitang-public.zip"
HERE = Path(__file__).resolve().parent
SKIP = {"index.html", "boot.js", "manifest.json", "runtime.py"}
OMIT = {
    "assets/baseline/master_fixed_tris.f32",
    "assets/original/obj_2_fan.stl",
}
PY_OMIT = {
    "micropip-0.11.0-py3-none-any.whl",
}


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    names: list[str] = []
    for path in PACK.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(PACK).as_posix()
        if rel.startswith("frontend/") or rel.startswith("vendor/fonts/"):
            continue
        if rel in SKIP or rel in OMIT:
            continue
        dest = OUT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        names.append(rel)
    extras = {
        "runtime.py": HERE / "runtime.py",
        "vendor/shim/manifold3d.py": HERE / "manifold3d.py",
        "vendor/manifold/manifold.js": HERE / "vendor" / "manifold" / "manifold.js",
        "vendor/manifold/manifold.wasm": HERE / "vendor" / "manifold" / "manifold.wasm",
    }
    for rel, source in extras.items():
        dest = OUT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        names.append(rel)
    mesh = LAB / "dist" / "master_fixed_tris.f32.htxz"
    mesh_dest = OUT / "assets" / "baseline" / "master_fixed_tris.f32.htxz"
    mesh_dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(mesh, mesh_dest)
    names.append("assets/baseline/master_fixed_tris.f32.htxz")
    for path in (HERE / "vendor" / "pyodide").iterdir():
        if not path.is_file() or path.name in PY_OMIT:
            continue
        dest = OUT / "vendor" / "pyodide" / path.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
    wasm_dest = OUT / "vendor" / "lzma" / "compress.wasm"
    wasm_dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HERE / "vendor" / "lzma" / "compress.wasm", wasm_dest)
    (OUT / "manifest.json").write_text(json.dumps(sorted(names), ensure_ascii=False), encoding="utf-8")
    shutil.copy2(HERE / "site.js", OUT / "boot.js")
    (OUT / "index.html").write_text(
        """<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>海棠經緯 · HAITANG WEAVE LAB</title>
</head>
<body>
  <div id="boot" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f4efe6;color:#1c1915;font:16px/1.5 sans-serif;z-index:9;padding:24px;text-align:center">正在打开海棠經緯</div>
  <div id="root"></div>
  <script src="./vendor/pyodide/pyodide.js"></script>
  <script src="./boot.js"></script>
</body>
</html>
""",
        encoding="utf-8",
    )
    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in OUT.rglob("*"):
            if path.is_file():
                archive.write(path, path.relative_to(OUT).as_posix())
    raw = sum(path.stat().st_size for path in OUT.rglob("*") if path.is_file())
    count = sum(1 for path in OUT.rglob("*") if path.is_file())
    print(f"files={count} raw={raw} zip={ZIP.stat().st_size}")


if __name__ == "__main__":
    main()
