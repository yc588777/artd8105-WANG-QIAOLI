import hashlib
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.geometry.engine import build_cache, build_mesh, default_params  # noqa: E402
from app.geometry.handle_text import remove_confirmed_text  # noqa: E402
from app.geometry.stl_io import file_sha256, read_stl, write_stl  # noqa: E402


def _boundary_edges(indices: np.ndarray) -> int:
    e = np.vstack(
        [
            np.sort(indices[:, [0, 1]], axis=1),
            np.sort(indices[:, [1, 2]], axis=1),
            np.sort(indices[:, [2, 0]], axis=1),
        ]
    )
    order = np.lexsort((e[:, 1], e[:, 0]))
    e = e[order]
    change = np.ones(len(e), dtype=bool)
    change[1:] = np.any(e[1:] != e[:-1], axis=1)
    counts = np.diff(np.append(np.flatnonzero(change), len(e)))
    return int(np.sum(counts == 1)), int(np.sum(counts > 2))


def _digest(positions, indices) -> str:
    h = hashlib.sha256()
    h.update(np.ascontiguousarray(positions, dtype=np.float32).tobytes())
    h.update(np.ascontiguousarray(indices, dtype=np.int32).tobytes())
    return h.hexdigest()


def test_source_files_unchanged_and_cache():
    fan = ROOT / "assets" / "original" / "obj_2_fan.stl"
    handle = ROOT / "assets" / "original" / "obj_1_handle_logo.stl"
    assert file_sha256(fan) == "118757e184460093e3cf3b45ed9d9fb1206b9b39ceef395a0878ccf165af1009"
    assert file_sha256(handle) == "58c0d7d82007baa27f46f2ec64a063c201f45a0faa462b59aa035e4917678897"
    cache = build_cache()
    assert cache["solid"].sum() > 1000
    assert len(cache["small"]) == 208


def test_weave_changes_mesh_and_keeps_envelope():
    params = default_params()
    a, ia, ra = build_mesh(params, "draft")
    b, ib, _ = build_mesh(params, "draft")
    assert _digest(a, ia) == _digest(b, ib)
    params2 = default_params()
    params2["density_u"] = 1.4
    params2["density_v"] = 1.4
    params2["zones"]["NW"]["density_u"] = 2.2
    c, ic, rc = build_mesh(params2, "draft")
    assert _digest(a, ia) != _digest(c, ic)
    assert ra["z_envelope_ok"]
    assert rc["z_envelope_ok"]
    assert a[:, 2].max() <= 2.001
    assert ra["xy_envelope_ok"]
    boundary, nonmanifold = _boundary_edges(ia)
    assert boundary == 0
    assert nonmanifold == 0
    # Left-top density change must alter geometry inside that quadrant more than the opposite one.
    bbmin = np.array(ra["source_bbox_min"])
    bbmax = np.array(ra["source_bbox_max"])
    mid = (bbmin + bbmax) / 2

    def quadrant_mean(pos, ix, ysign, xsign):
        tris = pos[ix]
        cents = tris.mean(axis=1)
        sel = (cents[:, 0] - mid[0]) * xsign > 8
        sel &= (cents[:, 1] - mid[1]) * ysign > 8
        return float(cents[sel, 2].mean())

    # Different strand spacing changes the thickness histogram, not necessarily the mean.
    def hist(pos):
        z = pos[:, 2]
        z = z[(z > 0.05) & (z < 1.95)]
        return np.histogram(z, bins=8, range=(0.05, 1.95))[0]

    assert not np.array_equal(hist(a), hist(c))


def test_handle_text_removal_keeps_outside_vertices(tmp_path: Path):
    source = ROOT / "assets" / "original" / "obj_1_handle_logo.stl"
    dest = tmp_path / "handle_clean.stl"
    report = remove_confirmed_text(source, dest)
    assert report["vertices_lifted"] > 100
    assert report["passed_outside_unchanged"]
    before = read_stl(source)
    after = read_stl(dest)
    assert before.shape[0] >= after.shape[0]
    # Source file itself is untouched.
    assert file_sha256(source) == "58c0d7d82007baa27f46f2ec64a063c201f45a0faa462b59aa035e4917678897"
    write_stl(tmp_path / "roundtrip.stl", after)
