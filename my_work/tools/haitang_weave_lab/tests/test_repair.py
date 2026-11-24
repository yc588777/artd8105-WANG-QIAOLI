import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.repair import explain, primary_index, suggest_fix  # noqa: E402


def _params(density=1.4, locked=False):
    return {
        "pattern": "radial",
        "layers": [
            {"id": "L1", "algorithm": "plain", "density": 0.5},
            {"id": "L2", "algorithm": "radial-star", "density": density, "strip_width": 1.6, "crossing_lift": 1.0, "seed": 7, "locked": locked},
        ],
    }


def test_explain_names_each_problem_once():
    report = {"interior_endpoint_count": 3, "visible_endpoint_count": 2, "insufficient_embed_count": 1, "connected_component_count": 3,
              "printable_mesh": "FAIL", "curve_count": 10, "pattern": "radial"}
    codes = {item["code"]: item["count"] for item in explain(report)}
    assert codes == {"free_end": 5, "shallow": 1, "loose": 2}


def test_primary_layer_skips_plain_ground():
    assert primary_index(_params()) == 1


def test_fix_returns_first_passing_change_and_verifies():
    calls = {"verify": 0}

    def build(p):
        return {"export_blocked": p["layers"][1]["density"] > 1.3 and p["layers"][1]["seed"] == 7}

    def verify(p):
        calls["verify"] += 1
        return {"export_blocked": p["layers"][1]["density"] > 1.3}

    result = suggest_fix(_params(), build, verify=verify)
    assert result["found"]
    assert result["changes"] == [{"key": "density", "from": 1.4, "to": 1.19}]
    assert calls["verify"] >= 2


def test_fix_respects_locked_layer():
    result = suggest_fix(_params(locked=True), lambda p: {"export_blocked": True})
    assert result["found"] is False and result["tried"] == 0


def test_no_fix_needed_when_passing():
    assert suggest_fix(_params(), lambda p: {"export_blocked": False})["needed"] is False
