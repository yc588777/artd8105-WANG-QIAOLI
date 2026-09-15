export type PodRadii =
  | { kind: "pct"; h: [number, number, number, number]; v: [number, number, number, number] }
  | { kind: "px"; r: number };

export type Pt = { x: number; y: number };

/** CSS Backgrounds 3: if adjacent radii overflow a side, scale every corner by the same factor. */
export function cssCornerRadii(w: number, h: number, spec: PodRadii) {
  let rx: number[];
  let ry: number[];
  if (spec.kind === "px") {
    const r = Math.max(0, spec.r);
    rx = [r, r, r, r];
    ry = [r, r, r, r];
  } else {
    rx = spec.h.map((p) => Math.max(0, p * w));
    ry = spec.v.map((p) => Math.max(0, p * h));
  }
  const f = Math.min(
    1,
    w / Math.max(1e-6, rx[0]! + rx[1]!),
    w / Math.max(1e-6, rx[3]! + rx[2]!),
    h / Math.max(1e-6, ry[0]! + ry[3]!),
    h / Math.max(1e-6, ry[1]! + ry[2]!),
  );
  return {
    rx: rx.map((v) => v * f),
    ry: ry.map((v) => v * f),
  };
}

export function fillCornerRadii(
  w: number,
  h: number,
  spec: PodRadii,
  borderBox: { w: number; h: number } = { w, h },
) {
  const outer = cssCornerRadii(borderBox.w, borderBox.h, spec);
  const bx = Math.max(0, (borderBox.w - w) / 2);
  const by = Math.max(0, (borderBox.h - h) / 2);
  return {
    rx: outer.rx.map((v) => Math.max(0, v - bx)),
    ry: outer.ry.map((v) => Math.max(0, v - by)),
  };
}

export function rimRadii(
  w: number,
  h: number,
  spec: PodRadii,
  inset: number,
  borderBox?: { w: number; h: number },
) {
  const fill = fillCornerRadii(w, h, spec, borderBox);
  const d = Math.max(0, inset);
  return {
    x: d,
    y: d,
    w: Math.max(8, w - d * 2),
    h: Math.max(8, h - d * 2),
    rx: fill.rx.map((v) => Math.max(0, v - d)),
    ry: fill.ry.map((v) => Math.max(0, v - d)),
  };
}

function A(rx: number, ry: number, x: number, y: number, sweep: 0 | 1) {
  if (rx < 0.6 && ry < 0.6) return `L${x.toFixed(2)} ${y.toFixed(2)}`;
  return `A${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 ${sweep} ${x.toFixed(2)} ${y.toFixed(2)}`;
}

function quarterLen(a: number, b: number) {
  const rx = Math.max(0, a);
  const ry = Math.max(0, b);
  if (rx < 0.6 && ry < 0.6) return 0;
  const s = rx + ry;
  const h = ((rx - ry) * (rx - ry)) / (s * s || 1);
  return (Math.PI * s * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))) / 4;
}

function push(pts: Pt[], p: Pt) {
  const last = pts[pts.length - 1];
  if (last && Math.hypot(last.x - p.x, last.y - p.y) < 0.04) return;
  pts.push(p);
}

function sampleQuarter(cx: number, cy: number, a: number, b: number, t0: number, t1: number, n = 18) {
  const pts: Pt[] = [];
  if (a < 0.6 && b < 0.6) return pts;
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * (i / n);
    pts.push({ x: cx + a * Math.cos(t), y: cy + b * Math.sin(t) });
  }
  return pts;
}

export function topInnerPoints(
  w: number,
  h: number,
  spec: PodRadii,
  inset: number,
  borderBox?: { w: number; h: number },
) {
  const { x, y, w: iw, rx, ry } = rimRadii(w, h, spec, inset, borderBox);
  const tlx = rx[0]!;
  const tly = ry[0]!;
  const trx = rx[1]!;
  const try_ = ry[1]!;
  const pts: Pt[] = [];
  if (tlx < 0.6 && tly < 0.6) push(pts, { x, y });
  else for (const p of sampleQuarter(x + tlx, y + tly, tlx, tly, Math.PI, Math.PI * 1.5)) push(pts, p);
  push(pts, { x: x + iw - trx, y });
  if (trx < 0.6 && try_ < 0.6) push(pts, { x: x + iw, y });
  else for (const p of sampleQuarter(x + iw - trx, y + try_, trx, try_, -Math.PI / 2, 0)) push(pts, p);
  void h;
  return pts;
}

export function bottomInnerPoints(
  w: number,
  h: number,
  spec: PodRadii,
  inset: number,
  borderBox?: { w: number; h: number },
) {
  const { x, y, w: iw, h: ih, rx, ry } = rimRadii(w, h, spec, inset, borderBox);
  const blx = rx[3]!;
  const bly = ry[3]!;
  const brx = rx[2]!;
  const bry = ry[2]!;
  const bottom = y + ih;
  const pts: Pt[] = [];
  if (blx < 0.6 && bly < 0.6) push(pts, { x, y: bottom });
  else for (const p of sampleQuarter(x + blx, bottom - bly, blx, bly, Math.PI, Math.PI / 2)) push(pts, p);
  push(pts, { x: x + iw - brx, y: bottom });
  if (brx < 0.6 && bry < 0.6) push(pts, { x: x + iw, y: bottom });
  else for (const p of sampleQuarter(x + iw - brx, bottom - bry, brx, bry, Math.PI / 2, 0)) push(pts, p);
  return pts;
}

function slopeAt(pts: Pt[], i: number) {
  const a = pts[Math.max(0, i - 1)]!;
  const b = pts[Math.min(pts.length - 1, i + 1)]!;
  const dx = b.x - a.x;
  if (Math.abs(dx) < 1e-6) return Number.POSITIVE_INFINITY;
  return Math.abs((b.y - a.y) / dx);
}

/** Keep the inner CSS arc, but drop the near-vertical waist so glyphs stay readable. */
export function trimGentle(pts: Pt[], mode: "top" | "bottom", maxSlope = 0.7) {
  if (pts.length < 3) return pts;
  let seed = 0;
  for (let i = 1; i < pts.length; i++) {
    if (mode === "top" ? pts[i]!.y < pts[seed]!.y : pts[i]!.y > pts[seed]!.y) seed = i;
  }
  let lo = seed;
  let hi = seed;
  while (lo > 0 && slopeAt(pts, lo - 1) <= maxSlope) lo -= 1;
  while (hi < pts.length - 1 && slopeAt(pts, hi + 1) <= maxSlope) hi += 1;
  const full = pts[pts.length - 1]!.x - pts[0]!.x;
  const minSpan = Math.max(24, full * 0.4);
  while (lo > 0 && pts[hi]!.x - pts[lo]!.x < minSpan) lo -= 1;
  while (hi < pts.length - 1 && pts[hi]!.x - pts[lo]!.x < minSpan) hi += 1;
  return pts.slice(lo, hi + 1);
}

export function pointsToPath(pts: Pt[]) {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("");
}

export function polylineLength(pts: Pt[]) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return n;
}

/** Top inner rim, left → right. Clockwise short arcs (sweep 1) match CSS. */
export function topInnerPath(
  w: number,
  h: number,
  spec: PodRadii,
  inset: number,
  borderBox?: { w: number; h: number },
) {
  const { x, y, w: iw, rx, ry } = rimRadii(w, h, spec, inset, borderBox);
  const right = x + iw;
  const tlx = rx[0]!;
  const trx = rx[1]!;
  const tly = ry[0]!;
  const try_ = ry[1]!;
  return [
    `M${x.toFixed(2)} ${(y + tly).toFixed(2)}`,
    A(tlx, tly, x + tlx, y, 1),
    `L${(right - trx).toFixed(2)} ${y.toFixed(2)}`,
    A(trx, try_, right, y + try_, 1),
  ].join("");
}

/** Bottom inner rim, left → right. Short arcs use sweep 0 so type stays upright. */
export function bottomInnerPath(
  w: number,
  h: number,
  spec: PodRadii,
  inset: number,
  borderBox?: { w: number; h: number },
) {
  const { x, y, w: iw, h: ih, rx, ry } = rimRadii(w, h, spec, inset, borderBox);
  const right = x + iw;
  const bottom = y + ih;
  const brx = rx[2]!;
  const blx = rx[3]!;
  const bry = ry[2]!;
  const bly = ry[3]!;
  return [
    `M${x.toFixed(2)} ${(bottom - bly).toFixed(2)}`,
    A(blx, bly, x + blx, bottom, 0),
    `L${(right - brx).toFixed(2)} ${bottom.toFixed(2)}`,
    A(brx, bry, right, bottom - bry, 0),
  ].join("");
}

export function topInnerLength(
  w: number,
  h: number,
  spec: PodRadii,
  inset: number,
  borderBox?: { w: number; h: number },
) {
  const { w: iw, rx, ry } = rimRadii(w, h, spec, inset, borderBox);
  const straight = Math.max(0, iw - rx[0]! - rx[1]!);
  return quarterLen(rx[0]!, ry[0]!) + straight + quarterLen(rx[1]!, ry[1]!);
}

export function bottomInnerLength(
  w: number,
  h: number,
  spec: PodRadii,
  inset: number,
  borderBox?: { w: number; h: number },
) {
  const { w: iw, rx, ry } = rimRadii(w, h, spec, inset, borderBox);
  const straight = Math.max(0, iw - rx[3]! - rx[2]!);
  return quarterLen(rx[3]!, ry[3]!) + straight + quarterLen(rx[2]!, ry[2]!);
}
