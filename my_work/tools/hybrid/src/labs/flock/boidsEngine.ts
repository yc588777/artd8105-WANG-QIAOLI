import { SpatialHash } from "./spatialHash";
import { SeededRandom } from "../../utils/seededRandom";

export type Boid = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sx: number;
  sy: number;
  ax: number;
  ay: number;
  cx: number;
  cy: number;
};

export type Obstacle = { x: number; y: number; r: number };

export type FlockParams = {
  sep: number;
  ali: number;
  coh: number;
  vis: number;
  protect: number;
  maxSpeed: number;
  maxForce: number;
  count: number;
  enableSep: boolean;
  enableAli: boolean;
  enableCoh: boolean;
};

export type MouseTool = "attract" | "repel" | "obstacle" | "none";

export type FlockMetrics = {
  avgNeighbors: number;
  polarity: number;
  collisions: number;
  centerSpeed: number;
  tracked: number;
};

export const FLOCK_WORLD_W = 4800;
export const FLOCK_WORLD_H = 3200;

const HASH_THRESHOLD = 80;

export class FlockWorld {
  boids: Boid[] = [];
  obstacles: Obstacle[] = [];
  predator: { x: number; y: number; vx: number; vy: number } | null = null;
  trails: { x: number; y: number }[] = [];
  hash = new SpatialHash(56);
  rng: SeededRandom;
  w = 800;
  h = 600;
  collisions = 0;
  metrics: FlockMetrics = { avgNeighbors: 0, polarity: 0, collisions: 0, centerSpeed: 0, tracked: 0 };

  constructor(seed: number) {
    this.rng = new SeededRandom(seed);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  seed(count: number) {
    this.boids = [];
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(40, 90);
      this.boids.push({
        x: this.rng.range(0, this.w),
        y: this.rng.range(0, this.h),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        sx: 0,
        sy: 0,
        ax: 0,
        ay: 0,
        cx: 0,
        cy: 0,
      });
    }
    this.collisions = 0;
    this.trails = [];
  }

  addObstacle(x: number, y: number, r = 64) {
    this.obstacles.push({ x, y, r });
  }

  setPredator(on: boolean) {
    if (!on) {
      this.predator = null;
      return;
    }
    this.predator = { x: this.w * 0.2, y: this.h * 0.2, vx: 70, vy: 40 };
  }

  private limit(x: number, y: number, max: number) {
    const m = Math.hypot(x, y);
    if (m > max && m > 0) return { x: (x / m) * max, y: (y / m) * max };
    return { x, y };
  }

  step(
    dt: number,
    p: FlockParams,
    mouse: { x: number; y: number; down: boolean; tool: MouseTool } | null,
  ) {
    if (this.boids.length !== p.count) this.seed(p.count);
    const list = this.boids;
    const useHash = list.length > HASH_THRESHOLD;
    if (useHash) {
      this.hash.cell = Math.max(24, p.vis);
      this.hash.clear();
      for (let i = 0; i < list.length; i++) this.hash.insert(i, list[i]!.x, list[i]!.y);
    }

    if (this.predator) {
      this.predator.x += this.predator.vx * dt;
      this.predator.y += this.predator.vy * dt;
      this.predator.x = ((this.predator.x % this.w) + this.w) % this.w;
      this.predator.y = ((this.predator.y % this.h) + this.h) % this.h;
    }

    let neighSum = 0;
    let vx = 0;
    let vy = 0;
    let cx = 0;
    let cy = 0;
    let collisions = 0;

    for (let i = 0; i < list.length; i++) {
      const b = list[i]!;
      let sepX = 0,
        sepY = 0,
        aliX = 0,
        aliY = 0,
        cohX = 0,
        cohY = 0,
        seen = 0,
        crowded = 0;

      const consider = (j: number) => {
        if (j === i) return;
        const o = list[j]!;
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > p.vis * p.vis || d2 === 0) return;
        const d = Math.sqrt(d2);
        seen++;
        aliX += o.vx;
        aliY += o.vy;
        cohX += o.x;
        cohY += o.y;
        if (d < p.protect) {
          crowded++;
          sepX -= dx / d;
          sepY -= dy / d;
          if (d < 8) collisions++;
        }
      };

      if (useHash) this.hash.query(b.x, b.y, p.vis, consider);
      else for (let j = 0; j < list.length; j++) consider(j);

      let fx = 0,
        fy = 0;
      if (p.enableSep && crowded) {
        const s = this.limit(sepX / crowded, sepY / crowded, p.maxForce);
        fx += s.x * p.sep;
        fy += s.y * p.sep;
        b.sx = s.x;
        b.sy = s.y;
      } else {
        b.sx = 0;
        b.sy = 0;
      }
      if (p.enableAli && seen) {
        const a = this.limit(aliX / seen - b.vx, aliY / seen - b.vy, p.maxForce);
        fx += a.x * p.ali;
        fy += a.y * p.ali;
        b.ax = a.x;
        b.ay = a.y;
      } else {
        b.ax = 0;
        b.ay = 0;
      }
      if (p.enableCoh && seen) {
        const c = this.limit(cohX / seen - b.x, cohY / seen - b.y, p.maxForce);
        fx += c.x * p.coh;
        fy += c.y * p.coh;
        b.cx = c.x;
        b.cy = c.y;
      } else {
        b.cx = 0;
        b.cy = 0;
      }

      if (mouse?.down && mouse.tool !== "obstacle" && mouse.tool !== "none") {
        const dx = mouse.x - b.x;
        const dy = mouse.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const mag = 420 / d;
        const sign = mouse.tool === "attract" ? 1 : -1;
        fx += (dx / d) * mag * sign;
        fy += (dy / d) * mag * sign;
      }

      for (const ob of this.obstacles) {
        const dx = b.x - ob.x;
        const dy = b.y - ob.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < ob.r + 18) {
          fx += (dx / d) * 500;
          fy += (dy / d) * 500;
        }
      }

      if (this.predator) {
        const dx = b.x - this.predator.x;
        const dy = b.y - this.predator.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 140) {
          fx += (dx / d) * 700;
          fy += (dy / d) * 700;
        }
        if (d < 16) collisions++;
      }

      b.vx += fx * dt;
      b.vy += fy * dt;
      const lim = this.limit(b.vx, b.vy, p.maxSpeed);
      b.vx = lim.x;
      b.vy = lim.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x = ((b.x % this.w) + this.w) % this.w;
      b.y = ((b.y % this.h) + this.h) % this.h;
      neighSum += seen;
      vx += b.vx;
      vy += b.vy;
      cx += b.x;
      cy += b.y;
    }

    this.collisions += collisions;
    const n = list.length || 1;
    const meanV = Math.hypot(vx / n, vy / n);
    const meanSp =
      list.reduce((s, b) => s + Math.hypot(b.vx, b.vy), 0) / n || 1;
    this.metrics = {
      avgNeighbors: neighSum / n,
      polarity: Math.min(1, meanV / meanSp),
      collisions: this.collisions,
      centerSpeed: meanV,
      tracked: 0,
    };

    if (this.trails.length > 14000) this.trails.splice(0, this.trails.length - 10000);
    if (list.length) {
      for (let i = 0; i < list.length; i += Math.max(1, Math.floor(list.length / 40))) {
        const b = list[i]!;
        this.trails.push({ x: b.x, y: b.y });
      }
    }
  }

  trailDensity(cols: number, rows: number) {
    const g = new Float32Array(cols * rows);
    for (const t of this.trails) {
      const x = Math.floor((t.x / this.w) * cols);
      const y = Math.floor((t.y / this.h) * rows);
      if (x >= 0 && y >= 0 && x < cols && y < rows) g[y * cols + x] += 1;
    }
    let m = 0;
    for (let i = 0; i < g.length; i++) m = Math.max(m, g[i]!);
    if (m > 0) for (let i = 0; i < g.length; i++) g[i]! /= m;
    return g;
  }
}

export function finiteBoids(world: FlockWorld) {
  return world.boids.every((b) => Number.isFinite(b.x) && Number.isFinite(b.vx));
}
