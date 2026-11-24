"""Run the existing FastAPI app inside the page. The lab code is not modified."""
from __future__ import annotations

import inspect
import json
import os
import shutil
import sys
import traceback
import typing
from pathlib import Path

ROOT = Path("/haitang")
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "vendor" / "shim"))

fonts = Path("C:/Windows/Fonts")
fonts.mkdir(parents=True, exist_ok=True)
vendor = ROOT / "vendor" / "fonts"
if vendor.exists():
    for item in vendor.iterdir():
        if not item.is_file():
            continue
        target = fonts / item.name
        if not target.exists():
            shutil.copyfile(item, target)
    noto = vendor / "NotoSansTC-VF.ttf"
    alias = fonts / "simhei.ttf"
    if noto.exists() and not alias.exists():
        shutil.copyfile(noto, alias)

from fastapi import HTTPException  # noqa: E402
from fastapi.responses import FileResponse, Response  # noqa: E402
from starlette.routing import Match, Mount  # noqa: E402

from app.main import app, startup  # noqa: E402

startup()


def _pack(result):
    if isinstance(result, FileResponse):
        data = Path(result.path).read_bytes()
        disposition = ""
        if result.filename:
            disposition = f'attachment; filename="{result.filename}"'
        return result.status_code, result.media_type or "application/octet-stream", disposition, data
    if isinstance(result, Response):
        disposition = result.headers.get("content-disposition", "")
        return result.status_code, result.media_type or "application/octet-stream", disposition, result.body
    payload = json.dumps(result, ensure_ascii=False).encode("utf-8")
    return 200, "application/json", "", payload


def _call(method: str, fullpath: str, raw: bytes, content_type: str):
    path, _, query = fullpath.partition("?")
    headers = []
    if content_type:
        headers.append((b"content-type", content_type.encode()))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method.upper(),
        "path": path,
        "raw_path": path.encode(),
        "query_string": query.encode(),
        "headers": headers,
        "scheme": "http",
        "client": ("127.0.0.1", 0),
        "server": ("haitang", 80),
    }
    for route in app.routes:
        if isinstance(route, Mount) or not hasattr(route, "endpoint"):
            continue
        match, child = route.matches(scope)
        if match != Match.FULL:
            continue
        kwargs = dict(child.get("path_params") or {})
        if raw:
            data = json.loads(raw.decode("utf-8"))
            hints = typing.get_type_hints(route.endpoint)
            for name in inspect.signature(route.endpoint).parameters:
                anno = hints.get(name)
                if hasattr(anno, "model_validate"):
                    kwargs[name] = anno.model_validate(data)
        try:
            return _pack(route.endpoint(**kwargs))
        except HTTPException as exc:
            detail = exc.detail
            try:
                payload = json.dumps({"detail": detail}, ensure_ascii=False).encode("utf-8")
                kind = "application/json"
            except TypeError:
                payload = str(detail).encode("utf-8")
                kind = "text/plain"
            return exc.status_code, kind, "", payload
    return 404, "text/plain", "", b"not found"


async def handle(method: str, path: str, body: bytes, content_type: str) -> dict:
    try:
        status, kind, disposition, data = _call(method, path, body or b"", content_type or "")
    except Exception:
        status, kind, disposition, data = 500, "text/plain; charset=utf-8", "", traceback.format_exc().encode("utf-8")
    return {"status": status, "type": kind, "disposition": disposition, "body": data}
