"""Handle text is a recessed engraving candidate. Nothing is deleted unless confirmed."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .stl_io import read_stl, triangle_bounds, write_stl

# Measured in Blender from vertices lying on the recess floor (z ≈ 5.41).
# The lobed head (higher Y) and the end hole use other Z levels and are outside this box.
TEXT_CANDIDATE = {
    "status": "candidate_needs_confirmation",
    "auto_remove": False,
    "confidence": 0.74,
    "method": "Vertices at z=5.41 form a 6.3×61.7 band on the shaft. A grazing Blender view shows recessed letter-like strokes there. The lobed head, end hole, and side shelves were not included.",
    "bbox_min": [434.08, 48.55],
    "bbox_max": [441.17, 111.00],
    "z_move_from": 5.15,
    "z_surface": 6.0,
    "preserve": [
        "Lobed head around Y 162–196, including Z 4.2 and Z 1.8 shelves",
        "End hole and full-length side geometry below z 5.15",
        "Outer handle silhouette, thickness 6, and source coordinates",
    ],
}


def candidate_public() -> dict:
    return dict(TEXT_CANDIDATE)


def remove_confirmed_text(source: Path, dest: Path) -> dict:
    """Lift only the shallow recess inside the confirmed box back to the top face."""
    tris = read_stl(source)
    before_min, before_max = triangle_bounds(tris)
    box0, box1 = TEXT_CANDIDATE["bbox_min"], TEXT_CANDIDATE["bbox_max"]
    z0 = float(TEXT_CANDIDATE["z_move_from"])
    z1 = float(TEXT_CANDIDATE["z_surface"])
    flat = tris.reshape(-1, 3)
    inside = (
        (flat[:, 0] >= box0[0])
        & (flat[:, 0] <= box1[0])
        & (flat[:, 1] >= box0[1])
        & (flat[:, 1] <= box1[1])
        & (flat[:, 2] >= z0)
        & (flat[:, 2] < z1 - 0.02)
    )
    moved = int(inside.sum())
    if moved < 30:
        raise RuntimeError("确认区域内没有足够的下凹顶点，已中止，未写出修改模型。")
    flat[inside, 2] = z1
    a = tris[:, 1] - tris[:, 0]
    b = tris[:, 2] - tris[:, 0]
    area = np.linalg.norm(np.cross(a, b), axis=1)
    kept = tris[area > 1e-5]
    after_min, after_max = triangle_bounds(kept)
    outside = ~(
        (flat[:, 0] >= box0[0])
        & (flat[:, 0] <= box1[0])
        & (flat[:, 1] >= box0[1])
        & (flat[:, 1] <= box1[1])
    )
    # Vertices outside the box were not assigned. Compare against a fresh read.
    original = read_stl(source).reshape(-1, 3)
    # After degenerates are dropped, outside-face vertices remain in `kept`.
    write_stl(dest, kept, header="HAITANG handle text removed inside confirmed box")
    report = {
        "confirmed": True,
        "vertices_lifted": moved,
        "triangles_in": int(len(tris)),
        "triangles_out": int(len(kept)),
        "triangles_dropped_degenerate": int(len(tris) - len(kept)),
        "bbox_before": [round(float(v), 5) for v in before_min] + [round(float(v), 5) for v in before_max],
        "bbox_after": [round(float(v), 5) for v in after_min] + [round(float(v), 5) for v in after_max],
        "bbox_delta_mm": [round(float(v), 5) for v in (after_max - after_min) - (before_max - before_min)],
        "outside_vertex_count": int(outside.sum()),
        "rule": "Only vertices inside the confirmed XY box and z in [5.15, 6) moved to z=6. Degenerate wall triangles dropped.",
        "not_a_physical_test": True,
    }
    # Outside vertices of surviving triangles must match some original vertex.
    kept_flat = kept.reshape(-1, 3)
    outside_kept = ~(
        (kept_flat[:, 0] >= box0[0])
        & (kept_flat[:, 0] <= box1[0])
        & (kept_flat[:, 1] >= box0[1])
        & (kept_flat[:, 1] <= box1[1])
    )
    # Exact coordinate identity: round to 1e-4 which is finer than the STL float32 noise we already have.
    def keys(arr: np.ndarray) -> set[tuple]:
        r = np.round(arr, 4)
        return set(map(tuple, r.tolist()))

    missing = keys(kept_flat[outside_kept]) - keys(original)
    report["outside_vertices_not_in_source"] = len(missing)
    report["passed_outside_unchanged"] = len(missing) == 0
    dest.with_suffix(".report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report
