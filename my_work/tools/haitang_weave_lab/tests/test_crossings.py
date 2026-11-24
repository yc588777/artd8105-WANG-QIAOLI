import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tools"))

from app.craft_drawing import craft_drawing  # noqa: E402
from app.crossings import crossing_view  # noqa: E402
from evaluate import make_params  # noqa: E402


def test_lattice_patterns_alternate_over_and_under():
    for preset in ("rotating-diamond-reference", "radial-star"):
        view = crossing_view(make_params(preset, {}))
        assert view["summary"]["crossing_count"] > 50
        assert view["summary"]["alternation_rate"] == 1.0
        assert view["summary"]["strands_with_long_float"] == 0


def test_four_patterns_put_the_over_strip_above_the_under_strip():
    """Plan and mesh share one crossing table. The upper centerline has to clear the lower one."""
    import numpy as np

    from app.geometry.layers import compose_layers
    from app.geometry.master_lock import REF_HEIGHT_MM, load_master, scale_of

    master = load_master()
    for preset in ("rotating-diamond-reference", "radial-star", "ripple-wave", "cellular-growth"):
        params = make_params(preset, {})
        factor = scale_of(master, float(np.clip(params.get("target_height", REF_HEIGHT_MM), 120.0, 220.0)))
        packed, meta = compose_layers(master, params, factor, "draft")
        table = meta["crossing_table"]
        assert len(table) > 40, preset
        view = crossing_view(params)
        assert view["summary"]["alternation_rate"] == 1.0, preset
        gaps = []
        for item in table:
            over, under = int(item["over"]), int(item["under"])
            point = np.array([item["x"], item["y"]], np.float32)
            over_line = np.asarray(packed[over][0])[:, :2]
            under_line = np.asarray(packed[under][0])[:, :2]
            oi = int(np.argmin(np.linalg.norm(over_line - point, axis=1)))
            ui = int(np.argmin(np.linalg.norm(under_line - point, axis=1)))
            gaps.append(float(packed[over][4][oi] - packed[under][4][ui]))
        assert min(gaps) > 0.6, (preset, min(gaps))


def test_every_crossing_has_one_strip_over_one_under():
    view = crossing_view(make_params("cellular-growth", {}))
    for c in view["crossings"]:
        assert c["over"] != c["under"]
        over = [s for s in view["strands"][c["over"]]["crossings"] if s["n"] == c["n"]]
        under = [s for s in view["strands"][c["under"]]["crossings"] if s["n"] == c["n"]]
        assert [s["mark"] for s in over] == ["O"] and [s["mark"] for s in under] == ["U"]


def _grid():
    import numpy as np

    strands = []
    for index, y in enumerate((10.5, 20.5, 30.5)):
        line = np.column_stack([np.linspace(0, 40, 41), np.full(41, y)]).astype(np.float32)
        strands.append({"line": line, "layer_id": "H", "index": index, "s": np.linspace(0, 1, 41)})
    for index, x in enumerate((10.5, 20.5, 30.5)):
        line = np.column_stack([np.full(41, x), np.linspace(0, 40, 41)]).astype(np.float32)
        strands.append({"line": line, "layer_id": "V", "index": index, "s": np.linspace(0, 1, 41)})
    return strands


def test_alternation_on_a_plain_grid_and_locks_win():
    import numpy as np

    from app.geometry.layers import _alternate, _collect_crossings

    strands = _grid()
    crossings = _collect_crossings(strands)
    assert len(crossings) == 9

    def sequences(overs):
        out = []
        for strand in range(6):
            stops = []
            for c, cross in enumerate(crossings):
                if strand in (cross["a"], cross["b"]):
                    key = float(cross["point"][0] if strand < 3 else cross["point"][1])
                    stops.append((key, "O" if overs[c] == strand else "U"))
            out.append("".join(mark for _k, mark in sorted(stops)))
        return out

    free = sequences(_alternate(strands, crossings, []))
    assert all(seq in ("OUO", "UOU") for seq in free)
    target = next(c for c, cross in enumerate(crossings) if np.allclose(cross["point"], (20.5, 20.5)))
    natural = _alternate(strands, crossings, [])[target]
    wanted = "V" if strands[natural]["layer_id"] == "H" else "H"
    locked = _alternate(strands, crossings, [{"x": 20.5, "y": 20.5, "over": wanted}])
    assert strands[locked[target]]["layer_id"] == wanted
    assert all(seq in ("OUO", "UOU") for seq in sequences(locked))


def test_a_dense_diamond_still_produces_a_craft_drawing():
    import io

    from PIL import Image

    png = craft_drawing(make_params("rotating-diamond-reference", {}), "測試", "test", "D0", "dense")
    image = Image.open(io.BytesIO(png))
    assert image.format == "PNG" and image.size == (3508, 2480)
    assert len(png) > 100_000


def test_craft_drawing_follows_the_interface_language():
    params = make_params("radial-star", {})
    sheets = [craft_drawing(params, "測試", "test", "D0", "L", lang) for lang in ("zh-Hant", "zh-Hans", "en")]
    assert len({item for item in sheets}) == 3
    assert all(item[:8] == b"\x89PNG\r\n\x1a\n" for item in sheets)


def test_craft_drawing_is_an_a2_png_at_150_dpi():
    import io

    from PIL import Image

    png = craft_drawing(make_params("radial-star", {}), "測試", "test", "D0", "s-x / snap-001")
    image = Image.open(io.BytesIO(png))
    assert image.format == "PNG" and image.size == (3508, 2480)
    assert round(image.info["dpi"][0]) == 150


def test_strips_of_one_layer_that_cross_are_woven_not_fused():
    view = crossing_view(make_params("rotating-diamond-reference", {}))
    same_layer = [c for c in view["crossings"] if view["strands"][c["over"]]["layer"] == view["strands"][c["under"]]["layer"]]
    assert len(same_layer) > 200


def _check_labels(placed, anchors, rect, radius):
    import numpy as np
    from app.craft_drawing import _segments_cross

    assert sorted(item["index"] for item in placed) == list(range(len(anchors)))
    x0, y0, x1, y1 = rect
    for i, a in enumerate(placed):
        cx, cy = a["centre"]
        assert not (x0 - radius < cx < x1 + radius and y0 - radius < cy < y1 + radius)
        assert np.allclose(a["anchor"], anchors[a["index"]])
        for b in placed[i + 1:]:
            assert np.linalg.norm(a["centre"] - b["centre"]) >= 2 * radius
            assert not _segments_cross(a["anchor"], a["elbow"], b["anchor"], b["elbow"])
            assert not _segments_cross(a["elbow"], a["centre"], b["elbow"], b["centre"])


def test_every_strip_is_numbered_clearly_even_in_a_solid_mat():
    import numpy as np
    from app.craft_drawing import label_layout

    pitch = 0.12
    ends = []
    for i, y in enumerate(np.arange(80, 800, 1.4 / pitch)):
        half = 400 * np.sqrt(max(1 - ((y - 440) / 380) ** 2, 0.0))
        ends.append((i, (475 - half, y), (475 + half, y)))
    layout = label_layout(ends, (0, 0, 950, 880), (475, 440), pitch, (1000, 262, 2545, 1900))
    assert layout is not None
    assert {item["strand"] for item in layout["labels"]} == {e[0] for e in ends}
    ox, oy = layout["origin"]
    vw, vh = layout["size"]
    k = layout["k"]
    anchors = [None] * len(layout["labels"])
    for item in layout["labels"]:
        sid, a, b = ends[item["strand"]]
        p = a if item["which"] == "start" else b
        anchors[item["index"]] = (ox + p[0] * k, oy + p[1] * k)
    _check_labels(layout["labels"], anchors, (ox, oy, ox + vw, oy + vh), layout["radius"])


def test_strip_labels_refuse_rather_than_overlap():
    import numpy as np
    from app.craft_drawing import place_labels

    rect = (100, 100, 400, 400)
    anchors = [(250 + 100 * np.cos(a), 250 + 100 * np.sin(a)) for a in np.linspace(0, 6.2, 80)]
    assert place_labels(anchors, rect, (250, 250), 15, 55) is None
