import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.geometry.layers import preset_by_id  # noqa: E402
from app.geometry.unified import build_unified  # noqa: E402
from app.geometry.weave_ribbons import mesh_from_strands  # noqa: E402


def _base(preset_id: str) -> dict:
    preset = preset_by_id(preset_id)
    assert preset is not None
    return {
        "pattern": preset["pattern"],
        "preset": preset_id,
        "layers": [dict(item) for item in preset["layers"]],
        "geometry_lock": True,
        "print_safe": True,
        "t_min": 0,
        "t_max": 2.2,
        "density_u": 1.2,
        "density_v": 1.2,
        "strand_width_u": 1.6,
        "strand_width_v": 1.6,
        "seed": preset["seed"],
        "target_height": 180,
        "amplitude": 2.4,
        "frequency": 1.2,
        "weave_angle": 0,
        "relief": 0.4,
        "crossing_locks": [],
    }


def test_solo_presets_drop_loose_ends_and_keep_the_shell():
    hashes = set()
    for preset_id in ("plain-weave", "radial-star", "ripple-wave", "cellular-growth", "rotating-diamond"):
        _pos, _, report = build_unified(_base(preset_id), "draft")
        report.pop("_colors", None)
        hashes.add(report["fixed_hash"])
        assert report["curve_count"] >= 4
        assert report["short_fragment_count"] == 0
        assert report["visible_endpoint_count"] == 0
        assert report["unanchored_strip_count"] == 0
        assert report["silhouette_deviation_mm"] <= 0.10
    assert len(hashes) == 1
    low = _base("radial-star")
    low["layers"][1]["density"] = 0.45
    low["layers"][1]["spoke_count"] = 10
    high = _base("radial-star")
    high["layers"][1]["density"] = 1.5
    high["layers"][1]["spoke_count"] = 36
    _, _, report_low = build_unified(low, "draft")
    pos_high, _, report_high = build_unified(high, "draft")
    assert report_low["fixed_hash"] == report_high["fixed_hash"]
    assert report_low["width_mm"] == report_high["width_mm"]
    assert report_low["layer_curves"]["L2"] != report_high["layer_curves"]["L2"]
    assert np.isfinite(pos_high).all()


def test_ripple_amplitude_changes_geometry():
    quiet = _base("ripple-wave")
    quiet["layers"][1]["amplitude"] = 0.2
    loud = _base("ripple-wave")
    loud["layers"][1]["amplitude"] = 9.0
    pos_a, _, report_a = build_unified(quiet, "draft")
    pos_b, _, report_b = build_unified(loud, "draft")
    assert report_a["fixed_hash"] == report_b["fixed_hash"]
    assert not np.array_equal(pos_a, pos_b)


def test_preview_strips_are_flatter_than_they_are_wide():
    line = np.column_stack([np.linspace(0, 20, 8), np.zeros(8)]).astype(np.float32)
    params = {"print_safe": True, "t_max": 2.2, "_flat_section": True}
    positions, _, _ = mesh_from_strands([(line, np.array([180, 150, 90], np.uint8), 1.6, 1.0)], params)
    width = float(positions[:, 1].max() - positions[:, 1].min())
    thick = float(positions[:, 2].max() - positions[:, 2].min())
    assert thick < width
    assert thick <= 1.25
    assert params["_used_thick"] <= 1.25
