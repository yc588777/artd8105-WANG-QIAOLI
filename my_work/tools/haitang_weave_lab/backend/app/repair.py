"""Plain-language refusals (F4): what blocked an export, and a nearby design that passes.

The interface turns the issue codes into sentences; this module only decides
which issues apply and which small parameter change clears them.
"""
from __future__ import annotations

import copy
import time
from typing import Callable

ISSUES = (
    ("free_end", ("interior_endpoint_count", "visible_endpoint_count")),
    ("shallow", ("insufficient_embed_count",)),
    ("short", ("short_fragment_count",)),
    ("unanchored", ("unanchored_strip_count",)),
    ("gap", ("path_discontinuity_count",)),
)


def explain(report: dict) -> list[dict]:
    """Issue codes with counts, most serious first."""
    issues = []
    for code, keys in ISSUES:
        count = sum(int(report.get(key, 0) or 0) for key in keys)
        if count:
            issues.append({"code": code, "count": count})
    pieces = int(report.get("connected_component_count", 1) or 1)
    open_mesh = int(report.get("boundary_edge_count", 0) or 0) + int(report.get("non_manifold_edge_count", 0) or 0)
    if pieces > 1 and report.get("printable_mesh") == "FAIL" and not open_mesh:
        issues.append({"code": "loose", "count": pieces - 1})
    elif report.get("printable_mesh") == "FAIL":
        issues.append({"code": "mesh", "count": 1})
    if str(report.get("pattern", "")) != "blank" and int(report.get("curve_count", 0) or 0) == 0:
        issues.append({"code": "empty", "count": 1})
    return issues


def primary_index(params: dict) -> int | None:
    """Same rule as the interface sliders: the first visible layer that carries a pattern."""
    for index, layer in enumerate(params.get("layers") or []):
        if layer.get("enabled") is False or layer.get("visible") is False:
            continue
        if str(layer.get("algorithm", "")) in {"plain", "none"}:
            continue
        return index
    return None


def _candidates(layer: dict, codes: set[str]) -> list[dict]:
    """Small edits to the main layer, ordered from least to most visible change."""
    density = float(layer.get("density", 1.0))
    width = float(layer.get("strip_width", 1.55))
    lift = float(layer.get("crossing_lift", 1.0))
    seed = int(layer.get("seed", 7))
    algo = str(layer.get("algorithm", ""))
    out: list[dict] = []
    if codes & {"loose", "mesh"}:
        out += [{"strip_width": round(min(width + 0.3, 3.2), 2)}, {"crossing_lift": round(max(lift * 0.7, 0.4), 2)}]
    out += [{"seed": seed + 1}, {"seed": seed + 2}]
    if "diamond" in algo:
        for key in ("arc_a", "arc_b"):
            if abs(float(layer.get(key, 0) or 0)) > 4:
                out.append({key: round(float(layer[key]) * 0.5, 2)})
        out.append({"direction_a": round(float(layer.get("direction_a", 0) or 0) * 0.5, 2), "direction_b": round(float(layer.get("direction_b", 0) or 0) * 0.5, 2)})
    if "radial" in algo:
        if layer.get("spoke_count"):
            out.append({"spoke_count": max(8, int(layer["spoke_count"]) - 4)})
        if layer.get("ring_count"):
            out.append({"ring_count": max(4, int(layer["ring_count"]) - 2)})
    if "ripple" in algo and layer.get("amplitude"):
        out.append({"amplitude": round(float(layer["amplitude"]) * 0.7, 2)})
    if "cellular" in algo and layer.get("randomness"):
        out.append({"randomness": round(float(layer["randomness"]) * 0.5, 2)})
    out += [
        {"density": round(max(density * 0.85, 0.35), 3)},
        {"strip_width": round(min(width + 0.3, 3.2), 2)},
        {"density": round(max(density * 0.7, 0.35), 3)},
        {"density": round(max(density * 0.85, 0.35), 3), "seed": seed + 1},
    ]
    seen: list[dict] = []
    for edit in out:
        if edit not in seen and any(layer.get(k) != v for k, v in edit.items()):
            seen.append(edit)
    return seen


def suggest_fix(
    params: dict,
    build: Callable[[dict], dict],
    verify: Callable[[dict], dict] | None = None,
    budget_s: float = 90.0,
    max_tries: int = 10,
) -> dict:
    """Try nearby designs until one passes the export gate.

    `build(params)` returns a report from the fast draft mesh; `verify`, when given,
    rebuilds at export quality, because a draft pass can still split at export.
    """
    started = time.perf_counter()
    check = verify or build
    report = check(params)
    issues = explain(report)
    if not report.get("export_blocked"):
        return {"needed": False, "issues": issues, "found": False, "tried": 0, "seconds": 0.0}
    index = primary_index(params)
    if index is None or (params["layers"][index].get("locked")):
        return {"needed": True, "issues": issues, "found": False, "tried": 0, "seconds": 0.0, "why": "no_layer"}
    layer = params["layers"][index]
    codes = {item["code"] for item in issues}
    tried = 0
    for edit in _candidates(layer, codes)[:max_tries]:
        if time.perf_counter() - started > budget_s:
            break
        trial = copy.deepcopy(params)
        trial["layers"][index].update(edit)
        tried += 1
        if build(trial).get("export_blocked"):
            continue
        if verify is None or not verify(trial).get("export_blocked"):
            return {
                "needed": True,
                "issues": issues,
                "found": True,
                "layer": index,
                "changes": [{"key": key, "from": layer.get(key), "to": value} for key, value in edit.items()],
                "params": trial,
                "tried": tried,
                "seconds": round(time.perf_counter() - started, 1),
            }
    return {"needed": True, "issues": issues, "found": False, "tried": tried, "seconds": round(time.perf_counter() - started, 1)}
