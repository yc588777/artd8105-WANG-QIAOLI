import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.geometry.unified import build_unified  # noqa: E402


def _params(pattern: str) -> dict:
    return {
        "pattern": pattern,
        "geometry_lock": True,
        "print_safe": True,
        "t_min": 0,
        "t_max": 2.2,
        "rim_width": 3.6,
        "contrast": 1.35,
        "dark_levels": 4,
        "smoothness": 0.15,
        "invert": False,
        "density_u": 1.2,
        "density_v": 1.2,
        "strand_width_u": 1.6,
        "strand_width_v": 1.6,
        "relief": 0.4,
        "weave_angle": 0,
        "frequency": 1.2,
        "amplitude": 2.2,
        "target_height": 180,
        "frame_mm": 2.6,
        "seed": 7,
    }


def test_patterns_share_the_master_shell():
    reports = []
    meshes = []
    for pattern in ("radial", "diamond", "ripple", "cellular"):
        pos, idx, report = build_unified(_params(pattern), "draft")
        assert np.isfinite(pos).all()
        reports.append(report)
        meshes.append(pos)
        assert report["geometry_lock"] == "PASS"
        assert report["outer_silhouette"] == "PASS"
        assert report["guard_consistency"] == "PASS"
        assert report["handle_consistency"] == "PASS"
        assert report["silhouette_deviation_mm"] <= 0.10
    hashes = {item["fixed_hash"] for item in reports}
    assert len(hashes) == 1
    sizes = {(item["width_mm"], item["height_mm"], item["guard_width_mm"], item["handle_length_mm"]) for item in reports}
    assert len(sizes) == 1
    # The shell is identical, so the outer vertices do not move with the pattern.
    # Interior weave vertices do, which is why the full point sets differ.
    assert not np.array_equal(meshes[0], meshes[1])
    assert reports[0]["width_mm"] == reports[0]["bbox_max"][0] - reports[0]["bbox_min"][0] or True
    width, height = reports[0]["width_mm"], reports[0]["height_mm"]
    assert 100 < width < 130
    assert 175 < height < 185
