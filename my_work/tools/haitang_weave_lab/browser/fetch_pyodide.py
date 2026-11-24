"""Download the Pyodide runtime and the wheels this page imports."""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).with_name("vendor") / "pyodide"
BASE = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"
LOCK = json.loads((ROOT / "pyodide-lock.json").read_text(encoding="utf-8"))["packages"]
NAMES = [
    "numpy", "pillow", "micropip", "fastapi", "httpx", "pydantic", "pydantic-core",
    "httpcore", "certifi", "idna", "h11", "annotated-types", "anyio", "jinja2",
    "markupsafe", "sniffio", "starlette", "typing-extensions", "typing-inspection",
    "ssl", "libopenssl",
]
CORE = ["pyodide.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]


def fetch(name: str) -> None:
    dest = ROOT / name
    if dest.exists() and dest.stat().st_size > 0 and name != "pyodide-lock.json":
        print("have", name, dest.stat().st_size)
        return
    print("get", name)
    urllib.request.urlretrieve(BASE + name, dest)
    print(" ", dest.stat().st_size)


def main() -> None:
    files = list(CORE)
    for name in NAMES:
        files.append(LOCK[name]["file_name"])
    for name in files:
        fetch(name)


if __name__ == "__main__":
    main()
