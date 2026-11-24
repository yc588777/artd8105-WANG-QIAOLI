import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.geometry.layers import _elevate, compose_layers, preset_by_id  # noqa: E402
from app.geometry.master_lock import load_master, scale_of  # noqa: E402
from app.geometry.unified import build_unified  # noqa: E402


def _base(preset_id: str, **over) -> dict:
    preset = preset_by_id(preset_id)
    assert preset is not None
    params = {
        "pattern": preset["pattern"],
        "preset": preset_id,
        "layers": [dict(item) for item in preset["layers"]],
        "geometry_lock": True,
        "print_safe": True,
        "t_min": 0,
        "t_max": 2.2,
        "density_u": 1.0,
        "density_v": 1.0,
        "strand_width_u": 1.6,
        "strand_width_v": 1.6,
        "seed": preset["seed"],
        "target_height": 180,
        "amplitude": 4.0,
        "frequency": 1.0,
        "weave_angle": 0,
        "relief": 0.45,
        "crossing_locks": [],
    }
    params.update(over)
    return params


def _graph(preset_id: str, **over):
    master = load_master()
    params = _base(preset_id, **over)
    factor = scale_of(master, 180)
    _packed, meta = compose_layers(master, params, factor, "draft")
    return meta


def test_outline_stays_put_when_the_pattern_changes():
    hashes = set()
    sizes = set()
    for preset_id in ("radial-star", "ripple-wave", "cellular-growth", "rotating-diamond"):
        _pos, _idx, report = build_unified(_base(preset_id), "draft")
        report.pop("_colors", None)
        hashes.add(report["fixed_hash"])
        sizes.add((report["width_mm"], report["height_mm"], report["aspect"]))
        assert report["silhouette_deviation_mm"] <= 0.5
    assert len(hashes) == 1
    assert len(sizes) == 1


def test_presets_have_no_free_ends():
    for preset_id in ("radial-star", "ripple-wave", "cellular-growth", "rotating-diamond"):
        meta = _graph(preset_id)
        assert meta["curve_count"] >= 4, preset_id
        assert meta["visible_endpoint_count"] == 0, preset_id
        assert meta["short_fragment_count"] == 0, preset_id
        assert meta["unanchored_strip_count"] == 0, preset_id
        assert meta["interior_degree_one_node_count"] == 0, preset_id
        assert meta["continuous_path_coverage"] == 1


def test_visible_sliders_change_the_graph():
    quiet = _graph("ripple-wave")
    loud = _graph("ripple-wave")
    # amplitude lives on the primary layer
    master = load_master()
    factor = scale_of(master, 180)
    low = _base("ripple-wave")
    high = _base("ripple-wave")
    low["layers"][1]["amplitude"] = 0.2
    high["layers"][1]["amplitude"] = 9.0
    packed_low, meta_low = compose_layers(master, low, factor, "draft")
    packed_high, meta_high = compose_layers(master, high, factor, "draft")
    assert meta_low["curve_count"] >= 4 and meta_high["curve_count"] >= 4

    def wave_span(packed):
        spans = []
        for item in packed:
            line = item[0]
            x_span = float(line[:, 0].max() - line[:, 0].min())
            y_span = float(line[:, 1].max() - line[:, 1].min())
            if x_span > y_span and line.shape[0] > 4:
                spans.append(y_span)
        return max(spans)

    assert wave_span(packed_high) > wave_span(packed_low) + 1.0
    sparse = _base("radial-star")
    dense = _base("radial-star")
    sparse["layers"][1]["spoke_count"] = 8
    dense["layers"][1]["spoke_count"] = 32
    meta_sparse = compose_layers(master, sparse, factor, "draft")[1]
    meta_dense = compose_layers(master, dense, factor, "draft")[1]
    assert meta_sparse["layer_curves"]["L2"] != meta_dense["layer_curves"]["L2"]
    assert quiet["curve_count"] >= 4 and loud["curve_count"] >= 4


def test_crossings_alternate_instead_of_stacking_one_path_on_top():
    horizontal = np.column_stack([np.linspace(0, 30, 8), np.full(8, 10.0)])
    verticals = [
        np.column_stack([np.full(8, x), np.linspace(0, 20, 8)])
        for x in (8.0, 16.0, 24.0)
    ]
    strands = []
    for index, line in enumerate([horizontal, *verticals]):
        strands.append({
            "line": line.astype(np.float32),
            "index": index,
            "priority": 5 if index == 0 else 0,
            "base_z": 0.2,
            "wave_amplitude": 0.0,
            "wave_frequency": 1.0,
            "wave_phase": 0.0,
            "crossing_lift": 0.2,
            "layer_id": "L2" if index == 0 else "L1",
        })
    crossings = []
    for index, line in enumerate(verticals, start=1):
        crossings.append({"a": 0, "b": index, "point": np.array([line[0, 0], 10.0], np.float32), "sa": 0, "sb": 0})
    _elevate(strands, crossings, [], True)
    overs = [item["over"] for item in crossings]
    assert overs[0] != overs[1]
    center = strands[0]["z"]
    assert float(center.max() - center.min()) > 0.4


def test_export_is_one_closed_solid():
    _pos, _idx, report = build_unified(_base("ripple-wave"), "draft")
    report.pop("_colors", None)
    assert report["path_continuity"] == "PASS"
    assert report["printable_mesh"] == "PASS"
    assert report["boolean_union"] is True
    assert report["boundary_edge_count"] == 0
    assert report["non_manifold_edge_count"] == 0
    assert report["connected_component_count"] == 1
    assert report["export_block_reason"] == ""


def test_random_parameters_do_not_leave_free_ends():
    master = load_master()
    factor = scale_of(master, 180)
    rng = np.random.default_rng(19)
    presets = ("radial-star", "ripple-wave", "cellular-growth", "rotating-diamond")
    for index in range(200):
        preset_id = presets[index % 4]
        params = _base(preset_id, seed=int(rng.integers(1, 80)))
        params["layers"][1]["density"] = float(rng.uniform(0.45, 1.35))
        params["layers"][1]["strip_width"] = float(rng.uniform(1.4, 2.4))
        if preset_id == "ripple-wave":
            params["layers"][1]["amplitude"] = float(rng.uniform(0.4, 8.0))
            params["layers"][1]["frequency"] = float(rng.uniform(0.4, 1.8))
        if preset_id == "radial-star":
            params["layers"][1]["spoke_count"] = int(rng.integers(8, 24))
            params["layers"][1]["ring_count"] = int(rng.integers(1, 5))
        if preset_id == "cellular-growth":
            params["layers"][1]["randomness"] = float(rng.uniform(0.0, 0.2))
        if preset_id == "rotating-diamond":
            params["layers"][1]["rotation_strength"] = float(rng.uniform(0.0, 0.8))
            params["layers"][1]["pattern_angle"] = float(rng.uniform(4, 28))
        meta = compose_layers(master, params, factor, "draft")[1]
        assert meta["visible_endpoint_count"] == 0
        assert meta["short_fragment_count"] == 0
        assert meta["unanchored_strip_count"] == 0
        assert meta["curve_count"] >= 4
