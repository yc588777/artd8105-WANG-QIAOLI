"""Design sessions: versioned snapshots (F1), an append-only event log (F8), and the system version (F9).

Everything stays on this machine under data/sessions/<id>/.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import threading
import time
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

APP = Path(__file__).resolve().parent
_lock = threading.Lock()
_version: str | None = None


def system_version() -> str:
    """Release label plus a hash of the backend source, so a frozen build can be checked."""
    global _version
    if _version is None:
        label = (APP / "VERSION").read_text(encoding="utf-8").strip() if (APP / "VERSION").exists() else "dev"
        digest = hashlib.sha256()
        for path in sorted(APP.rglob("*.py")):
            digest.update(path.relative_to(APP).as_posix().encode())
            digest.update(path.read_bytes())
        _version = f"{label}+{digest.hexdigest()[:8]}"
    return _version


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class SessionIn(BaseModel):
    title: str = "設計會話"
    round: str = ""
    brief: str = ""
    participant: str = "D0"
    consent_logging: bool = False


class SnapshotIn(BaseModel):
    params: dict
    label: str = ""
    parent: str | None = None
    note: str = ""


class DrawingIn(BaseModel):
    params: dict
    snapshot: str | None = None
    final: bool = False
    lang: str = "zh-Hant"


class EventIn(BaseModel):
    type: str
    payload: dict = Field(default_factory=dict)
    session_clock: float | None = None


class EventsIn(BaseModel):
    events: list[EventIn]


def build_router(
    data_dir: Path,
    evaluate: Callable[[dict], tuple[dict, bytes | None]],
    drawing: Callable[..., bytes] | None = None,
) -> APIRouter:
    """`evaluate(params)` returns the machine summary and an optional plan PNG for a snapshot;
    `drawing(params, title, designer, drawing_no, lang)` renders the craft drawing PNG."""
    root = data_dir / "sessions"
    root.mkdir(parents=True, exist_ok=True)
    router = APIRouter(prefix="/api/sessions")

    def folder(session_id: str) -> Path:
        if not re.fullmatch(r"[A-Za-z0-9_-]{4,64}", session_id):
            raise HTTPException(400, "bad session id")
        path = root / session_id
        if not (path / "session.json").exists():
            raise HTTPException(404, "session not found")
        return path

    def load(session_id: str) -> dict:
        return json.loads((folder(session_id) / "session.json").read_text(encoding="utf-8"))

    def save(session: dict) -> None:
        path = root / session["id"] / "session.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(session, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)

    def log(session: dict, kind: str, payload: dict, clock: float | None = None) -> None:
        if not session.get("consent_logging"):
            return
        if clock is None:
            clock = round(time.time() - float(session.get("started_epoch", time.time())), 2)
        line = {"t": _now(), "session_clock": clock, "participant": session.get("participant", ""), "type": kind, "payload": payload}
        with (root / session["id"] / "events.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(line, ensure_ascii=False) + "\n")

    @router.get("/version")
    def version():
        return {"system_version": system_version()}

    @router.get("")
    def list_sessions():
        items = []
        for path in sorted(root.glob("*/session.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            items.append({k: data.get(k) for k in ("id", "title", "round", "participant", "created", "system_version")} | {"snapshot_count": len(data.get("snapshots", []))})
        return sorted(items, key=lambda item: item.get("created") or "", reverse=True)

    @router.post("")
    def create_session(body: SessionIn):
        stamp = datetime.now().strftime("%Y%m%d-%H%M")
        session_id = f"s-{stamp}-{uuid.uuid4().hex[:4]}"
        (root / session_id).mkdir(parents=True)
        session = {
            "id": session_id,
            **body.model_dump(),
            "system_version": system_version(),
            "created": _now(),
            "started_epoch": time.time(),
            "snapshots": [],
        }
        with _lock:
            save(session)
            log(session, "session_start", {"round": body.round, "brief": body.brief})
        return session

    @router.get("/{session_id}")
    def get_session(session_id: str):
        return load(session_id)

    @router.post("/{session_id}/snapshots")
    def add_snapshot(session_id: str, body: SnapshotIn):
        base = folder(session_id)
        machine, plan = evaluate(body.params)
        with _lock:
            session = load(session_id)
            snap_id = f"snap-{len(session['snapshots']) + 1:03d}"
            if plan:
                (base / f"{snap_id}_plan.png").write_bytes(plan)
            snap = {
                "id": snap_id,
                "parent": body.parent,
                "author": session.get("participant", ""),
                "created": _now(),
                "label": body.label or snap_id,
                "note": body.note,
                "params": body.params,
                "machine": machine,
                "system_version": system_version(),
                "plan_png": f"{snap_id}_plan.png" if plan else None,
            }
            session["snapshots"].append(snap)
            save(session)
            log(session, "snapshot_create", {"id": snap_id, "parent": body.parent, "exportable": machine.get("exportable")})
        return snap

    @router.get("/{session_id}/snapshots/{snap_id}/plan.png")
    def snapshot_plan(session_id: str, snap_id: str):
        if not re.fullmatch(r"snap-\d{3}", snap_id):
            raise HTTPException(400, "bad snapshot id")
        path = folder(session_id) / f"{snap_id}_plan.png"
        if not path.exists():
            raise HTTPException(404, "no plan")
        return Response(path.read_bytes(), media_type="image/png")

    @router.post("/{session_id}/craft-drawing")
    def craft_drawing(session_id: str, body: DrawingIn):
        if drawing is None:
            raise HTTPException(501, "craft drawing not available")
        base = folder(session_id)
        session = load(session_id)
        if body.snapshot is not None and not re.fullmatch(r"snap-\d{3}", body.snapshot):
            raise HTTPException(400, "bad snapshot id")
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        tag = "final" if body.final else (body.snapshot or "current")
        name = f"craft_drawing_{tag}_{stamp}.png"
        number = f"{session_id} / {body.snapshot or tag}"
        png = drawing(body.params, session.get("title", ""), session.get("participant", ""), number, body.lang)
        (base / name).write_bytes(png)
        with _lock:
            session = load(session_id)
            session.setdefault("drawings", []).append({"file": name, "snapshot": body.snapshot, "final": body.final, "created": _now(), "system_version": system_version()})
            save(session)
            log(session, "craft_drawing", {"file": name, "snapshot": body.snapshot, "final": body.final})
        return Response(png, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="{name}"'})

    @router.post("/{session_id}/events")
    def add_events(session_id: str, body: EventsIn):
        with _lock:
            session = load(session_id)
            for event in body.events[:500]:
                log(session, event.type[:48], event.payload, event.session_clock)
        return {"ok": True, "logged": bool(session.get("consent_logging"))}

    @router.get("/{session_id}/bundle")
    def bundle(session_id: str):
        base = folder(session_id)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(base.iterdir()):
                zf.write(path, arcname=path.name)
        return Response(
            buf.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{session_id}.zip"'},
        )

    return router
