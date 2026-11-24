"""Technical evaluation for the paper (E1 baseline, E2 robustness, timing).

Each sample is one preset with randomised main-layer parameters. It is built
twice from the same parameters: once with boundary anchoring (the system as
shipped) and once with plain Boolean trimming against the opening.

    .venv\\Scripts\\python.exe tools\\evaluate.py --per-grammar 50 --seed 2026
"""
from __future__ import annotations

import argparse
import copy
import csv
import json
import random
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.crossings import crossing_view  # noqa: E402
from app.geometry.layers import preset_by_id  # noqa: E402
from app.geometry.unified import build_unified  # noqa: E402
from app.main import WeaveIn, _params  # noqa: E402

GRAMMARS = {
    "rotating-diamond-reference": "旋转菱纹",
    "radial-star": "放射星纹",
    "ripple-wave": "漣漪流動",
    "cellular-growth": "細胞生長",
}

COUNTERS = (
    "curve_count",
    "crossing_count",
    "interior_endpoint_count",
    "visible_endpoint_count",
    "short_fragment_count",
    "insufficient_embed_count",
    "unanchored_strip_count",
    "path_discontinuity_count",
    "boundary_edge_count",
    "non_manifold_edge_count",
)


def sample_layer(preset_id: str, rng: random.Random) -> dict:
    """Ranges match the interface sliders for the main layer."""
    tweak = {
        "density": round(rng.uniform(0.6, 1.8), 3),
        "strip_width": round(rng.uniform(1.2, 3.0), 3),
        "crossing_lift": round(rng.uniform(0.4, 2.6), 3),
        "seed": rng.randint(1, 9999),
    }
    if preset_id == "rotating-diamond-reference":
        tweak.update(
            direction_a=round(rng.uniform(-25, 25), 2),
            direction_b=round(rng.uniform(-25, 25), 2),
            arc_a=round(rng.uniform(-30, 30), 2),
            arc_b=round(rng.uniform(-30, 30), 2),
        )
    elif preset_id == "radial-star":
        tweak.update(spoke_count=rng.randint(16, 40), ring_count=rng.randint(6, 18))
    elif preset_id == "ripple-wave":
        tweak.update(amplitude=round(rng.uniform(1.0, 7.0), 2), frequency=round(rng.uniform(0.8, 2.4), 2))
    elif preset_id == "cellular-growth":
        tweak.update(randomness=round(rng.uniform(0.0, 2.0), 2), cell_aspect=round(rng.uniform(0.7, 1.4), 2))
    return tweak


def make_params(preset_id: str, tweak: dict) -> dict:
    preset = preset_by_id(preset_id)
    layers = copy.deepcopy(preset["layers"])
    for layer in layers:
        if layer["id"] == "L2":
            layer.update(tweak)
    params = _params(WeaveIn(pattern=preset["pattern"], seed=int(preset["seed"]), preset=preset_id))
    params["layers"] = layers
    return params


def run_once(params: dict, mode: str, quality: str) -> dict:
    params = dict(params, anchor_mode=mode)
    start = time.perf_counter()
    _pos, idx, report = build_unified(params, quality)
    elapsed = time.perf_counter() - start
    row = {key: int(report.get(key, 0) or 0) for key in COUNTERS}
    row.update(
        mode=mode,
        seconds=round(elapsed, 3),
        triangles=int(len(idx)),
        components=int(report.get("connected_component_count", 0) or 0),
        one_piece=bool(report.get("one_piece")),
        path_continuity=str(report.get("path_continuity", "")),
        exportable=not bool(report.get("export_blocked")),
        block_reason=str(report.get("export_block_reason", "")),
    )
    row["free_ends"] = row["interior_endpoint_count"] + row["visible_endpoint_count"]
    view = crossing_view(params)["summary"]
    row["crossings"] = int(view["crossing_count"])
    row["alternation_rate"] = "" if view["alternation_rate"] is None else float(view["alternation_rate"])
    row["long_float_strands"] = int(view["strands_with_long_float"])
    return row


def _mean_present(rows: list[dict], key: str) -> float | None:
    values = [float(r[key]) for r in rows if r.get(key) not in ("", None)]
    return round(float(np.mean(values)), 3) if values else None


def _typed(raw: dict) -> dict:
    row: dict = dict(raw)
    for key in (*COUNTERS, "free_ends", "components", "triangles", "sample", "crossings", "long_float_strands"):
        row[key] = int(raw.get(key) or 0)
    row["seconds"] = float(raw["seconds"] or 0)
    row["one_piece"] = raw["one_piece"] == "True"
    row["exportable"] = raw["exportable"] == "True"
    return row


def summarise(rows: list[dict]) -> dict:
    out: dict = {}
    for grammar in GRAMMARS:
        for mode in ("anchor", "trim"):
            sel = [r for r in rows if r["grammar"] == grammar and r["mode"] == mode]
            if not sel:
                continue

            def mean(key: str) -> float:
                return round(float(np.mean([r[key] for r in sel])), 2)

            out.setdefault(grammar, {})[mode] = {
                "n": len(sel),
                "exportable_rate": round(sum(r["exportable"] for r in sel) / len(sel), 3),
                "one_piece_rate": round(sum(r["one_piece"] and r["components"] == 1 for r in sel) / len(sel), 3),
                "free_ends_mean": mean("free_ends"),
                "short_fragment_mean": mean("short_fragment_count"),
                "insufficient_embed_mean": mean("insufficient_embed_count"),
                "components_mean": mean("components"),
                "curve_mean": mean("curve_count"),
                "crossings_mean": mean("crossings"),
                "alternation_mean": _mean_present(sel, "alternation_rate"),
                "long_float_strands_mean": mean("long_float_strands"),
                "seconds_mean": mean("seconds"),
                "seconds_max": round(float(max(r["seconds"] for r in sel)), 2),
            }
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-grammar", type=int, default=50)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--out", default=str(ROOT / "eval"))
    parser.add_argument("--quality", default="recommended", choices=("draft", "recommended"))
    parser.add_argument("--resume", action="store_true", help="keep rows already in the CSV and run only the rest")
    args = parser.parse_args()
    from app.sessions import system_version

    version = system_version()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)
    rows: list[dict] = []
    csv_path = out / "e1_e2_runs.csv"
    fields = ["grammar", "sample", "mode", *COUNTERS, "free_ends", "components", "one_piece", "path_continuity",
              "exportable", "block_reason", "crossings", "alternation_rate", "long_float_strands", "triangles", "seconds", "params"]
    done: set[tuple[str, int, str]] = set()
    if args.resume and csv_path.exists():
        with csv_path.open(encoding="utf-8-sig", newline="") as handle:
            for raw in csv.DictReader(handle):
                rows.append(_typed(raw))
                done.add((raw["grammar"], int(raw["sample"]), raw["mode"]))
    with csv_path.open("a" if done else "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        if not done:
            writer.writeheader()
        for grammar in GRAMMARS:
            for sample in range(args.per_grammar):
                tweak = sample_layer(grammar, rng)
                params = make_params(grammar, tweak)
                for mode in ("anchor", "trim"):
                    if (grammar, sample, mode) in done:
                        continue
                    try:
                        row = run_once(params, mode, args.quality)
                    except Exception as exc:  # a crash is a result too
                        row = {key: 0 for key in COUNTERS}
                        row.update(mode=mode, seconds=0, triangles=0, components=0, one_piece=False,
                                   path_continuity="ERROR", exportable=False, block_reason=repr(exc), free_ends=0,
                                   crossings=0, alternation_rate="", long_float_strands=0)
                    row.update(grammar=grammar, sample=sample, params=json.dumps(tweak, ensure_ascii=False))
                    rows.append(row)
                    writer.writerow({k: row.get(k) for k in fields})
                    handle.flush()
                    print(f"{grammar:28s} #{sample:02d} {mode:6s} free={row['free_ends']:3d} "
                          f"short={row['short_fragment_count']:3d} comp={row['components']:2d} "
                          f"export={row['exportable']!s:5s} {row['seconds']:.1f}s", flush=True)
    summary = {
        "system_version": version,
        "seed": args.seed,
        "per_grammar": args.per_grammar,
        "quality": args.quality,
        "baseline": "Boolean trim against the opening; no embedding, no short-run drop, no single-run rule, no post-cleaning",
        "results": summarise(rows),
    }
    (out / "e1_e2_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary["results"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
