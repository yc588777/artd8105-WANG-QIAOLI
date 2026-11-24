import { useEffect, useMemo, useState } from "react";
import type { WeaveParams } from "./api";
import { logEvent } from "./sessionLog";

type Stop = { n: number; s: number; mark: "O" | "U" };
type Strand = {
  id: number;
  color: string;
  width_px: number;
  width_mm: number;
  points: [number, number][];
  profile: [number, number][];
  length_mm: number;
  crossings: Stop[];
  sequence: string;
  longest_float: number;
};
type Crossing = { n: number; x: number; y: number; over: number; under: number };
type View = {
  width: number;
  height: number;
  pitch_mm: number;
  strands: Strand[];
  crossings: Crossing[];
  summary: { crossing_count: number; alternation_rate: number | null; strands_with_long_float: number; long_float_threshold: number };
};

function spanAt(points: [number, number][], x: number, y: number, reach: number) {
  if (points.length < 2) return points;
  const seg = points.slice(0, -1).map((p, i) => Math.hypot(points[i + 1][0] - p[0], points[i + 1][1] - p[1]));
  const arc = [0];
  seg.forEach((d) => arc.push(arc[arc.length - 1] + d));
  let index = 0;
  let best = Infinity;
  points.forEach((p, i) => {
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < best) {
      best = d;
      index = i;
    }
  });
  const at = (distance: number): [number, number] => {
    const d = Math.max(0, Math.min(distance, arc[arc.length - 1]));
    let i = 0;
    while (i < seg.length - 1 && arc[i + 1] < d) i += 1;
    const length = seg[i] || 1;
    const t = Math.max(0, Math.min((d - arc[i]) / length, 1));
    return [points[i][0] * (1 - t) + points[i + 1][0] * t, points[i][1] * (1 - t) + points[i + 1][1] * t];
  };
  const start = arc[index] - reach;
  const stop = arc[index] + reach;
  const sample = [at(start)];
  points.forEach((point, i) => {
    if (start + 0.4 < arc[i] && arc[i] < stop - 0.4) sample.push(point);
  });
  sample.push(at(stop));
  return sample;
}

function axisBar(points: [number, number][]) {
  if (points.length < 2) return false;
  const a = points[0];
  const b = points[points.length - 1];
  const dx = Math.abs(b[0] - a[0]);
  const dy = Math.abs(b[1] - a[1]);
  if (dx + dy < 1) return false;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (!(deg < 14 || deg > 76)) return false;
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / span;
  const ny = (b[0] - a[0]) / span;
  let bow = 0;
  for (const p of points) {
    bow = Math.max(bow, Math.abs((p[0] - a[0]) * nx + (p[1] - a[1]) * ny));
  }
  return bow < Math.max(4, span * 0.05);
}

function ribbonSides(points: [number, number][], half: number): [[number, number][], [number, number][]] | null {
  const kept: [number, number][] = [];
  for (const p of points) {
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 0.35) kept.push(p);
  }
  if (kept.length < 2) return null;
  const normal: [number, number][] = [];
  for (let i = 0; i < kept.length - 1; i++) {
    const dx = kept[i + 1][0] - kept[i][0];
    const dy = kept[i + 1][1] - kept[i][1];
    const d = Math.hypot(dx, dy) || 1;
    normal.push([-dy / d, dx / d]);
  }
  const side = (sign: number) => {
    const out: [number, number][] = [[kept[0][0] + normal[0][0] * half * sign, kept[0][1] + normal[0][1] * half * sign]];
    for (let i = 1; i < kept.length - 1; i++) {
      const mx = normal[i - 1][0] + normal[i][0];
      const my = normal[i - 1][1] + normal[i][1];
      const span = Math.hypot(mx, my);
      const dot = mx * normal[i - 1][0] + my * normal[i - 1][1];
      if (span < 1e-6 || dot < 0.55 * span) {
        out.push([kept[i][0] + normal[i - 1][0] * half * sign, kept[i][1] + normal[i - 1][1] * half * sign]);
        out.push([kept[i][0] + normal[i][0] * half * sign, kept[i][1] + normal[i][1] * half * sign]);
      } else {
        out.push([kept[i][0] + (mx * half * sign) / dot, kept[i][1] + (my * half * sign) / dot]);
      }
    }
    const last = normal.length - 1;
    out.push([kept[kept.length - 1][0] + normal[last][0] * half * sign, kept[kept.length - 1][1] + normal[last][1] * half * sign]);
    return out;
  };
  return [side(1), side(-1)];
}

function asPoints(sides: [[number, number][], [number, number][]]) {
  return [...sides[0], ...sides[1].slice().reverse()].map((p) => p.join(",")).join(" ");
}

function clipSlab(points: [number, number][], origin: [number, number], normal: [number, number], half: number) {
  if (!points.length) return [] as [number, number][];
  const signed = (p: [number, number]) => (p[0] - origin[0]) * normal[0] + (p[1] - origin[1]) * normal[1];
  const out: [number, number][] = [];
  let prev = points[0];
  let prevS = signed(prev);
  if (Math.abs(prevS) <= half) out.push(prev);
  for (const cur of points.slice(1)) {
    const curS = signed(cur);
    const hits: [number, [number, number]][] = [];
    for (const edge of [half, -half]) {
      const den = curS - prevS;
      if (Math.abs(den) < 1e-9) continue;
      if ((prevS - edge) * (curS - edge) < 0) {
        const t = (edge - prevS) / den;
        hits.push([t, [prev[0] * (1 - t) + cur[0] * t, prev[1] * (1 - t) + cur[1] * t]]);
      }
    }
    hits.sort((a, b) => a[0] - b[0]);
    for (const hit of hits) out.push(hit[1]);
    if (Math.abs(curS) <= half + 1e-6) out.push(cur);
    prev = cur;
    prevS = curS;
  }
  return out;
}

function coverPolygon(
  overPts: [number, number][],
  origin: [number, number],
  normal: [number, number],
  overHalf: number,
  underHalf: number,
): string | null {
  const sides = ribbonSides(overPts, overHalf);
  if (!sides) return null;
  const left = clipSlab(sides[0], origin, normal, underHalf);
  const right = clipSlab(sides[1], origin, normal, underHalf);
  if (left.length < 2 || right.length < 2) return null;
  return [...left, ...right.slice().reverse()].map((p) => p.join(",")).join(" ");
}

function tangentAt(points: [number, number][], x: number, y: number): [number, number] {
  if (points.length < 2) return [1, 0];
  let index = 0;
  let best = Infinity;
  points.forEach((p, i) => {
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < best) {
      best = d;
      index = i;
    }
  });
  const a = points[Math.max(index - 1, 0)];
  const b = points[Math.min(index + 1, points.length - 1)];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
}

export function CrossingView({ params, t }: { params: WeaveParams; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/weave/crossings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, quality: "draft" }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })
        .then((data: View) => {
          setView(data);
          setError("");
          setSelected((prev) => (prev != null && prev < data.strands.length ? prev : null));
        })
        .catch((err) => setError(String(err)));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [params]);

  const ribbons = useMemo(() => {
    if (!view) return [];
    return view.strands.map((s) => ({ s, ground: axisBar(s.points) }));
  }, [view]);

  const tops = useMemo(() => {
    if (!view) return [];
    const pitch = Math.max(view.pitch_mm, 0.01);
    return view.crossings.flatMap((c) => {
      const over = view.strands[c.over];
      const under = view.strands[c.under];
      if (!over || !under || axisBar(over.points) || axisBar(under.points)) return [];
      const half = Math.max(over.width_px, 1.2) / 2;
      const underHalf = Math.max(under.width_px, 1.2) / 2;
      const ot = tangentAt(over.points, c.x, c.y);
      const ut = tangentAt(under.points, c.x, c.y);
      const here = over.crossings.find((stop) => stop.n === c.n);
      let room = Infinity;
      if (here) {
        for (const stop of over.crossings) {
          if (stop.n !== c.n) room = Math.min(room, Math.abs(stop.s - here.s) / pitch);
        }
      }
      const sinSafe = Math.max(Math.abs(ot[0] * ut[1] - ot[1] * ut[0]), 0.25);
      const need = underHalf / sinSafe + half;
      const along = room > need ? need : Math.max(room * 0.48, underHalf / sinSafe);
      if (along < 1.4) return [];
      const samples = spanAt(over.points, c.x, c.y, along);
      const poly = coverPolygon(samples, [c.x, c.y], [-ut[1], ut[0]], half, underHalf + 0.6);
      const sides = ribbonSides(samples, half);
      if (!poly || !sides) return [];
      return [{ c, over, poly, edges: sides.map((side) => side.map((p) => p.join(",")).join(" ")) }];
    });
  }, [view]);

  const frame = useMemo(() => {
    if (!view) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of view.strands) {
      for (const [x, y] of s.points) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
    const pad = 18;
    return { x: x0 - pad, y: y0 - pad, w: Math.max(x1 - x0, 1) + pad * 2, h: Math.max(y1 - y0, 1) + pad * 2 };
  }, [view]);

  if (error) return <p className="warn">{error}</p>;
  if (!view) return <p className="session-muted">{t("generating")}</p>;

  const strand = selected != null ? view.strands[selected] : null;
  const rate = view.summary.alternation_rate;
  const summary = view.summary.crossing_count === 0
    ? t("cross.none")
    : t("cross.summary", {
        n: view.summary.crossing_count,
        rate: rate == null ? "—" : `${Math.round(rate * 100)}%`,
        floats: view.summary.strands_with_long_float,
        k: view.summary.long_float_threshold,
      });

  function pick(id: number) {
    setSelected(id);
    logEvent("crossing_inspect", { strand: id, sequence: view?.strands[id]?.sequence ?? "" });
  }

  return (
    <div className="xview">
      <p className="xview-summary">{summary}</p>
      <svg viewBox={frame ? `${frame.x} ${frame.y} ${frame.w} ${frame.h}` : `0 0 ${view.width} ${view.height}`} className="xview-plan">
        {frame && <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="#f5f0e8" />}
        {ribbons.filter((item) => item.ground).map(({ s }) => {
          const dim = strand && strand.id !== s.id;
          return (
            <polyline
              key={s.id}
              points={s.points.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={Math.max(s.width_px * 0.85, 1)}
              strokeLinejoin="round"
              strokeLinecap="butt"
              opacity={dim ? 0.16 : 0.38}
            />
          );
        })}
        {ribbons.filter((item) => !item.ground).map(({ s }) => {
          const dim = strand && strand.id !== s.id;
          const sides = ribbonSides(s.points, Math.max(s.width_px, 1.2) / 2);
          if (!sides) return null;
          return (
            <g key={s.id} opacity={dim ? 0.28 : 1}>
              <polygon points={asPoints(sides)} fill={s.color} />
              <polyline points={sides[0].map((p) => p.join(",")).join(" ")} fill="none" stroke="#37281e" strokeWidth={0.7} strokeLinejoin="round" />
              <polyline points={sides[1].map((p) => p.join(",")).join(" ")} fill="none" stroke="#37281e" strokeWidth={0.7} strokeLinejoin="round" />
            </g>
          );
        })}
        {tops.map(({ c, over, poly, edges }) => {
          const dim = strand && strand.id !== over.id && strand.id !== c.under;
          return (
            <g key={c.n} opacity={dim ? 0.28 : 1}>
              <polygon points={poly} fill={over.color} />
              {edges.map((points) => (
                <polyline key={points} points={points} fill="none" stroke="#37281e" strokeWidth={0.7} strokeLinejoin="round" />
              ))}
            </g>
          );
        })}
        {view.strands.map((s) => (
          <polyline
            key={`hit-${s.id}`}
            points={s.points.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(s.width_px, 3) + 10}
            style={{ cursor: "pointer" }}
            onClick={() => pick(s.id)}
          />
        ))}
        {strand &&
          strand.crossings.map((stop) => {
            const c = view.crossings[stop.n - 1];
            return (
              <g key={stop.n} pointerEvents="none">
                <circle cx={c.x} cy={c.y} r={13} fill={stop.mark === "O" ? "#2c6b66" : "#8d3b32"} />
                <text x={c.x} y={c.y + 5} textAnchor="middle" fontSize={14} fill="white">{stop.n}</text>
              </g>
            );
          })}
      </svg>
      {strand ? (
        <div className="xview-strand">
          <strong>{t("cross.strand", { id: strand.id + 1, len: strand.length_mm })}</strong>
          <p className="xview-seq">
            {strand.crossings.length
              ? strand.crossings.map((stop) => (
                  <span key={stop.n} className={stop.mark === "O" ? "over" : "under"}>
                    #{stop.n} {stop.mark === "O" ? t("cross.over") : t("cross.under")}
                  </span>
                ))
              : t("cross.noStops")}
          </p>
          {strand.longest_float >= view.summary.long_float_threshold && <p className="warn">{t("cross.float", { k: strand.longest_float })}</p>}
          <Profile strand={strand} t={t} />
        </div>
      ) : (
        <p className="session-muted">{t("cross.hint")}</p>
      )}
    </div>
  );
}

function Profile({ strand, t }: { strand: Strand; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const W = 520;
  const H = 120;
  const pad = 22;
  const zs = strand.profile.map((p) => p[1]);
  const lo = Math.min(...zs) - 0.2;
  const hi = Math.max(...zs) + 0.2;
  const len = Math.max(strand.length_mm, 1);
  const x = (s: number) => pad + (s / len) * (W - pad * 2);
  const y = (z: number) => H - pad - ((z - lo) / Math.max(hi - lo, 0.01)) * (H - pad * 2);
  const zAt = (s: number) => {
    let best = strand.profile[0];
    for (const p of strand.profile) if (Math.abs(p[0] - s) < Math.abs(best[0] - s)) best = p;
    return best[1];
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="xview-profile">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#e3d9cb" />
      <polyline points={strand.profile.map(([s, z]) => `${x(s)},${y(z)}`).join(" ")} fill="none" stroke={strand.color} strokeWidth={3} />
      {strand.crossings.map((stop) => (
        <g key={stop.n}>
          <circle cx={x(stop.s)} cy={y(zAt(stop.s))} r={4} fill={stop.mark === "O" ? "#2c6b66" : "#8d3b32"} />
          <text x={x(stop.s)} y={stop.mark === "O" ? y(zAt(stop.s)) - 8 : y(zAt(stop.s)) + 16} textAnchor="middle" fontSize={10} fill="#6f675c">{stop.n}</text>
        </g>
      ))}
      <text x={pad} y={H - 4} fontSize={10} fill="#6f675c">0</text>
      <text x={W - pad} y={H - 4} fontSize={10} fill="#6f675c" textAnchor="end">{t("cross.axis", { len: strand.length_mm })}</text>
    </svg>
  );
}
