import io
import json
import sys
import zipfile
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.sessions import build_router, system_version  # noqa: E402


def _client(tmp_path: Path) -> TestClient:
    def evaluate(params: dict):
        return {"exportable": params.get("density", 1) < 2, "reason": "", "counters": {}}, b"\x89PNG fake"

    def drawing(params: dict, title: str, designer: str, number: str, lang: str = "zh-Hant"):
        return f"PNG|{title}|{designer}|{number}|{lang}".encode()

    app = FastAPI()
    app.include_router(build_router(tmp_path, evaluate, drawing))
    return TestClient(app)


def test_final_craft_drawing_is_kept_with_the_session(tmp_path):
    client = _client(tmp_path)
    session = client.post("/api/sessions", json={"title": "茶室陳設", "consent_logging": True}).json()
    res = client.post(f"/api/sessions/{session['id']}/craft-drawing", json={"params": {}, "snapshot": "snap-002", "final": True})
    assert res.status_code == 200 and res.content.startswith(b"PNG|")
    assert f"{session['id']} / snap-002".encode() in res.content
    stored = client.get(f"/api/sessions/{session['id']}").json()
    assert stored["drawings"][0]["final"] is True
    names = zipfile.ZipFile(io.BytesIO(client.get(f"/api/sessions/{session['id']}/bundle").content)).namelist()
    assert any(name.startswith("craft_drawing_final_") for name in names)
    assert client.post(f"/api/sessions/{session['id']}/craft-drawing", json={"params": {}, "snapshot": "../x"}).status_code == 400


def test_snapshots_keep_parent_chain_and_params(tmp_path):
    client = _client(tmp_path)
    session = client.post("/api/sessions", json={"title": "茶室陳設", "round": "E6", "consent_logging": True}).json()
    assert session["system_version"] == system_version()
    first = client.post(f"/api/sessions/{session['id']}/snapshots", json={"params": {"density": 1.2}, "label": "起稿"}).json()
    second = client.post(
        f"/api/sessions/{session['id']}/snapshots",
        json={"params": {"density": 2.4}, "parent": first["id"]},
    ).json()
    assert (first["id"], second["id"]) == ("snap-001", "snap-002")
    assert second["parent"] == "snap-001"
    assert second["machine"]["exportable"] is False
    stored = client.get(f"/api/sessions/{session['id']}").json()
    assert [s["params"]["density"] for s in stored["snapshots"]] == [1.2, 2.4]
    assert client.get(f"/api/sessions/{session['id']}/snapshots/snap-001/plan.png").status_code == 200


def test_events_are_written_only_with_consent(tmp_path):
    client = _client(tmp_path)
    on = client.post("/api/sessions", json={"consent_logging": True}).json()
    off = client.post("/api/sessions", json={"consent_logging": False}).json()
    for session in (on, off):
        client.post(f"/api/sessions/{session['id']}/events", json={"events": [{"type": "param_change", "payload": {"key": "density"}}]})
    lines = (tmp_path / "sessions" / on["id"] / "events.jsonl").read_text(encoding="utf-8").splitlines()
    assert [json.loads(line)["type"] for line in lines] == ["session_start", "param_change"]
    assert not (tmp_path / "sessions" / off["id"] / "events.jsonl").exists()


def test_bundle_contains_session_files(tmp_path):
    client = _client(tmp_path)
    session = client.post("/api/sessions", json={"consent_logging": True}).json()
    client.post(f"/api/sessions/{session['id']}/snapshots", json={"params": {}})
    data = client.get(f"/api/sessions/{session['id']}/bundle").content
    names = zipfile.ZipFile(io.BytesIO(data)).namelist()
    assert {"session.json", "events.jsonl", "snap-001_plan.png"} <= set(names)


def test_rejects_path_tricks(tmp_path):
    client = _client(tmp_path)
    assert client.get("/api/sessions/..%2F..").status_code in {400, 404}
    session = client.post("/api/sessions", json={}).json()
    assert client.get(f"/api/sessions/{session['id']}/snapshots/../plan.png").status_code in {400, 404}
