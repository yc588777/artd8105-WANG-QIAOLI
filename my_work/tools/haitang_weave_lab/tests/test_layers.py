import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.geometry.layers import preset_by_id, reference_presets  # noqa: E402
from app.geometry.unified import build_unified  # noqa: E402


def _base(preset_id: str) -> dict:
    preset = preset_by_id(preset_id)
    assert preset is not None
    return {
        "pattern": preset["pattern"],
        "preset": preset_id,
        "layers": preset["layers"],
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


def test_reference_presets_share_the_locked_shell():
    reports = []
    for preset in reference_presets()[:4]:
        _pos, _idx, report = build_unified(_base(preset["id"]), "draft")
        report.pop("_colors", None)
        reports.append(report)
        assert report["geometry_lock"] == "PASS"
        assert report["outer_silhouette"] == "PASS"
        assert report["silhouette_deviation_mm"] <= 0.10
        assert np.isfinite(_pos).all()
    hashes = {item["fixed_hash"] for item in reports}
    assert len(hashes) == 1
    sizes = {(item["width_mm"], item["height_mm"], item["guard_width_mm"], item["handle_length_mm"]) for item in reports}
    assert len(sizes) == 1


def test_same_seed_repeats_and_layer_edit_keeps_the_shell():
    params = _base("radial-star")
    first, _, report_a = build_unified(params, "draft")
    second, _, report_b = build_unified(params, "draft")
    report_a.pop("_colors", None)
    report_b.pop("_colors", None)
    assert np.array_equal(first, second)
    assert report_a["fixed_hash"] == report_b["fixed_hash"]
    edited = _base("radial-star")
    edited["layers"][1]["density"] = 0.6
    _pos, _, report_c = build_unified(edited, "draft")
    report_c.pop("_colors", None)
    assert report_c["fixed_hash"] == report_a["fixed_hash"]
    assert report_c["width_mm"] == report_a["width_mm"]
    assert not np.array_equal(first, _pos)
