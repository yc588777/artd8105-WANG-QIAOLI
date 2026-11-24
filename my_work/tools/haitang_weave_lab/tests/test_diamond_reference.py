import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.geometry.layers import compose_layers, preset_by_id  # noqa: E402
from app.geometry.master_lock import load_master, scale_of  # noqa: E402
from app.geometry.unified import build_unified  # noqa: E402


def _params(**over) -> dict:
    preset = preset_by_id("rotating-diamond-reference")
    assert preset is not None
    params = {
        "pattern": preset["pattern"],
        "preset": preset["id"],
        "layers": [dict(item) for item in preset["layers"]],
        "geometry_lock": True,
        "print_safe": True,
        "t_min": 0,
        "t_max": 2.2,
        "seed": preset["seed"],
        "target_height": 180,
        "rim_width": 5.5,
        "rim_depth": 7.0,
        "crossing_locks": [],
    }
    params.update(over)
    return params


def _set_layer(params: dict, **fields) -> dict:
    layers = [dict(item) for item in params["layers"]]
    layers[1].update(fields)
    params = dict(params)
    params["layers"] = layers
    return params


def test_reference_preset_is_continuous_and_keeps_the_outline():
    master = load_master()
    params = _params()
    _pos, _idx, report = build_unified(params, "draft")
    report.pop("_colors", None)
    assert report["fixed_hash"] == master["fixed_hash"]
    assert report["width_mm"] == 113.93
    assert report["height_mm"] == 180.0
    assert abs(report["aspect"] - 0.6329) < 0.01
    assert report["reference_aspect"] == 0.66012
    assert report["path_continuity"] == "PASS"
    assert report["visible_endpoint_count"] == 0
    assert report["short_fragment_count"] == 0
    assert report["unanchored_strip_count"] == 0
    assert report["curve_count"] >= 16
    assert report["crossing_count"] >= 20
    assert report["printable_mesh"] == "PASS"
    assert report["boolean_union"] is True
    assert report["boundary_edge_count"] == 0
    assert report["non_manifold_edge_count"] == 0


def test_pattern_and_rim_depth_do_not_move_the_outline():
    base = build_unified(_params(), "draft")[2]
    wide = build_unified(_set_layer(_params(), center_spacing=16, edge_spacing=8), "draft")[2]
    deep = build_unified(_params(rim_depth=10, rim_width=7.5), "draft")[2]
    for report in (base, wide, deep):
        report.pop("_colors", None)
        assert report["fixed_hash"] == base["fixed_hash"]
        assert report["width_mm"] == base["width_mm"]
        assert report["height_mm"] == base["height_mm"]
    assert wide["curve_count"] != base["curve_count"] or wide["crossing_count"] != base["crossing_count"]


def test_reference_lattice_is_nearly_symmetric():
    master = load_master()
    factor = scale_of(master, 180)
    strands, meta = compose_layers(master, _params(), factor, "draft")
    assert meta["visible_endpoint_count"] == 0
    mids = []
    for item in strands:
        line = item[0]
        mids.append(line[len(line) // 2])
    mids = np.asarray(mids, np.float32)
    cx = float(np.median(mids[:, 0]))
    missed = 0
    for mid in mids:
        reflected = np.array([2 * cx - mid[0], mid[1]], np.float32)
        if float(np.linalg.norm(mids - reflected, axis=1).min()) > 4.0:
            missed += 1
    assert missed <= max(2, len(mids) // 10)


def test_legal_diamond_combos_stay_anchored():
    master = load_master()
    factor = scale_of(master, 180)
    rng = np.random.default_rng(5205)
    for _ in range(12):
        params = _set_layer(
            _params(),
            center_spacing=float(rng.uniform(10, 16)),
            edge_spacing=float(rng.uniform(4.5, 8)),
            rotation_strength=float(rng.uniform(0, 0.6)),
            strip_width=float(rng.uniform(2.4, 3.6)),
            density=float(rng.uniform(0.7, 1.3)),
        )
        _strands, meta = compose_layers(master, params, factor, "draft")
        assert meta["visible_endpoint_count"] == 0
        assert meta["short_fragment_count"] == 0
        assert meta["unanchored_strip_count"] == 0
        assert meta["curve_count"] >= 8
