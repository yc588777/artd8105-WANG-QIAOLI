"""List the Pyodide files the offline page has to carry."""
from __future__ import annotations

import json
from pathlib import Path

LOCK = Path(__file__).with_name("vendor") / "pyodide" / "pyodide-lock.json"
ROOTS = ["numpy", "pillow", "micropip", "fastapi", "httpx", "pydantic", "pydantic-core", "httpcore", "certifi", "idna", "h11"]


def main() -> None:
    data = json.loads(LOCK.read_text(encoding="utf-8"))
    packages = data["packages"]
    needed: set[str] = set()

    def add(name: str) -> None:
        key = name.lower().replace("_", "-")
        match = next((item for item in packages if item.lower().replace("_", "-") == key), None)
        if match is None or match in needed:
            return
        needed.add(match)
        info = packages[match]
        for dep in info.get("depends") or []:
            add(dep.split(">")[0].split("<")[0].split("=")[0].strip())

    for name in ROOTS:
        add(name)
    files = []
    for name in sorted(needed):
        info = packages[name]
        print(f"{name}\t{info.get('file_name')}\t{info.get('package_type')}")
        if info.get("file_name"):
            files.append(info["file_name"])
    print("COUNT", len(files))


if __name__ == "__main__":
    main()
