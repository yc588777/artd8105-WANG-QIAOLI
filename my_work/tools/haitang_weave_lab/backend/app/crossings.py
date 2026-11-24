"""Crossing view (F6): which strip goes over at every crossing, and the over/under
sequence a weaver would follow along each strip.

Coordinates are returned in plan-image pixels so the interface can draw them
straight over the plan picture.
"""
from __future__ import annotations

import numpy as np

LONG_FLOAT = 3


def _runs(sequence: str) -> list[int]:
    runs: list[int] = []
    for index, mark in enumerate(sequence):
        if index and mark == sequence[index - 1]:
            runs[-1] += 1
        else:
            runs.append(1)
    return runs


def compose_for_view(params: dict) -> tuple[dict, float, list, dict]:
    from app.geometry.layers import compose_layers
    from app.geometry.master_lock import REF_HEIGHT_MM, load_master, scale_of

    master = load_master()
    target = float(np.clip(params.get("target_height", REF_HEIGHT_MM), 120.0, 220.0))
    factor = scale_of(master, target)
    packed, meta = compose_layers(master, params, factor, "draft")
    return master, factor, packed, meta


def crossing_view(params: dict, composed: tuple | None = None) -> dict:
    master, factor, packed, meta = composed or compose_for_view(params)
    h, w = master["solid"].shape
    pitch = float(master["pitch"] * master["scale"] * factor)
    x0 = float(master["x0"] * master["scale"] * factor)
    y0 = float(master["z0"] * master["scale"] * factor)

    def px(x: float, y: float) -> tuple[float, float]:
        return round((x - x0) / pitch, 1), round(h - 1 - (y - y0) / pitch, 1)

    from app.craft_drawing import _without_entry_hooks, apply_layer_colors

    layers = list(meta.get("strand_layers") or [])
    default_thick = float(np.clip(params.get("ribbon_thickness", 1.2) or 1.2, 0.6, 2.2))
    default_thick = min(default_thick, max(float(params.get("rim_depth", 7) or 7) - 0.4, 0.6))
    strands = []
    arcs = []
    for index, row in enumerate(packed):
        line = np.asarray(row[0], np.float32)[:, :2]
        arc = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))])
        arcs.append((line, arc))
        z = np.broadcast_to(np.asarray(row[4], np.float32), (len(line),))
        keep = np.unique(np.linspace(0, len(line) - 1, min(len(line), 420)).round().astype(int))
        color = "#%02x%02x%02x" % tuple(int(v) for v in row[1])
        samples = [px(float(line[k, 0]), float(line[k, 1])) for k in keep]
        samples = [tuple(float(v) for v in p) for p in _without_entry_hooks(samples, pitch)]
        strands.append({
            "id": index,
            "layer": layers[index] if index < len(layers) else "",
            "z_sign": float(row[3]),
            "color": color,
            "width_mm": round(float(row[2]), 2),
            "thick_mm": round(float(row[5]) if len(row) > 5 else default_thick, 2),
            "width_px": round(float(row[2]) / pitch, 2),
            "points": samples,
            "profile": [[round(float(arc[k]), 2), round(float(z[k]), 3)] for k in keep],
            "length_mm": round(float(arc[-1]), 1),
            "crossings": [],
            "role": "weave",
        })
    apply_layer_colors(strands)

    def arc_at(strand: int, x: float, y: float) -> float:
        line, arc = arcs[strand]
        nearest = int(np.argmin(np.linalg.norm(line - np.array([x, y], np.float32), axis=1)))
        return float(arc[nearest])

    crossings = []
    for number, item in enumerate(meta.get("crossing_table") or [], start=1):
        over, under = int(item["over"]), int(item["under"])
        # A pattern strip lies on top of the base for its whole length. Those hits are not picks.
        if strands[over].get("role") != strands[under].get("role"):
            continue
        cx, cy = px(item["x"], item["y"])
        crossings.append({"n": number, "x": cx, "y": cy, "over": over, "under": under})
        for strand, mark in ((over, "O"), (under, "U")):
            strands[strand]["crossings"].append({"n": number, "s": round(arc_at(strand, item["x"], item["y"]), 2), "mark": mark})

    pairs = alternating = long_floats = 0
    for strand in strands:
        strand["crossings"].sort(key=lambda c: c["s"])
        sequence = "".join(c["mark"] for c in strand["crossings"])
        strand["sequence"] = sequence
        runs = _runs(sequence)
        strand["longest_float"] = max(runs) if runs else 0
        long_floats += strand["longest_float"] >= LONG_FLOAT
        pairs += max(len(sequence) - 1, 0)
        alternating += sum(a != b for a, b in zip(sequence, sequence[1:]))

    return {
        "x0_mm": x0,
        "y0_mm": y0,
        "width": int(w),
        "height": int(h),
        "pitch_mm": round(pitch, 4),
        "strands": strands,
        "crossings": crossings,
        "summary": {
            "strand_count": len(strands),
            "crossing_count": len(crossings),
            "alternation_rate": round(alternating / pairs, 3) if pairs else None,
            "strands_with_long_float": int(long_floats),
            "long_float_threshold": LONG_FLOAT,
        },
    }
