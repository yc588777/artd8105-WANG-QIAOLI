import { fhnRgb } from "./bioColor";

export type FhnParams = {
  threshold: number;
  recovery: number;
  diffusion: number;
  audioImpact: number;
};

export class FitzHughNagumo {
  n: number;
  u: Float32Array;
  v: Float32Array;
  nu: Float32Array;
  nv: Float32Array;
  pixels: ImageData;
  off: HTMLCanvasElement;

  constructor(n = 120) {
    this.n = n;
    const N = n * n;
    this.u = new Float32Array(N);
    this.v = new Float32Array(N);
    this.nu = new Float32Array(N);
    this.nv = new Float32Array(N);
    this.pixels = new ImageData(n, n);
    this.off = document.createElement("canvas");
    this.off.width = n;
    this.off.height = n;
    this.reset();
  }

  reset() {
    this.u.fill(0);
    this.v.fill(0);
    const gs = this.n;
    for (let s = 0; s < 4; s++) {
      const cx = 20 + Math.floor(Math.random() * (gs - 40));
      const cy = 20 + Math.floor(Math.random() * (gs - 40));
      for (let x = cx - 15; x < cx + 15; x++) {
        for (let y = cy - 15; y < cy + 15; y++) {
          const i = y * gs + x;
          if (x > cx) this.u[i] = 1;
          if (y > cy) this.v[i] = 0.5;
        }
      }
    }
  }

  private at(arr: Float32Array, x: number, y: number) {
    const gs = this.n;
    const xx = ((x % gs) + gs) % gs;
    const yy = ((y % gs) + gs) % gs;
    return arr[yy * gs + xx]!;
  }

  private lap(arr: Float32Array, x: number, y: number) {
    return (
      (this.at(arr, x - 1, y) + this.at(arr, x + 1, y) + this.at(arr, x, y - 1) + this.at(arr, x, y + 1)) * 0.2 +
      (this.at(arr, x - 1, y - 1) + this.at(arr, x + 1, y - 1) + this.at(arr, x - 1, y + 1) + this.at(arr, x + 1, y + 1)) * 0.05 -
      arr[y * this.n + x]!
    );
  }

  step(p: FhnParams, audioLevel: number, iters = 4) {
    const gs = this.n;
    const a = Math.max(0.005, p.threshold - audioLevel * 0.03 * p.audioImpact);
    const eps = p.recovery + audioLevel * 0.008 * p.audioImpact;
    const Du = p.diffusion;
    const dt = 0.2;
    const nIter = Math.max(1, Math.min(5, iters));
    for (let k = 0; k < nIter; k++) {
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          const i = y * gs + x;
          const cu = this.u[i]!;
          const cv = this.v[i]!;
          const dU = Du * this.lap(this.u, x, y) + cu * (1 - cu) * (cu - a) - 0.45 * cv;
          const dV = eps * (cu - cv);
          this.nu[i] = Math.max(-0.2, Math.min(1.2, cu + dU * dt));
          this.nv[i] = Math.max(-0.2, Math.min(1.2, cv + dV * dt));
        }
      }
      const tu = this.u;
      this.u = this.nu;
      this.nu = tu;
      const tv = this.v;
      this.v = this.nv;
      this.nv = tv;
    }
  }

  sprite(audioLevel: number) {
    const d = this.pixels.data;
    const impact = audioLevel;
    for (let i = 0; i < this.n * this.n; i++) {
      const noise = (Math.random() - 0.5) * impact * 40;
      const [r, g, b] = fhnRgb(this.u[i]!, this.v[i]!, noise);
      const o = i * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
    const octx = this.off.getContext("2d");
    if (!octx) return this.off;
    octx.putImageData(this.pixels, 0, 0);
    return this.off;
  }
}
