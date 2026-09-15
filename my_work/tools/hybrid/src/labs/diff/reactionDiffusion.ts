import { DRAW_FRAG, SIM_FRAG, SPLAT_FRAG, VERT } from "./shaders";
import { bioRgb } from "./bioColor";

export type RDView = "A" | "B" | "combo";

export type RDParams = { Du: number; Dv: number; F: number; K: number; dt: number };

export function stepGrayScottCPU(
  U: Float32Array,
  V: Float32Array,
  Un: Float32Array,
  Vn: Float32Array,
  n: number,
  p: RDParams,
) {
  const idx = (x: number, y: number) => ((y + n) % n) * n + ((x + n) % n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const u = U[i]!;
      const v = V[i]!;
      const lapU = U[idx(x + 1, y)]! + U[idx(x - 1, y)]! + U[idx(x, y + 1)]! + U[idx(x, y - 1)]! - 4 * u;
      const lapV = V[idx(x + 1, y)]! + V[idx(x - 1, y)]! + V[idx(x, y + 1)]! + V[idx(x, y - 1)]! - 4 * v;
      const uvv = u * v * v;
      Un[i] = Math.min(1, Math.max(0, u + p.dt * (p.Du * lapU - uvv + p.F * (1 - u))));
      Vn[i] = Math.min(1, Math.max(0, v + p.dt * (p.Dv * lapV + uvv - (p.F + p.K) * v)));
    }
  }
}

export function fieldIsFinite(a: Float32Array) {
  for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    if (!Number.isFinite(v)) return false;
  }
  return true;
}

export function seedSpot(U: Float32Array, V: Float32Array, n: number, rng = Math.random) {
  U.fill(1);
  V.fill(0);
  const c = n >> 1;
  for (let y = c - 6; y < c + 6; y++) {
    for (let x = c - 5; x < c + 7; x++) {
      const i = y * n + x;
      U[i] = 0.5 + rng() * 0.1;
      V[i] = 0.25 + rng() * 0.15;
    }
  }
}

export function splatCPU(
  U: Float32Array,
  V: Float32Array,
  n: number,
  cx: number,
  cy: number,
  r: number,
  erase: boolean,
) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
      const i = y * n + x;
      if (erase) {
        V[i] = 0;
        U[i] = 1;
      } else {
        V[i] = 0.9;
        U[i] = 0.3;
      }
    }
  }
}

export function sampleGradient(V: Float32Array, n: number, x: number, y: number) {
  const at = (xx: number, yy: number) => V[(((yy + n) % n) * n + ((xx + n) % n))]!;
  const gx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
  const gy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
  return { gx, gy, mag: Math.hypot(gx, gy) };
}

type GLRes = {
  gl: WebGL2RenderingContext;
  sim: WebGLProgram;
  draw: WebGLProgram;
  splat: WebGLProgram;
  tex: [WebGLTexture, WebGLTexture];
  fbo: [WebGLFramebuffer, WebGLFramebuffer];
  vao: WebGLVertexArrayObject;
  size: number;
  cur: 0 | 1;
};

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const v = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(v, vs);
  gl.compileShader(v);
  const f = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(f, fs);
  gl.compileShader(f);
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return p;
}

function makeTex(gl: WebGL2RenderingContext, n: number, data: Float32Array | null) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, n, n, 0, gl.RGBA, gl.FLOAT, data);
  return tex;
}

export class RDEngine {
  kind: "webgl" | "cpu" = "cpu";
  n: number;
  U: Float32Array;
  V: Float32Array;
  Un: Float32Array;
  Vn: Float32Array;
  history: number[] = [];
  private glres: GLRes | null = null;
  private pixels: ImageData;
  private off: HTMLCanvasElement | null = null;

  constructor(n = 128) {
    this.n = n;
    const N = n * n;
    this.U = new Float32Array(N);
    this.V = new Float32Array(N);
    this.Un = new Float32Array(N);
    this.Vn = new Float32Array(N);
    this.pixels = new ImageData(n, n);
    seedSpot(this.U, this.V, n);
  }

  tryWebGL(canvas: HTMLCanvasElement, size = 256) {
    try {
      const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true });
      if (!gl) return false;
      gl.getExtension("EXT_color_buffer_float");
      gl.getExtension("EXT_color_buffer_half_float");
      gl.getExtension("OES_texture_float_linear");
      const sim = compile(gl, VERT, SIM_FRAG);
      const draw = compile(gl, VERT, DRAW_FRAG);
      const splat = compile(gl, VERT, SPLAT_FRAG);
      const packed = new Float32Array(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        packed[i * 4] = 1;
        packed[i * 4 + 1] = 0;
        packed[i * 4 + 3] = 1;
      }
      const c = size >> 1;
      for (let y = c - 8; y < c + 8; y++) {
        for (let x = c - 8; x < c + 10; x++) {
          const i = (y * size + x) * 4;
          packed[i] = 0.5;
          packed[i + 1] = 0.28;
        }
      }
      const tex: [WebGLTexture, WebGLTexture] = [makeTex(gl, size, packed), makeTex(gl, size, packed)];
      const fbo: [WebGLFramebuffer, WebGLFramebuffer] = [gl.createFramebuffer()!, gl.createFramebuffer()!];
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]!);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex[i]!, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("fbo");
      }
      const vao = gl.createVertexArray()!;
      this.glres = { gl, sim, draw, splat, tex, fbo, vao, size, cur: 0 };
      this.kind = "webgl";
      this.n = size;
      return true;
    } catch {
      this.kind = "cpu";
      this.glres = null;
      return false;
    }
  }

  reset(rng = Math.random) {
    if (this.kind === "cpu") seedSpot(this.U, this.V, this.n, rng);
    else this.tryResetGL();
    this.history = [];
  }

  private tryResetGL() {
    const g = this.glres;
    if (!g) return;
    const { gl, size } = g;
    const packed = new Float32Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      packed[i * 4] = 1;
      packed[i * 4 + 3] = 1;
    }
    const c = size >> 1;
    for (let y = c - 8; y < c + 8; y++) {
      for (let x = c - 8; x < c + 10; x++) {
        const i = (y * size + x) * 4;
        packed[i] = 0.5;
        packed[i + 1] = 0.28;
      }
    }
    for (const t of g.tex) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.FLOAT, packed);
    }
  }

  seedFromDensity(grid: Float32Array, gw: number, gh: number) {
    if (this.kind === "cpu") {
      this.U.fill(1);
      this.V.fill(0);
      for (let y = 0; y < this.n; y++) {
        for (let x = 0; x < this.n; x++) {
          const gx = Math.floor((x / this.n) * gw);
          const gy = Math.floor((y / this.n) * gh);
          const d = grid[gy * gw + gx] ?? 0;
          const i = y * this.n + x;
          this.V[i] = d * 0.7;
          this.U[i] = 1 - d * 0.5;
        }
      }
      return;
    }
    const g = this.glres;
    if (!g) return;
    const packed = new Float32Array(g.size * g.size * 4);
    for (let y = 0; y < g.size; y++) {
      for (let x = 0; x < g.size; x++) {
        const gx = Math.floor((x / g.size) * gw);
        const gy = Math.floor((y / g.size) * gh);
        const d = grid[gy * gw + gx] ?? 0;
        const i = (y * g.size + x) * 4;
        packed[i] = 1 - d * 0.5;
        packed[i + 1] = d * 0.7;
        packed[i + 3] = 1;
      }
    }
    for (const t of g.tex) {
      g.gl.bindTexture(g.gl.TEXTURE_2D, t);
      g.gl.texImage2D(g.gl.TEXTURE_2D, 0, g.gl.RGBA16F, g.size, g.size, 0, g.gl.RGBA, g.gl.FLOAT, packed);
    }
  }

  step(p: RDParams, steps = 8) {
    if (this.kind === "cpu") {
      for (let s = 0; s < steps; s++) {
        stepGrayScottCPU(this.U, this.V, this.Un, this.Vn, this.n, p);
        const tu = this.U;
        this.U = this.Un;
        this.Un = tu;
        const tv = this.V;
        this.V = this.Vn;
        this.Vn = tv;
      }
      const mid = (this.n >> 1) * this.n + (this.n >> 1);
      this.history.push(this.V[mid]!);
      if (this.history.length > 240) this.history.shift();
      return;
    }
    const g = this.glres;
    if (!g) return;
    const { gl } = g;
    gl.useProgram(g.sim);
    gl.bindVertexArray(g.vao);
    gl.viewport(0, 0, g.size, g.size);
    gl.uniform2f(gl.getUniformLocation(g.sim, "uRes"), g.size, g.size);
    gl.uniform1f(gl.getUniformLocation(g.sim, "uDu"), p.Du);
    gl.uniform1f(gl.getUniformLocation(g.sim, "uDv"), p.Dv);
    gl.uniform1f(gl.getUniformLocation(g.sim, "uF"), p.F);
    gl.uniform1f(gl.getUniformLocation(g.sim, "uK"), p.K);
    gl.uniform1f(gl.getUniformLocation(g.sim, "uDt"), p.dt);
    for (let s = 0; s < steps; s++) {
      const src = g.cur;
      const dst = (src ^ 1) as 0 | 1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo[dst]!);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, g.tex[src]!);
      gl.uniform1i(gl.getUniformLocation(g.sim, "uPrev"), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      g.cur = dst;
    }
  }

  splat(nx: number, ny: number, radius: number, erase: boolean) {
    if (this.kind === "cpu") {
      splatCPU(this.U, this.V, this.n, nx, ny, radius, erase);
      return;
    }
    const g = this.glres;
    if (!g) return;
    const { gl } = g;
    const src = g.cur;
    const dst = (src ^ 1) as 0 | 1;
    gl.useProgram(g.splat);
    gl.bindVertexArray(g.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo[dst]!);
    gl.viewport(0, 0, g.size, g.size);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.tex[src]!);
    gl.uniform1i(gl.getUniformLocation(g.splat, "uPrev"), 0);
    gl.uniform2f(gl.getUniformLocation(g.splat, "uRes"), g.size, g.size);
    gl.uniform2f(gl.getUniformLocation(g.splat, "uPoint"), nx, g.size - ny);
    gl.uniform1f(gl.getUniformLocation(g.splat, "uRadius"), radius);
    gl.uniform1f(gl.getUniformLocation(g.splat, "uAmount"), 0.9);
    gl.uniform1f(gl.getUniformLocation(g.splat, "uErase"), erase ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    g.cur = dst;
  }

  fieldSprite(view: RDView): HTMLCanvasElement | null {
    if (this.kind !== "cpu") return null;
    const data = this.pixels.data;
    for (let i = 0; i < this.n * this.n; i++) {
      const mode = view === "A" ? 0 : view === "B" ? 1 : 2;
      const [r, g, b] = bioRgb(this.U[i]!, this.V[i]!, mode);
      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
    if (!this.off) {
      this.off = document.createElement("canvas");
      this.off.width = this.n;
      this.off.height = this.n;
    }
    if (this.off.width !== this.n || this.off.height !== this.n) {
      this.off.width = this.n;
      this.off.height = this.n;
    }
    const octx = this.off.getContext("2d");
    if (!octx) return null;
    octx.putImageData(this.pixels, 0, 0);
    return this.off;
  }

  glSprite(view: RDView): HTMLCanvasElement | null {
    const g = this.glres;
    if (!g) return this.fieldSprite(view);
    const { gl, size } = g;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, size, size);
    gl.useProgram(g.draw);
    gl.bindVertexArray(g.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.tex[g.cur]!);
    gl.uniform1i(gl.getUniformLocation(g.draw, "uPrev"), 0);
    gl.uniform2f(gl.getUniformLocation(g.draw, "uRes"), size, size);
    gl.uniform1i(gl.getUniformLocation(g.draw, "uMode"), view === "A" ? 0 : view === "B" ? 1 : 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const buf = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    if (!this.pixels || this.pixels.width !== size) this.pixels = new ImageData(size, size);
    const dst = this.pixels.data;
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * size * 4;
      dst.set(buf.subarray(src, src + size * 4), y * size * 4);
    }
    if (!this.off) this.off = document.createElement("canvas");
    if (this.off.width !== size || this.off.height !== size) {
      this.off.width = size;
      this.off.height = size;
    }
    const octx = this.off.getContext("2d");
    if (!octx) return null;
    octx.putImageData(this.pixels, 0, 0);
    return this.off;
  }

  render(target: HTMLCanvasElement, view: RDView) {
    const ctx = target.getContext("2d");
    if (this.kind === "webgl" && this.glres) {
      const g = this.glres;
      const { gl } = g;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, target.width, target.height);
      gl.useProgram(g.draw);
      gl.bindVertexArray(g.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, g.tex[g.cur]!);
      gl.uniform1i(gl.getUniformLocation(g.draw, "uPrev"), 0);
      gl.uniform2f(gl.getUniformLocation(g.draw, "uRes"), target.width, target.height);
      gl.uniform1i(gl.getUniformLocation(g.draw, "uMode"), view === "A" ? 0 : view === "B" ? 1 : 2);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    if (!ctx) return;
    const sprite = this.fieldSprite(view);
    if (!sprite) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#08090A";
    ctx.fillRect(0, 0, target.width, target.height);
    const s = Math.min(target.width, target.height);
    ctx.drawImage(sprite, (target.width - s) / 2, (target.height - s) / 2, s, s);
  }

  sampleCPU(x: number, y: number) {
    const i = y * this.n + x;
    return { u: this.U[i] ?? 0, v: this.V[i] ?? 0, ...sampleGradient(this.V, this.n, x, y) };
  }

  dispose() {
    const g = this.glres;
    if (!g) return;
    g.gl.deleteProgram(g.sim);
    g.gl.deleteProgram(g.draw);
    g.gl.deleteProgram(g.splat);
    g.tex.forEach((t) => g.gl.deleteTexture(t));
    g.fbo.forEach((f) => g.gl.deleteFramebuffer(f));
    this.glres = null;
  }
}
