"""Serve the lab for any browser.

Phones, tablets and computers open the printed address. The page and the
calculation API come from this one process.
"""
from __future__ import annotations

import os
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT)


def _lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return ""
    finally:
        sock.close()


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8787"))
    print("海棠經緯")
    print(f"http://127.0.0.1:{port}/")
    lan = _lan_ip()
    if lan:
        print(f"http://{lan}:{port}/")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
