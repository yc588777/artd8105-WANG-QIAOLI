import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tools"))

from evaluate import GRAMMARS, make_params  # noqa: E402
from app.geometry.unified import build_unified  # noqa: E402


def test_anchored_presets_are_one_solid_and_trim_baseline_is_blocked():
    for grammar in GRAMMARS:
        params = make_params(grammar, {})
        _pos, _idx, anchored = build_unified(dict(params, anchor_mode="anchor"), "recommended")
        assert anchored["connected_component_count"] == 1, grammar
        assert anchored["path_continuity"] == "PASS", grammar
        assert not anchored["export_blocked"], grammar

        _pos, _idx, trimmed = build_unified(dict(params, anchor_mode="trim"), "recommended")
        assert trimmed["path_continuity"] == "FAIL", grammar
        assert trimmed["export_blocked"], grammar
