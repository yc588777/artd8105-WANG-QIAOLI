"""HAITANG WEAVE LAB API. Generation runs in this process, not through Cursor."""
from __future__ import annotations

import io
import json
import shutil
import threading
import time
import uuid
import zipfile
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.geometry.engine import (
    BASELINE_PATH,
    ORIGINAL,
    ROOT,
    build_cache,
    default_params,
    write_baseline_json,
)
from app.geometry.unified import build_unified, plan_unified
from app.geometry.exporters import write_3mf, write_glb, write_stl_from_indexed
from app.geometry.handle_text import candidate_public, remove_confirmed_text
from app.geometry.stl_io import read_stl, write_stl
from app.craft_drawing import craft_drawing
from app.effect_image import effect_png
from app.crossings import crossing_view
from app.repair import explain as explain_issues
from app.repair import suggest_fix
from app.sessions import build_router as build_session_router
from app.sessions import system_version

DATA = ROOT / "data"
EXPORTS = ROOT / "exports"
PRESETS_PATH = DATA / "presets.json"
ASSEMBLY_PATH = DATA / "assembly.json"
HANDLE_PATH = DATA / "handle_state.json"

app = FastAPI(title="海棠织序 HAITANG WEAVE LAB")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_lock = threading.Lock()
_tasks: dict[str, dict] = {}

SNAPSHOT_COUNTERS = (
    "curve_count", "crossing_count", "interior_endpoint_count", "visible_endpoint_count",
    "short_fragment_count", "insufficient_embed_count", "unanchored_strip_count",
    "path_discontinuity_count", "connected_component_count", "boundary_edge_count", "non_manifold_edge_count",
)


def _snapshot_machine(raw: dict) -> tuple[dict, bytes | None]:
    params = _params(WeaveIn(**raw))
    _pos, _idx, report = build_unified(params, "draft")
    buf = io.BytesIO()
    plan_unified(params).save(buf, format="PNG")
    machine = {
        "exportable": not bool(report.get("export_blocked")),
        "reason": str(report.get("export_block_reason", "")),
        "issues": explain_issues(report),
        "counters": {key: report.get(key) for key in SNAPSHOT_COUNTERS},
    }
    return machine, buf.getvalue()


class ZoneIn(BaseModel):
    enabled: bool = True
    density_u: float | None = None
    density_v: float | None = None
    strand_width_u: float | None = None
    strand_width_v: float | None = None
    relief: float | None = None
    stagger: float | None = None
    weave_angle: float | None = None


class PolygonIn(BaseModel):
    points: list[list[float]] = Field(default_factory=list)
    density_u: float | None = None
    density_v: float | None = None
    strand_width_u: float | None = None
    relief: float | None = None


class LayerIn(BaseModel):
    model_config = {"extra": "allow"}
    id: str = "L2"
    name: str = "主图案"
    enabled: bool = True
    visible: bool = True
    locked: bool = False
    solo: bool = False
    algorithm: str = "radial-star"
    seed: int = 7
    density: float = 1.0
    strip_width: float = 1.55
    priority: int = 1


class WeaveIn(BaseModel):
    pattern: str = "plain"
    t_min: float = 0.2
    t_max: float = 1.8
    allow_extra_thickness: bool = False
    rim_width: float = 3.8
    rim_depth: float = 7.0
    contrast: float = 1.4
    dark_levels: int = 4
    smoothness: float = 0.8
    invert: bool = False
    density_u: float = 0.58
    density_v: float = 0.58
    strand_width_u: float = 3.4
    strand_width_v: float = 3.4
    relief: float = 0.72
    cell_aspect: float = 1.0
    stagger: float = 0.0
    weave_angle: float = 0.0
    frequency: float = 1.0
    amplitude: float = 2.2
    randomness: float = 0.0
    seed: int = 7
    blend_radius: float = 18.0
    target_height: float = 180.0
    frame_mm: float = 2.6
    geometry_lock: bool = True
    print_safe: bool = True
    show_master: bool = False
    diff_only: bool = False
    zones: dict[str, ZoneIn] = Field(default_factory=dict)
    polygons: list[PolygonIn] = Field(default_factory=list)
    brush: list[float] | None = None
    preset: str = ""
    layers: list[LayerIn] = Field(default_factory=list)
    crossing_locks: list[dict] = Field(default_factory=list)
    support_level: str = "off"
    support_density: float = 0.0
    support_motif: str = "bar-h"
    support_motifs: list[str] | None = None
    support_size: float = 3.2


class PreviewIn(BaseModel):
    params: WeaveIn
    quality: str = "draft"


class GenerateIn(BaseModel):
    params: WeaveIn
    quality: str = "recommended"
    name: str = "haitang"


class PrinterIn(BaseModel):
    nozzle_mm: float = 0.4
    layer_mm: float = 0.16
    material: str = "PLA"
    bed_x: float = 220
    bed_y: float = 220
    bed_z: float = 250


class ValidateIn(BaseModel):
    params: WeaveIn
    quality: str = "recommended"
    printer: PrinterIn = Field(default_factory=PrinterIn)


class PresetIn(BaseModel):
    name: str
    params: WeaveIn


class AlignIn(BaseModel):
    dx: float = 0
    dy: float = 0
    dz: float = 0
    rz_deg: float = 0
    user_confirmed_fit: bool = False


class RemoveTextIn(BaseModel):
    confirmed: bool = False


def _params(body: WeaveIn) -> dict:
    data = body.model_dump()
    base = default_params()
    zones = base["zones"]
    for key, zone in (data.get("zones") or {}).items():
        zones[key] = {**zones.get(key, {"enabled": True}), **{k: v for k, v in zone.items() if v is not None or k == "enabled"}}
        if zone.get("enabled") is None:
            zones[key]["enabled"] = True
    data["zones"] = zones
    return data


def _load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _pack_mesh(positions: np.ndarray, indices: np.ndarray, report: dict) -> bytes:
    colors = report.pop("_colors", None)
    pos = np.ascontiguousarray(positions, dtype=np.float32)
    idx = np.ascontiguousarray(indices, dtype=np.uint32)
    if colors is None:
        col = np.zeros((0,), np.uint8)
    else:
        col = np.ascontiguousarray(colors, dtype=np.uint8).reshape(-1)
    report_b = json.dumps(report, ensure_ascii=False).encode("utf-8")
    header = np.array([len(pos), len(idx), len(report_b), len(col)], dtype=np.uint32).tobytes()
    return header + pos.tobytes() + col.tobytes() + idx.tobytes() + report_b


def _print_check(report: dict, params: dict, printer: PrinterIn) -> dict:
    warnings = list(report.get("warnings") or [])
    extents = [
        report["bbox_max"][0] - report["bbox_min"][0],
        report["bbox_max"][1] - report["bbox_min"][1],
        report["bbox_max"][2] - report["bbox_min"][2],
    ]
    if params["strand_width_u"] < printer.nozzle_mm * 0.95 or params["strand_width_v"] < printer.nozzle_mm * 0.95:
        warnings.append(f"编织条宽度小于喷嘴 {printer.nozzle_mm} mm，细丝可能挤不出。")
    if 0 < params["t_min"] < printer.layer_mm:
        warnings.append(f"最薄处 {params['t_min']} mm 小于层高 {printer.layer_mm} mm。")
    if extents[0] > printer.bed_x or extents[1] > printer.bed_y or extents[2] > printer.bed_z:
        warnings.append("模型超出当前成型空间，需要缩小或更换设备。")
    if not report.get("z_envelope_ok") or not report.get("xy_envelope_ok"):
        warnings.append("轮廓或厚度外包络未通过数字比对。")
    level = "review" if warnings else "digital_pass"
    return {
        "level": level,
        "claim": "仅数字网格检查。未做切片器验证，也未做实体打印。",
        "slicer_tested": False,
        "physical_print_tested": False,
        "warnings": warnings,
        "extents_mm": [round(v, 3) for v in extents],
        "printer": printer.model_dump(),
    }


@app.on_event("startup")
def startup() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    EXPORTS.mkdir(parents=True, exist_ok=True)
    build_cache()
    if not BASELINE_PATH.exists():
        write_baseline_json()
    if not PRESETS_PATH.exists():
        params = default_params()
        fine = default_params()
        fine["pattern"] = "twill"
        fine["density_u"] = 1.15
        fine["density_v"] = 1.05
        fine["strand_width_u"] = 2.2
        fine["strand_width_v"] = 2.0
        wave = default_params()
        wave["pattern"] = "wave"
        wave["amplitude"] = 3.5
        wave["frequency"] = 1.4
        wave["zones"]["N"]["density_v"] = 1.3
        _save_json(
            PRESETS_PATH,
            [
                {"id": "classic", "name": "海棠原序", "params": params},
                {"id": "twill-dense", "name": "细密斜纹", "params": fine},
                {"id": "wave", "name": "波纹渐变", "params": wave},
            ],
        )
    if not ASSEMBLY_PATH.exists():
        _save_json(
            ASSEMBLY_PATH,
            {
                "status": "unconfirmed",
                "dx": 0,
                "dy": 0,
                "dz": 0,
                "rz_deg": 0,
                "user_confirmed_fit": False,
                "note": "源 STL 不在同一打印坐标。平移只写入装配文件，不改源顶点。",
            },
        )
    if not HANDLE_PATH.exists():
        _save_json(HANDLE_PATH, {"removed": False, "report": None})


@app.get("/api/health")
def health():
    return {"ok": True, "service": "haitang-weave-lab"}


@app.get("/api/project/baseline")
def baseline():
    cache = build_cache()
    doc = json.loads(BASELINE_PATH.read_text(encoding="utf-8")) if BASELINE_PATH.exists() else write_baseline_json()
    doc["preview_bounds"] = {
        "min": [round(float(v), 4) for v in cache["bbmin"]],
        "max": [round(float(v), 4) for v in cache["bbmax"]],
    }
    doc["handle_text"] = candidate_public()
    doc["handle_state"] = _load_json(HANDLE_PATH, {"removed": False})
    doc["assembly"] = _load_json(ASSEMBLY_PATH, {})
    doc["defaults"] = default_params()
    doc["unified"] = {
        "one_piece": True,
        "default_height_mm": 180,
        "bed_note": "默认总高 180 mm、宽约 114 mm，可平放在 220×220 mm 热床上。",
        "patterns": ["blank", "ripple", "radial", "cellular", "diamond", "plain"],
    }
    return doc


@app.get("/api/master/shell")
def master_shell():
    from app.geometry.master_lock import load_master, shell_preview

    master = load_master()
    pos, idx = shell_preview(master, 180)
    tris = pos[idx]
    from app.geometry.stl_io import write_stl
    import io

    buffer = io.BytesIO()
    tmp = ROOT / "data" / "_shell_preview.stl"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    write_stl(tmp, tris, header="HAITANG master shell")
    return FileResponse(tmp, media_type="model/stl", filename="master_shell.stl")


@app.get("/api/model/original/{part}")
def original_model(part: str):
    name = {"fan": "obj_2_fan.stl", "handle": "obj_1_handle_logo.stl"}.get(part)
    if not name:
        raise HTTPException(404, "unknown part")
    return FileResponse(ORIGINAL / name, media_type="model/stl", filename=name)


@app.post("/api/model/segment")
def segment():
    cache = build_cache()
    appendage = int((cache["solid"] & ~cache["body"]).sum())
    return {
        "rim_and_appendage": "locked",
        "weave": "editable inside the opened body, inset by rim_width",
        "other_component_review": {
            "triangles": int(len(cache["small"])),
            "policy": "原样保留为独立文件，不并入编织，不自动删除。",
        },
        "appendage_cells": appendage,
        "solid_cells": int(cache["solid"].sum()),
        "body_cells": int(cache["body"].sum()),
        "connection": "扇面角部凸起与扇柄花瓣头未自动判定为同一接口，装配保持未确认。",
    }


@app.get("/api/weave/layer-presets")
def layer_presets():
    from app.geometry.layers import reference_presets

    return reference_presets()


@app.post("/api/weave/plan")
def weave_plan(body: PreviewIn):
    img = plan_unified(_params(body.params))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")


@app.post("/api/weave/preview")
def weave_preview(body: PreviewIn):
    quality = body.quality if body.quality in {"draft", "recommended"} else "draft"
    positions, indices, report = build_unified(_params(body.params), quality)
    report["kind"] = "preview"
    report["issues"] = explain_issues(report)
    return Response(_pack_mesh(positions, indices, report), media_type="application/octet-stream")


@app.post("/api/weave/crossings")
def weave_crossings(body: PreviewIn):
    return crossing_view(_params(body.params))


class CraftDrawingIn(BaseModel):
    params: WeaveIn
    title: str = "海棠經緯"
    designer: str = ""
    drawing_no: str = ""
    lang: str = "zh-Hant"


def _drawing_png(raw: dict, title: str, designer: str, drawing_no: str, lang: str = "zh-Hant") -> bytes:
    return craft_drawing(_params(WeaveIn(**raw)), title[:40] or "海棠經緯", system_version(), designer[:20], drawing_no[:60], lang)


@app.post("/api/weave/effect.png")
def weave_effect(body: PreviewIn):
    png = effect_png(_params(body.params))
    folder = DATA / "drawings"
    folder.mkdir(parents=True, exist_ok=True)
    name = time.strftime("effect_%Y%m%d-%H%M%S.png")
    (folder / name).write_bytes(png)
    return Response(png, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@app.post("/api/weave/craft-drawing.png")
def weave_craft_drawing(body: CraftDrawingIn):
    png = _drawing_png(body.params.model_dump(), body.title, body.designer, body.drawing_no, body.lang)
    folder = DATA / "drawings"
    folder.mkdir(parents=True, exist_ok=True)
    name = time.strftime("craft_drawing_%Y%m%d-%H%M%S.png")
    (folder / name).write_bytes(png)
    return Response(png, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@app.post("/api/weave/fix")
def weave_fix(body: PreviewIn):
    """Search nearby main-layer settings for one that passes the export gate."""
    params = _params(body.params)
    quality = body.quality if body.quality in {"draft", "recommended", "high"} else "recommended"
    result = suggest_fix(
        params,
        lambda trial: build_unified(trial, "draft")[2],
        verify=None if quality == "draft" else lambda trial: build_unified(trial, quality)[2],
    )
    result.pop("params", None)
    return result


def _write_job(params: dict, quality: str, name: str) -> dict:
    positions, indices, report = build_unified(params, quality)
    report.pop("_colors", None)
    if report.get("export_blocked"):
        raise HTTPException(
            422,
            {"blocked": True, "quality": quality, "reason": report.get("export_block_reason", ""), "issues": explain_issues(report)},
        )
    job = uuid.uuid4().hex[:12]
    folder = EXPORTS / job
    folder.mkdir(parents=True, exist_ok=True)
    write_stl_from_indexed(folder / "fan_unified.stl", positions, indices)
    write_stl_from_indexed(folder / "fan_parametric.stl", positions, indices)
    handle_name = "fan_parametric.stl"
    write_glb(folder / "assembly_preview.glb", [("haitang_fan", positions, indices)], [_identity()])
    write_3mf(folder / "fan_parametric.3mf", [("haitang_fan", positions, indices)])
    write_3mf(folder / "fan_unified.3mf", [("haitang_fan", positions, indices)])
    _save_json(folder / "design_parameters.json", params)
    _save_json(folder / "geometry_comparison.json", report)
    guide = _printing_guide(report, params)
    (folder / "printing_guide.md").write_text(guide, encoding="utf-8")
    shutil.copyfile(BASELINE_PATH, folder / "geometry_baseline.json")
    _save_json(folder / "assembly_transform.json", {"one_piece": True, "note": "扇面与扇柄已焊成一个网格，没有分开的装配变换。"})
    _save_json(folder / "mesh_validation.json", {**report, "boundary_checked_in": "digital rebuild", "physical_print_tested": False})
    zip_path = folder / "all_files.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file in folder.iterdir():
            if file.name == "all_files.zip":
                continue
            zf.write(file, arcname=file.name)
    record = {
        "id": job,
        "name": name,
        "quality": quality,
        "report": report,
        "handle_file": handle_name,
        "files": sorted(p.name for p in folder.iterdir()),
        "created": time.time(),
    }
    _tasks[job] = {"status": "done", **record}
    _save_json(folder / "job.json", record)
    return record


def _identity() -> list[float]:
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def _matrix(assembly: dict) -> list[float]:
    import math

    a = math.radians(float(assembly.get("rz_deg", 0)))
    c, s = math.cos(a), math.sin(a)
    dx, dy, dz = float(assembly.get("dx", 0)), float(assembly.get("dy", 0)), float(assembly.get("dz", 0))
    # column-major
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, dx, dy, dz, 1]


def _indexed_from_tris(tris: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    flat = np.asarray(tris, dtype=np.float32).reshape(-1, 3)
    # Weld exact float32 matches so the GLB is smaller and closed where the STL was.
    _, inv = np.unique(np.round(flat, 4), axis=0, return_inverse=True)
    # unique of rounded values loses the original floats. Rebuild positions from first match.
    order = np.argsort(inv, kind="stable")
    first = np.empty(int(inv.max()) + 1, dtype=np.int64)
    seen = np.zeros(len(first), dtype=bool)
    for src in order:
        bucket = int(inv[src])
        if not seen[bucket]:
            first[bucket] = src
            seen[bucket] = True
    positions = flat[first]
    indices = inv.reshape(-1, 3).astype(np.uint32)
    return positions, indices


def _printing_guide(report: dict, params: dict) -> str:
    return "\n".join(
        [
            "# 海棠织序打印说明",
            "",
            "fan_parametric.stl 和 fan_parametric.3mf 是同一份网格：母版外框、护片、扇柄，加上内框竹编。",
            "外框、双瓣护片和扇柄的轮廓不随图案改变。",
            "护片背面的榫孔还没有从母版上挖掉。",
            "数字检查不是切片结果，也不是已经打印过的记录。3MF 只有几何。",
            "",
            f"- 纹样：{params.get('pattern')}",
            f"- 扇面厚度：{params.get('t_min')} – {params.get('t_max')} mm",
            f"- 边框与扇柄厚度：{params.get('frame_mm', 2.6)} mm",
            f"- 外形：{report.get('width_mm')} × {report.get('height_mm')} × {report.get('thickness_mm')} mm",
            f"- 220 mm 热床：{'可以平放' if report.get('fits_220') else '放不下，请降低目标高度'}",
            "- 平放打印，厚度方向朝上，一般不需要支撑。",
            "- 最薄处低于层高时，先打一块 20 mm 试片。",
            "",
        ]
    )


@app.post("/api/weave/generate")
def weave_generate(body: GenerateIn):
    quality = body.quality if body.quality in {"draft", "recommended", "high"} else "recommended"
    record = _write_job(_params(body.params), quality, body.name)
    return record


@app.post("/api/validate")
def validate(body: ValidateIn):
    quality = body.quality if body.quality in {"draft", "recommended", "high"} else "recommended"
    _positions, _indices, report = build_unified(_params(body.params), quality)
    report.pop("_colors", None)
    return {"report": report, "print": _print_check(report, _params(body.params), body.printer)}


@app.post("/api/export")
def export(body: GenerateIn):
    return weave_generate(body)


@app.get("/api/exports/{job}/{filename}")
def download(job: str, filename: str):
    if "/" in job or "\\" in job or "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(400, "bad path")
    path = EXPORTS / job / filename
    if not path.exists():
        raise HTTPException(404, "missing file")
    return FileResponse(path, filename=filename)


@app.post("/api/handle/remove-text")
def remove_text(body: RemoveTextIn):
    if not body.confirmed:
        raise HTTPException(400, "需要 confirmed=true。未确认时不修改扇柄。")
    dest = DATA / "handle_clean.stl"
    report = remove_confirmed_text(ORIGINAL / "obj_1_handle_logo.stl", dest)
    state = {"removed": True, "report": report}
    _save_json(HANDLE_PATH, state)
    return state


@app.post("/api/handle/restore")
def restore_handle():
    state = {"removed": False, "report": None}
    _save_json(HANDLE_PATH, state)
    return state


@app.get("/api/handle/candidate")
def handle_candidate():
    return {"candidate": candidate_public(), "state": _load_json(HANDLE_PATH, {"removed": False})}


@app.post("/api/assembly/align")
def align(body: AlignIn):
    fan = read_stl(ORIGINAL / "obj_2_fan.stl")
    handle = read_stl(ORIGINAL / "obj_1_handle_logo.stl")
    fmin, fmax = fan.reshape(-1, 3).min(0), fan.reshape(-1, 3).max(0)
    hmin, hmax = handle.reshape(-1, 3).min(0), handle.reshape(-1, 3).max(0)
    hmin = hmin + np.array([body.dx, body.dy, body.dz])
    hmax = hmax + np.array([body.dx, body.dy, body.dz])
    overlap = np.maximum(0, np.minimum(fmax, hmax) - np.maximum(fmin, hmin))
    payload = {
        "status": "user_marked" if body.user_confirmed_fit else "unconfirmed",
        "dx": body.dx,
        "dy": body.dy,
        "dz": body.dz,
        "rz_deg": body.rz_deg,
        "user_confirmed_fit": body.user_confirmed_fit,
        "aabb_overlap_mm": [round(float(v), 3) for v in overlap],
        "metrology_verified": False,
        "note": "包围盒重叠只是粗检查。用户确认也不等于接口已经测量通过。源 STL 顶点未移动。",
    }
    _save_json(ASSEMBLY_PATH, payload)
    return payload


@app.get("/api/presets")
def list_presets():
    return _load_json(PRESETS_PATH, [])


@app.post("/api/presets")
def create_preset(body: PresetIn):
    items = _load_json(PRESETS_PATH, [])
    item = {"id": uuid.uuid4().hex[:8], "name": body.name, "params": body.params.model_dump()}
    items.append(item)
    _save_json(PRESETS_PATH, items)
    return item


@app.put("/api/presets/{preset_id}")
def update_preset(preset_id: str, body: PresetIn):
    items = _load_json(PRESETS_PATH, [])
    for item in items:
        if item["id"] == preset_id:
            item["name"] = body.name
            item["params"] = body.params.model_dump()
            _save_json(PRESETS_PATH, items)
            return item
    raise HTTPException(404, "preset not found")


@app.delete("/api/presets/{preset_id}")
def delete_preset(preset_id: str):
    items = _load_json(PRESETS_PATH, [])
    nxt = [item for item in items if item["id"] != preset_id]
    if len(nxt) == len(items):
        raise HTTPException(404, "preset not found")
    _save_json(PRESETS_PATH, nxt)
    return {"ok": True}


@app.get("/api/tasks/{task_id}")
def task(task_id: str):
    if task_id not in _tasks:
        path = EXPORTS / task_id / "job.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        raise HTTPException(404, "task not found")
    return _tasks[task_id]


app.include_router(build_session_router(DATA, _snapshot_machine, _drawing_png))

WEB = ROOT / "frontend" / "dist"
if WEB.is_dir() and (WEB / "index.html").exists():
    app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
else:

    @app.get("/")
    def no_web():
        return HTMLResponse(
            "<p>接口已启动。开发时请打开 <a href='http://127.0.0.1:5173/'>http://127.0.0.1:5173/</a></p>",
            status_code=200,
        )
