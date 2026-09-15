export type TurtleSeg = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  gen: number;
  symbol: string;
  parent: number;
};

export type TurtleResult = {
  segs: TurtleSeg[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type TurtleEnv = {
  angle: number;
  step: number;
  wind: number;
  light: number;
  obstacles: { x: number; y: number; r: number }[];
  jitter: number;
  rnd: () => number;
  drawChars?: string;
};

function blocked(x: number, y: number, obs: TurtleEnv["obstacles"]) {
  for (const o of obs) {
    if (Math.hypot(x - o.x, y - o.y) < o.r) return true;
  }
  return false;
}

export function turtleWalk(path: string, env: TurtleEnv): TurtleResult {
  let x = 0,
    y = 0,
    a = -Math.PI / 2;
  const rad = (env.angle * Math.PI) / 180;
  const stack: { x: number; y: number; a: number; gen: number; parent: number }[] = [];
  const segs: TurtleSeg[] = [];
  let minX = 0,
    minY = 0,
    maxX = 0,
    maxY = 0;
  let gen = 0;
  let parent = -1;
  const draw = env.drawChars ?? "FG";
  const stamp = () => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const ch of path) {
    if (draw.includes(ch)) {
      const bias = env.light * 0.35 * Math.cos(a);
      const ang = a + env.wind * 0.018 + (env.rnd() - 0.5) * env.jitter + bias * 0.01;
      const nx = x + Math.cos(ang) * env.step;
      const ny = y + Math.sin(ang) * env.step;
      if (!blocked(nx, ny, env.obstacles)) {
        segs.push({ x1: x, y1: y, x2: nx, y2: ny, gen, symbol: ch, parent });
        parent = segs.length - 1;
        x = nx;
        y = ny;
        stamp();
      }
    } else if (ch === "f") {
      x += Math.cos(a) * env.step;
      y += Math.sin(a) * env.step;
      stamp();
    } else if (ch === "+") a += rad;
    else if (ch === "-") a -= rad;
    else if (ch === "[") stack.push({ x, y, a, gen, parent });
    else if (ch === "]") {
      const p = stack.pop();
      if (p) {
        x = p.x;
        y = p.y;
        a = p.a;
        gen = p.gen;
        parent = p.parent;
      }
    } else if (ch === "X" || ch === "Y") gen++;
  }
  return { segs, minX, minY, maxX, maxY };
}

export function fitTurtle(geo: TurtleResult, w: number, h: number, pad = 28) {
  const bw = geo.maxX - geo.minX || 1;
  const bh = geo.maxY - geo.minY || 1;
  const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  const ox = (w - bw * scale) / 2 - geo.minX * scale;
  const oy = (h - bh * scale) / 2 - geo.minY * scale;
  return { scale, ox, oy };
}

export function hitSegmentWorld(geo: TurtleResult, px: number, py: number, thresh = 10) {
  let best = -1;
  let bestD = thresh;
  for (let i = 0; i < geo.segs.length; i++) {
    const s = geo.segs[i]!;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - s.x1) * dx + (py - s.y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function segsToSvg(geo: TurtleResult, stroke = "#111315") {
  const pad = 8;
  const w = geo.maxX - geo.minX + pad * 2 || 100;
  const h = geo.maxY - geo.minY + pad * 2 || 100;
  const lines = geo.segs
    .map(
      (s) =>
        `<line x1="${s.x1 - geo.minX + pad}" y1="${s.y1 - geo.minY + pad}" x2="${s.x2 - geo.minX + pad}" y2="${s.y2 - geo.minY + pad}" />`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" stroke="${stroke}" stroke-width="1">${lines}</svg>`;
}

export function clipSegsToMask(
  geo: TurtleResult,
  mask: Uint8Array,
  cols: number,
  rows: number,
  worldW: number,
  worldH: number,
) {
  const fit = fitTurtle(geo, worldW, worldH, 8);
  const kept: TurtleSeg[] = [];
  for (const s of geo.segs) {
    const mx = Math.floor((((s.x2 * fit.scale + fit.ox) / worldW) * cols));
    const my = Math.floor((((s.y2 * fit.scale + fit.oy) / worldH) * rows));
    if (mx >= 0 && my >= 0 && mx < cols && my < rows && mask[my * cols + mx]) kept.push(s);
  }
  return { ...geo, segs: kept };
}
