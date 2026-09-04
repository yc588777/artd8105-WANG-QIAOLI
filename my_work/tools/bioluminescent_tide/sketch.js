/**
 * 荧光潮汐：蓝眼泪
 * 自由藻海 + 纹样唤醒 + 身影唤醒
 *
 * 主循环：updateSim() 计算物理与激活 → drawScene() 绘制背景、粒子与噪点。
 * 三种模式共用背景 / 噪点 / 导出，粒子数组互相独立。
 */

if (typeof t !== "function") {
  window.t = function (key) {
    return key;
  };
}

const BASE_W = 1920;
const BASE_H = 1080;

const FREE_DEFAULTS = {
  count: 1800,
  size: 2.1,
  sizeRandom: 0.55,
  cluster: 0.42,
  flicker: 0.01,
  depthMix: 0.62,
  mouseRadius: 56,
  disturbance: 0.38,
  vortex: 0.24,
  speedSense: 0.72,
  ripple: 0.48,
  trailDensity: 0.74,
  glow: 0.86,
  halo: 2.35,
  coreSize: 0.46,
  decay: 0.018,
  duration: 0.66,
  color1: "#043B73",
  color2: "#00A8FF",
  coreColor: "#D8F7FF"
};

const PATTERN_DEFAULTS = {
  recognition: "contourFill",
  threshold: 0.46,
  invert: false,
  edgeSense: 0.32,
  alphaCut: 0.12,
  sampleGap: 6,
  density: 0.72,
  contourDensity: 0.86,
  fillDensity: 0.34,
  size: 2,
  sizeRandom: 0.5,
  maxCount: 2400,
  scale: 0.78,
  posX: 0.5,
  posY: 0.48,
  rotation: 0,
  keepAspect: true,
  flipH: false,
  flipV: false,
  drift: 0.34,
  spring: 0.075,
  nudge: 0.42,
  spread: 110,
  wakeDelay: 0.08,
  duration: 0.7,
  memoryDecay: 0.2,
  colorMode: "unified",
  color1: "#00A8FF",
  color2: "#27D8FF",
  coreColor: "#D8F7FF",
  glow: 0.9,
  revealMode: "local",
  showPreview: false
};

const BODY_DEFAULTS = {
  count: 1600,
  size: 2.05,
  sizeRandom: 0.52,
  mouseRadius: 64,
  disturbance: 0.32,
  vortex: 0.18,
  speedSense: 0.7,
  trailDensity: 0.7,
  glow: 0.92,
  halo: 2.45,
  coreSize: 0.48,
  decay: 0.012,
  duration: 0.78,
  color1: "#043B73",
  color2: "#00A8FF",
  coreColor: "#D8F7FF",
  gather: 0.52,
  stillSense: 0.42,
  contourBias: 0.62,
  settle: 0.58
};

const SHARED_DEFAULTS = {
  bgFit: "cover",
  bgBrightness: 0.55,
  bgAlpha: 0.7,
  bgBlur: 1.5,
  bgMask: 0.72,
  bgScale: 1,
  bgX: 0.5,
  bgY: 0.5,
  flowSpeed: 0.12,
  flowScale: 0.0022,
  flowStrength: 0.075,
  damping: 0.942,
  bgDark: 0.84,
  water: 0.2,
  grain: 0.14,
  zoom: 1,
  cellAspect: 0.32,
  coreAmount: 0.78,
  restingVisible: 0.88,
  showWater: false,
  showNoise: true,
  showRipples: false,
  showFps: false
};

const PRESETS = {
  still: {
    count: 900,
    size: 1.7,
    sizeRandom: 0.4,
    cluster: 0.28,
    flicker: 0.006,
    depthMix: 0.45,
    mouseRadius: 62,
    disturbance: 0.22,
    vortex: 0.12,
    speedSense: 0.5,
    ripple: 0.28,
    trailDensity: 0.4,
    glow: 0.62,
    halo: 2.0,
    coreSize: 0.38,
    decay: 0.028,
    duration: 0.42,
    color1: "#043B73",
    color2: "#007BFF",
    coreColor: "#D8F7FF"
  },
  tide: { ...FREE_DEFAULTS },
  storm: {
    count: 2400,
    size: 2.25,
    sizeRandom: 0.6,
    cluster: 0.52,
    flicker: 0.014,
    depthMix: 0.72,
    mouseRadius: 142,
    disturbance: 0.72,
    vortex: 0.5,
    speedSense: 1.12,
    ripple: 0.92,
    trailDensity: 0.82,
    glow: 1.05,
    halo: 2.85,
    coreSize: 0.5,
    decay: 0.016,
    duration: 0.74,
    color1: "#043B73",
    color2: "#27D8FF",
    coreColor: "#F2FCFF"
  },
  dream: {
    count: 1400,
    size: 2.45,
    sizeRandom: 0.58,
    cluster: 0.36,
    flicker: 0.012,
    depthMix: 0.58,
    mouseRadius: 104,
    disturbance: 0.26,
    vortex: 0.2,
    speedSense: 0.6,
    ripple: 0.36,
    trailDensity: 0.5,
    glow: 0.92,
    halo: 3.4,
    coreSize: 0.52,
    decay: 0.008,
    duration: 1.08,
    color1: "#043B73",
    color2: "#00A8FF",
    coreColor: "#D8F7FF"
  }
};

const appState = {
  mode: "free",
  backgroundImage: null,
  patternImage: null,
  freeSettings: clone(FREE_DEFAULTS),
  patternSettings: clone(PATTERN_DEFAULTS),
  bodySettings: clone(BODY_DEFAULTS),
  sharedSettings: clone(SHARED_DEFAULTS)
};

let freeParticles = [];
let patternParticles = [];
let bodyParticles = [];
let rippleEffects = [];
let trailPoints = [];
let sparkles = [];
let waterWakes = [];
let lastWaterPt = null;
let waterBow = null;
let viewZoom = 1;
let camX = BASE_W / 2;
let camY = BASE_H / 2;
let stillness = 1;
let stillnessHold = 0;
let microBudget = 0;

let canvasElt = null;
let panelHover = false;
let paused = false;
const MAX_CAPTURES = 4;
let captures = [];
let selectedCapture = -1;
let reviewOpen = false;
let pausedBeforeReview = false;
let spaceCaptureLock = 0;
let bgDirty = true;
let bgLayer = null;
let bgBlurTmp = null;
let grainLayers = [];
let patternSampleGfx = null;
let grid;
const queryBuf = [];

let mouseSpeed = 0;
let lastTrail = null;
let previewBurst = 0;
let memoryFade = 0;
let rebuildFreeTimer = 0;
let rebuildPatternTimer = 0;
let rebuildBodyTimer = 0;
let handPointerActive = false;
let handStatusKey = "body.statusOff";
let bodyMaskW = 160;
let bodyMaskH = 90;
let bodyVideoW = 640;
let bodyVideoH = 480;
let bodyPerson = null;
let bodyFound = false;
let bodyHold = 0;
let bodyMotion = 0;
let bodyGatherAmt = 0;
let bodyNearX = null;
let bodyNearY = null;
let bodyEdgeX = null;
let bodyEdgeY = null;
let bodyInside = null;
let bodyEdge = null;
let bodySrc = null;
let bodyEdgeSrc = null;
let bodyContourTargets = [];
let bodyFillTargets = [];
let bodySoft = null;
let pointerInside = false;
let pointerX = 0;
let pointerY = 0;
let pointerPX = 0;
let pointerPY = 0;
let useDomPointer = false;
let pointerPressed = false;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function hexRgb(hex) {
  const n = String(hex || "#000000").replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function deviceMaxParticles() {
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return mobile ? 900 : 3000;
}

function bodyParticleCap() {
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const hard = mobile ? 2400 : 5600;
  const base = Math.min(appState.bodySettings.count, deviceMaxParticles());
  return Math.min(hard, Math.max(base + 2200, Math.floor(base * 2.8)));
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

/* ---------- 空间网格：只检查鼠标附近的粒子 ---------- */
class SpatialGrid {
  constructor() {
    this.cell = 80;
    this.cols = 1;
    this.rows = 1;
    this.bins = [[]];
  }

  configure(w, h, cell) {
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil(w / cell));
    this.rows = Math.max(1, Math.ceil(h / cell));
    const n = this.cols * this.rows;
    if (this.bins.length !== n) {
      this.bins = new Array(n);
      for (let i = 0; i < n; i++) this.bins[i] = [];
    } else {
      this.clear();
    }
  }

  clear() {
    for (let i = 0; i < this.bins.length; i++) this.bins[i].length = 0;
  }

  insert(p) {
    const c = constrain(Math.floor(p.position.x / this.cell), 0, this.cols - 1);
    const r = constrain(Math.floor(p.position.y / this.cell), 0, this.rows - 1);
    this.bins[r * this.cols + c].push(p);
  }

  query(x, y, radius, out) {
    out.length = 0;
    const c0 = constrain(Math.floor((x - radius) / this.cell), 0, this.cols - 1);
    const c1 = constrain(Math.floor((x + radius) / this.cell), 0, this.cols - 1);
    const r0 = constrain(Math.floor((y - radius) / this.cell), 0, this.rows - 1);
    const r1 = constrain(Math.floor((y + radius) / this.cell), 0, this.rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const bin = this.bins[r * this.cols + c];
        for (let i = 0; i < bin.length; i++) out.push(bin[i]);
      }
    }
    return out;
  }
}

function pickDepth(mix) {
  const r = Math.random();
  const deepShare = lerp(0.38, 0.14, mix);
  const surfShare = lerp(0.1, 0.28, mix);
  if (r < deepShare) return random(0.04, 0.28);
  if (r > 1 - surfShare) return random(0.74, 1);
  return random(0.28, 0.74);
}

/* ---------- 自由藻海粒子 ---------- */
class Particle {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = createVector(0, 0);
    this.acceleration = createVector(0, 0);
    this.basePosition = createVector(x, y);
    const fs = appState.freeSettings;
    this.depth = pickDepth(fs.depthMix);
    this.size = lerp(1 - fs.sizeRandom, 1 + fs.sizeRandom, Math.random()) * lerp(0.55, 1.22, this.depth);
    this.brightness = 0;
    this.activation = 0;
    this.decay = fs.decay;
    this.phase = random(TWO_PI);
    this.noiseOffset = random(100);
    this.colorVariation = random(-0.08, 0.08);
    this.maxSpeed = lerp(0.22, 1.02, this.depth);
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  activate(amount) {
    const fs = appState.freeSettings;
    const deposit = amount * (0.16 + fs.duration * 0.24);
    this.activation = constrain(this.activation + deposit * (1 + this.activation * 1.25), 0, 1);
  }

  reset() {
    this.position.set(this.basePosition);
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
    this.activation = 0;
    this.brightness = 0;
  }

  update() {
    const sh = appState.sharedSettings;
    const fs = appState.freeSettings;
    const t = frameCount * sh.flowSpeed * 0.02;
    const ang = noise(
      this.position.x * sh.flowScale,
      this.position.y * sh.flowScale,
      t + this.noiseOffset
    ) * TWO_PI * 2;
    const depthK = lerp(0.35, 1, this.depth);
    this.acceleration.x += Math.cos(ang) * sh.flowStrength * depthK;
    this.acceleration.y += Math.sin(ang) * sh.flowStrength * depthK;
    this.acceleration.x += (Math.random() - 0.5) * 0.016 * depthK;
    this.acceleration.y += (Math.random() - 0.5) * 0.016 * depthK;
    this.acceleration.x += (this.basePosition.x - this.position.x) * 0.0021;
    this.acceleration.y += (this.basePosition.y - this.position.y) * 0.0021;

    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
    this.velocity.mult(sh.damping);

    if (fs.decay > 0 && this.activation < 0.05 && Math.random() < fs.flicker * 0.16) {
      this.activation = Math.random() * 0.07 + 0.015;
    }
    const fade = fs.decay <= 0 ? 0 : fs.decay * lerp(1.35, 0.68, fs.duration);
    if (fade > 0) this.activation *= 1 - fade;
    if (this.activation < 0.001) this.activation = 0;
    this.brightness = this.activation;
  }

  display(g) {
    if (microscopeMode()) {
      const rest = restingReveal();
      const vis = this.brightness;
      if (vis < 0.012 && rest < 0.06) return;
      if (!inView(this.position.x, this.position.y, 90)) return;
      const sz = this.size * appState.freeSettings.size;
      drawPyrocystis(
        g,
        this.position.x,
        this.position.y,
        14 + sz * 2.2,
        this.noiseOffset * 0.73 + this.phase * 0.15,
        vis,
        rest,
        this.depth,
        this.noiseOffset
      );
      return;
    }
    const vis = this.brightness;
    if (vis < 0.012) return;
    if (!inView(this.position.x, this.position.y, 90)) return;
    const fs = appState.freeSettings;
    const glow = fs.glow * vis * lerp(0.68, 1, this.depth);
    const sz = this.size * fs.size;
    const x = this.position.x;
    const y = this.position.y;
    const c1 = hexRgb(fs.color1);
    const c2 = hexRgb(fs.color2);
    const cc = hexRgb(fs.coreColor);
    displaySimpleGlow(g, x, y, sz, glow, c1, c2, cc, fs.halo, fs.coreSize, this.colorVariation);
    if (glow > 0.74 && this.depth > 0.66) {
      g.fill(255, 255, 255, glow * 64);
      g.ellipse(x, y, sz * fs.coreSize * 0.5);
    }
  }
}

/* ---------- 身影唤醒粒子 ---------- */
class BodyParticle {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = createVector(0, 0);
    this.acceleration = createVector(0, 0);
    this.basePosition = createVector(x, y);
    const bs = appState.bodySettings;
    this.depth = pickDepth(0.58);
    this.size = lerp(1 - bs.sizeRandom, 1 + bs.sizeRandom, Math.random()) * lerp(0.55, 1.22, this.depth);
    this.brightness = 0;
    this.activation = 0;
    this.phase = random(TWO_PI);
    this.noiseOffset = random(100);
    this.colorVariation = random(-0.08, 0.08);
    this.maxSpeed = lerp(0.32, 1.28, this.depth);
    this.slot = 0;
    this.aimX = null;
    this.aimY = null;
    this.gatherRole = null;
    this.anchorK = null;
  }

  activate(amount) {
    const bs = appState.bodySettings;
    const deposit = amount * (0.16 + bs.duration * 0.24);
    this.activation = constrain(this.activation + deposit * (1 + this.activation * 1.25), 0, 1);
  }

  reset() {
    this.position.set(this.basePosition);
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
    this.activation = 0;
    this.brightness = 0;
    this.aimX = null;
    this.aimY = null;
    this.gatherRole = null;
    this.anchorK = null;
  }

  update() {
    const sh = appState.sharedSettings;
    const bs = appState.bodySettings;
    const gathering = this.activation > 0.04 && bodyFound && this.aimX != null && Number.isFinite(this.aimX);
    const t = frameCount * sh.flowSpeed * 0.02;
    const ang = noise(
      this.position.x * sh.flowScale,
      this.position.y * sh.flowScale,
      t + this.noiseOffset
    ) * TWO_PI * 2;
    const depthK = lerp(0.35, 1, this.depth);
    const flowMul = gathering ? 0.22 : 1;
    this.acceleration.x += Math.cos(ang) * sh.flowStrength * depthK * flowMul;
    this.acceleration.y += Math.sin(ang) * sh.flowStrength * depthK * flowMul;
    this.acceleration.x += (Math.random() - 0.5) * 0.02 * depthK * flowMul;
    this.acceleration.y += (Math.random() - 0.5) * 0.02 * depthK * flowMul;
    if (gathering) {
      const distAim = Math.hypot(this.aimX - this.position.x, this.aimY - this.position.y);
      const near = distAim < 36;
      const orbitScale = constrain(1 - distAim / 140, 0.02, 1);
      const orbit =
        (this.gatherRole === "rim" ? 3.4 : 8.5) * lerp(0.7, 1.35, this.depth) * orbitScale;
      const ot = t * 1.35 + this.noiseOffset;
      const tx = this.aimX + Math.cos(ot) * orbit;
      const ty = this.aimY + Math.sin(ot * 0.81) * orbit * 0.78;
      const drawing = constrain(mouseSpeed / 22, 0, 1);
      const whileDraw = lerp(0.55, 0.92, constrain(bs.stillSense, 0, 1));
      const gK = lerp(0.055, 0.16, constrain(bs.gather, 0, 1)) * lerp(1, whileDraw, drawing);
      const spring = gK * (near ? 0.55 : 1.25) * (this.gatherRole === "rim" ? 1.12 : 0.9);
      this.acceleration.x += (tx - this.position.x) * spring;
      this.acceleration.y += (ty - this.position.y) * spring;
    } else {
      this.acceleration.x += (this.basePosition.x - this.position.x) * 0.0021;
      this.acceleration.y += (this.basePosition.y - this.position.y) * 0.0021;
    }
    this.velocity.add(this.acceleration);
    let cap = this.maxSpeed;
    if (gathering) {
      const distAim = Math.hypot(this.aimX - this.position.x, this.aimY - this.position.y);
      const g = constrain(bs.gather, 0, 1);
      cap = distAim < 36 ? lerp(0.45, 1.6, g) : lerp(3.2, 14, g);
    }
    this.velocity.limit(cap);
    this.position.add(this.velocity);
    if (gathering) {
      const distAim = Math.hypot(this.aimX - this.position.x, this.aimY - this.position.y);
      const drawing = constrain(mouseSpeed / 22, 0, 1);
      const whileDraw = lerp(0.55, 0.92, constrain(bs.stillSense, 0, 1));
      const pull = lerp(0.06, 0.22, constrain(bs.gather, 0, 1)) * lerp(1, whileDraw, drawing);
      const k = distAim < 28 ? pull * 0.35 : pull;
      this.position.x += (this.aimX - this.position.x) * k;
      this.position.y += (this.aimY - this.position.y) * k;
    }
    this.acceleration.mult(0);
    this.velocity.mult(gathering ? 0.9 : sh.damping);
    this.position.x = constrain(this.position.x, -40, BASE_W + 40);
    this.position.y = constrain(this.position.y, -40, BASE_H + 40);

    const fade = bs.decay <= 0 ? 0 : bs.decay * lerp(1.35, 0.68, bs.duration);
    if (fade > 0) {
      const k = gathering ? 0.28 : 1;
      this.activation *= 1 - fade * k;
    }
    if (this.activation < 0.001) {
      this.activation = 0;
      this.aimX = null;
      this.aimY = null;
      this.gatherRole = null;
      this.anchorK = null;
    }
    this.brightness = this.activation;
  }

  display(g) {
    const bs = appState.bodySettings;
    if (microscopeMode()) {
      const rest = restingReveal();
      const vis = this.brightness;
      if (vis < 0.012 && rest < 0.06) return;
      if (!inView(this.position.x, this.position.y, 90)) return;
      const sz = this.size * bs.size;
      drawPyrocystis(
        g,
        this.position.x,
        this.position.y,
        14 + sz * 2.2,
        this.noiseOffset * 0.73 + this.phase * 0.15,
        vis,
        rest,
        this.depth,
        this.noiseOffset
      );
      return;
    }
    const vis = this.brightness;
    if (vis < 0.012) return;
    if (!inView(this.position.x, this.position.y, 90)) return;
    const rim = this.gatherRole === "rim";
    const fill = this.gatherRole === "fill";
    const mottling = 0.42 + 0.58 * hash01(this.noiseOffset * 0.81 + this.slot * 0.17);
    let glow = bs.glow * vis * lerp(0.38, 1, this.depth) * mottling;
    if (rim) glow *= lerp(1.05, 1.48, constrain(bs.contourBias, 0, 1));
    else if (fill) glow *= lerp(0.55, 0.88, 1 - constrain(bs.contourBias, 0, 1) * 0.45);
    const sz = this.size * bs.size * (rim ? lerp(0.82, 1.12, mottling) : fill ? 0.68 : 1);
    const halo = bs.halo * (rim ? 0.92 : fill ? 0.58 : 1) * lerp(0.78, 1.12, this.depth);
    const x = this.position.x;
    const y = this.position.y;
    const c1 = hexRgb(bs.color1);
    const c2 = hexRgb(bs.color2);
    const cc = hexRgb(bs.coreColor);
    displaySimpleGlow(g, x, y, sz, glow, c1, c2, cc, halo, bs.coreSize, this.colorVariation);
    if (rim && glow > 0.78 && this.depth > 0.7 && mottling > 0.72) {
      g.fill(255, 255, 255, glow * 42);
      g.ellipse(x, y, sz * bs.coreSize * 0.42);
    }
  }
}

/* ---------- 纹样粒子 ---------- */
class PatternParticle {
  constructor(sample) {
    this.u = sample.u;
    this.v = sample.v;
    const q = uvToCanvas(this.u, this.v);
    this.basePosition = createVector(q.x, q.y);
    this.position = createVector(q.x, q.y);
    this.velocity = createVector(0, 0);
    this.acceleration = createVector(0, 0);
    this.sourceBrightness = sample.luma;
    this.sourceWeight = sample.weight == null ? sample.luma : sample.weight;
    this.sourceColor = [sample.r, sample.g, sample.b];
    this.fluoro = fluoresceRGB(sample.r, sample.g, sample.b);
    this.activation = 0;
    this.memory = 0;
    this.displacement = 0;
    this.delay = 0;
    this.pending = 0;
    this.decay = appState.patternSettings.duration;
    this.depth = sample.contour ? random(0.55, 1) : random(0.2, 0.7);
    this.noiseOffset = random(100);
    this.motionEnergy = 0;
    const ps = appState.patternSettings;
    this.size =
      lerp(1 - ps.sizeRandom, 1 + ps.sizeRandom, Math.random()) *
      (sample.contour ? 1.2 : 0.9) *
      lerp(0.9, 1.2, this.sourceWeight);
    this.maxSpeed = 0.85;
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  activate(amount) {
    this.activation = constrain(this.activation + amount * (0.38 + this.activation * 0.9), 0, 1);
  }

  queueActivate(amount, delayFrames) {
    if (this.activation > 0.06) {
      this.activate(amount);
      return;
    }
    if (amount < this.pending && this.delay > 0) return;
    this.pending = Math.max(this.pending, amount);
    const wait = Math.max(0, delayFrames);
    if (wait < 1) {
      this.activate(this.pending);
      this.pending = 0;
      this.delay = 0;
    } else {
      this.delay = wait;
    }
  }

  reset() {
    this.position.set(this.basePosition);
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
    this.activation = 0;
    this.memory = 0;
    this.pending = 0;
    this.delay = 0;
    this.motionEnergy = 0;
  }

  update() {
    const sh = appState.sharedSettings;
    const ps = appState.patternSettings;
    if (this.delay > 0) {
      this.delay -= 1;
      if (this.delay <= 0 && this.pending > 0) {
        this.activate(this.pending);
        this.pending = 0;
      }
    }

    const t = frameCount * 0.01 * (0.35 + sh.flowSpeed);
    const wander = ps.drift * 3.4;
    const tx = this.basePosition.x + Math.sin(t + this.noiseOffset) * wander;
    const ty = this.basePosition.y + Math.cos(t * 0.81 + this.noiseOffset * 1.3) * wander * 0.75;
    this.acceleration.x += (tx - this.position.x) * ps.spring;
    this.acceleration.y += (ty - this.position.y) * ps.spring;

    const ang = noise(this.position.x * sh.flowScale, this.position.y * sh.flowScale, t) * TWO_PI;
    this.acceleration.x += Math.cos(ang) * sh.flowStrength * 0.45;
    this.acceleration.y += Math.sin(ang) * sh.flowStrength * 0.45;
    this.acceleration.x += (Math.random() - 0.5) * 0.01 * ps.drift;
    this.acceleration.y += (Math.random() - 0.5) * 0.01 * ps.drift;

    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
    this.velocity.mult(sh.damping);
    this.displacement = dist(this.position.x, this.position.y, this.basePosition.x, this.basePosition.y);

    const fade = patternFadeRate();
    const hold = fade <= 0;

    if (!hold && this.activation < 0.04 && Math.random() < 0.0018) {
      this.activation = random(0.03, 0.07);
    }

    this.memory = Math.max(this.memory, this.activation);

    if (memoryFade > 0) {
      this.memory *= 0.9;
      this.activation *= 0.9;
    } else if (!hold) {
      this.activation *= 1 - fade;
      this.memory *= 1 - fade;
    }

    this.motionEnergy = Math.max(this.motionEnergy * 0.965, this.activation);
  }

  display(g) {
    const ps = appState.patternSettings;
    const vis = Math.max(this.activation, this.memory);
    if (microscopeMode()) {
      const rest = restingReveal();
      if (vis < 0.014 && rest < 0.06) return;
      if (!inView(this.position.x, this.position.y, 90)) return;
      const sz = this.size * ps.size * 1.15;
      drawPyrocystis(
        g,
        this.position.x,
        this.position.y,
        14 + sz * 2.0,
        this.noiseOffset * 0.81,
        vis,
        rest,
        this.depth,
        this.noiseOffset
      );
      return;
    }
    if (vis < 0.014) return;
    if (!inView(this.position.x, this.position.y, 90)) return;
    const glow = ps.glow * vis * lerp(0.62, 1, this.depth) * lerp(0.75, 1.05, this.sourceWeight);
    const sz = this.size * ps.size * 1.15;
    const x = this.position.x;
    const y = this.position.y;
    let c1, c2, cc;
    if (ps.colorMode === "source") {
      c1 = this.fluoro;
      c2 = [
        this.fluoro[0] * 0.72 + 39 * 0.28,
        this.fluoro[1] * 0.72 + 216 * 0.28,
        this.fluoro[2] * 0.72 + 255 * 0.28
      ];
      cc = hexRgb(ps.coreColor);
    } else {
      c1 = hexRgb(ps.color1);
      c2 = hexRgb(ps.color2);
      cc = hexRgb(ps.coreColor);
    }
    g.noStroke();
    g.fill(c1[0], c1[1], c1[2], glow * 28);
    g.ellipse(x, y, sz * 5.4);
    g.fill(c2[0], c2[1], c2[2], glow * 58);
    g.ellipse(x, y, sz * 2.55);
    g.fill(cc[0], cc[1], cc[2], glow * 160);
    g.ellipse(x, y, sz * 0.85);
    if (glow > 0.55) {
      g.fill(255, 255, 255, glow * 70);
      g.ellipse(x, y, sz * 0.34);
    }
  }
}

function patternTraceDecay() {
  const el = document.querySelector('[data-bind="patternSettings.memoryDecay"]');
  let v = parseFloat(appState.patternSettings.memoryDecay);
  if (el) {
    const fromEl = parseFloat(el.value);
    if (Number.isFinite(fromEl)) {
      v = fromEl;
      appState.patternSettings.memoryDecay = fromEl;
    }
  }
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

function patternFadeRate() {
  const v = patternTraceDecay();
  if (!(v > 0)) return 0;
  return v * 0.055;
}

function fluoresceRGB(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  hsl.s = Math.min(1, hsl.s * 1.38 + 0.14);
  hsl.l = Math.min(0.7, hsl.l * 1.22 + 0.1);
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return [
    rgb[0] * 0.76 + 0x27 * 0.24,
    rgb[1] * 0.76 + 0xd8 * 0.24,
    rgb[2] * 0.76 + 0xff * 0.24
  ];
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const maxv = Math.max(r, g, b);
  const minv = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (maxv + minv) / 2;
  const d = maxv - minv;
  if (d > 1e-6) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (maxv === r) h = ((g - b) / d) % 6;
    else if (maxv === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s < 1e-6) r = g = b = l;
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

const MICRO_ZOOM = 1.55;

function microscopeMode() {
  return viewZoom >= MICRO_ZOOM;
}

function hash01(s) {
  const x = Math.sin(s * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function toWorld(sx, sy) {
  return {
    x: camX + (sx - width / 2) / viewZoom,
    y: camY + (sy - height / 2) / viewZoom
  };
}

function inView(x, y, pad) {
  const sx = (x - camX) * viewZoom + width / 2;
  const sy = (y - camY) * viewZoom + height / 2;
  return sx > -pad && sx < width + pad && sy > -pad && sy < height + pad;
}

function restingReveal() {
  if (!microscopeMode()) return 0;
  const z = constrain((viewZoom - MICRO_ZOOM) / 2.0, 0, 1);
  return z * stillness * appState.sharedSettings.restingVisible;
}

function clampCam() {
  const halfW = width / (2 * viewZoom);
  const halfH = height / (2 * viewZoom);
  camX = constrain(camX, halfW, width - halfW);
  camY = constrain(camY, halfH, height - halfH);
}

function setZoom(z, sx, sy) {
  const wx = camX + (sx - width / 2) / viewZoom;
  const wy = camY + (sy - height / 2) / viewZoom;
  viewZoom = constrain(z, 1, 12);
  camX = wx - (sx - width / 2) / viewZoom;
  camY = wy - (sy - height / 2) / viewZoom;
  clampCam();
  appState.sharedSettings.zoom = viewZoom;
  const el = document.querySelector('[data-bind="sharedSettings.zoom"]');
  if (el && Math.abs(parseFloat(el.value) - viewZoom) > 0.001) el.value = String(viewZoom);
  updateValLabels();
  const badge = document.getElementById("zoom-badge");
  if (badge) badge.textContent = "×" + viewZoom.toFixed(1);
}

function applyView(g) {
  if (g && typeof g.translate === "function" && g !== window) {
    g.translate(width / 2, height / 2);
    g.scale(viewZoom);
    g.translate(-camX, -camY);
    return;
  }
  translate(width / 2, height / 2);
  scale(viewZoom);
  translate(-camX, -camY);
}

function drawSpindle(g, L, W) {
  g.beginShape();
  g.vertex(-L * 0.5, 0);
  g.bezierVertex(-L * 0.22, W * 0.52, L * 0.22, W * 0.52, L * 0.5, 0);
  g.bezierVertex(L * 0.22, -W * 0.52, -L * 0.22, -W * 0.52, -L * 0.5, 0);
  g.endShape(CLOSE);
}

function drawPyrocystis(g, x, y, L, angle, glowAmt, restAmt, depth, seed) {
  if (microBudget <= 0) return false;
  if (!inView(x, y, L * viewZoom + 40)) return false;
  const sh = appState.sharedSettings;
  const W = L * sh.cellAspect;
  const core = sh.coreAmount;
  const blue = constrain(glowAmt * 1.35, 0, 1);
  const natural = constrain(restAmt * (1 - blue * 0.82), 0, 1);
  if (blue < 0.03 && natural < 0.04) return false;
  microBudget -= 1;
  g.blendMode(BLEND);
  g.push();
  g.translate(x, y);
  g.rotate(angle);
  if (natural > 0.04) {
    const a = natural * lerp(0.55, 1, depth);
    g.noStroke();
    g.fill(8, 16, 28, a * 28);
    drawSpindle(g, L * 1.08, W * 1.18);
    g.fill(176, 196, 214, a * 38);
    g.stroke(228, 244, 252, a * 150);
    g.strokeWeight(Math.max(0.45, L * 0.018));
    drawSpindle(g, L, W);
    g.noFill();
    g.stroke(210, 230, 242, a * 55);
    g.strokeWeight(0.5);
    g.line(-L * 0.28, 0, L * 0.28, 0);
    const n = Math.floor(lerp(5, 14, constrain(L * viewZoom / 40, 0, 1)));
    g.noStroke();
    for (let i = 0; i < n; i++) {
      const u = hash01(seed + i * 1.7);
      const v = hash01(seed + i * 3.1);
      const px = (u - 0.5) * L * 0.34;
      const py = (v - 0.5) * W * 0.38;
      g.fill(198 + u * 40, 92 + v * 70, 18 + u * 22, a * 90 * core);
      g.ellipse(px, py, L * 0.07 + v * L * 0.05, L * 0.055 + u * L * 0.04);
    }
    g.fill(212, 128, 36, a * 120 * core);
    g.ellipse(0, 0, W * 0.42, W * 0.36);
    g.fill(240, 186, 78, a * 70 * core);
    g.ellipse(-W * 0.04, -W * 0.03, W * 0.16, W * 0.14);
  }
  if (blue > 0.03) {
    const a = blue * lerp(0.5, 1, depth);
    g.noStroke();
    g.fill(0, 120, 210, a * 22);
    g.ellipse(0, 0, L * 1.85, W * 2.5);
    g.fill(20, 170, 255, a * 28);
    g.ellipse(0, 0, L * 1.15, W * 1.7);
    g.fill(12, 90, 170, a * 50);
    g.stroke(70, 210, 255, a * 160);
    g.strokeWeight(Math.max(0.5, L * 0.02));
    drawSpindle(g, L, W);
    g.noStroke();
    const grains = Math.floor(lerp(8, 42, constrain(L * viewZoom / 28, 0, 1)));
    for (let i = 0; i < grains; i++) {
      const u = hash01(seed + 20 + i * 2.3);
      const v = hash01(seed + 40 + i * 1.9);
      const along = (u - 0.5) * L * 0.82;
      const span = (1 - Math.abs(along) / (L * 0.5)) * W * 0.38;
      const py = (v - 0.5) * span * 2;
      const bright = 0.35 + (1 - Math.abs(along) / (L * 0.5)) * 0.65;
      g.fill(40 + u * 40, 180 + v * 50, 255, a * 55 * bright);
      g.ellipse(along, py, L * 0.045 + u * L * 0.03, L * 0.038);
    }
    g.fill(176, 78, 22, a * 110 * core);
    g.ellipse(0, 0, W * 0.48, W * 0.42);
    g.fill(230, 150, 48, a * 80 * core);
    g.ellipse(-W * 0.03, W * 0.02, W * 0.18, W * 0.16);
    g.fill(210, 245, 255, a * 90);
    g.ellipse(0, 0, W * 0.09, W * 0.08);
  }
  g.pop();
  g.blendMode(ADD);
  return true;
}

function displaySimpleGlow(g, x, y, sz, glow, c1, c2, cc, halo, coreSize, variation) {
  g.noStroke();
  g.fill(c1[0], c1[1], c1[2], glow * 20);
  g.ellipse(x, y, sz * halo * 5.4);
  g.fill(
    constrain(c2[0] * (1 + variation), 0, 255),
    constrain(c2[1] * (1 + variation), 0, 255),
    constrain(c2[2] * (1 + variation), 0, 255),
    glow * 46
  );
  g.ellipse(x, y, sz * halo * 2.5);
  g.fill(39, 216, 255, glow * 32);
  g.ellipse(x, y, sz * halo * 1.45);
  if (glow > 0.18) {
    g.fill(cc[0], cc[1], cc[2], glow * 135);
    g.ellipse(x, y, sz * coreSize * 1.55);
  }
}

class WaterWake {
  constructor(x, y, heading, speedN, arm) {
    this.x = x;
    this.y = y;
    this.heading = heading || 0;
    this.r = (arm ? 5 : 8) + speedN * (arm ? 5 : 7);
    this.growth = 1.62 + speedN * 0.55;
    this.alpha = arm ? 0.42 : 0.72;
    this.flatten = 0.5 + (Math.random() - 0.5) * 0.05;
    this.stretch = 1 + speedN * 0.22;
    this.crest = lerp(1.05, 2.05, constrain(speedN, 0, 1));
    this.gap = 9 + speedN * 10;
    this.arm = arm;
    this.alive = true;
  }

  update() {
    this.r += this.growth;
    this.growth *= 0.9965;
    this.alpha *= 0.971;
    this.stretch += (1 - this.stretch) * 0.014;
    if (this.r > 340 || this.alpha < 0.016) this.alive = false;
  }

  display(g) {
    const amt = appState.sharedSettings.water;
    const a = this.alpha * amt * 1.85;
    if (a < 0.01) return;
    const w = this.r * 2 * this.stretch;
    const h = this.r * 2 * this.flatten;
    g.push();
    g.translate(this.x, this.y);
    g.rotate(this.heading);
    g.noFill();
    g.stroke(14, 40, 64, a * 90);
    g.strokeWeight(this.crest * 2.3);
    g.ellipse(0, 0, w + this.crest * 2, h + this.crest * 1.2);
    g.stroke(168, 214, 236, a * 165);
    g.strokeWeight(this.crest);
    g.ellipse(0, 0, w, h);
    if (this.r > 16) {
      const inner = Math.max(6, this.r - this.gap);
      g.stroke(214, 238, 252, a * 70);
      g.strokeWeight(this.crest * 0.62);
      g.ellipse(0, 0, inner * 2 * this.stretch, inner * 2 * this.flatten);
    }
    g.stroke(255, 255, 255, a * 42);
    g.strokeWeight(this.crest * 0.4);
    g.arc(0, 0, w, h, 0.35, Math.PI - 0.35);
    g.pop();
  }
}

class Ripple {
  constructor(x, y, strength) {
    this.x = x;
    this.y = y;
    this.r = 8;
    this.growth = 1.5 + strength * 1.7;
    this.maxR = 64 + strength * 96;
    this.alpha = 0.5 * strength;
    this.alive = true;
  }

  update() {
    this.r += this.growth;
    this.growth *= 0.986;
    this.alpha *= 0.968;
    if (this.r > this.maxR || this.alpha < 0.02) this.alive = false;
  }

  display(g) {
    g.noFill();
    g.stroke(90, 180, 230, this.alpha * 85);
    g.strokeWeight(1.15);
    g.ellipse(this.x, this.y, this.r * 2);
    g.stroke(190, 235, 255, this.alpha * 36);
    g.ellipse(this.x, this.y, this.r * 1.55);
  }
}

class Sparkle {
  constructor(x, y) {
    this.x = x + random(-8, 8);
    this.y = y + random(-8, 8);
    this.life = 1;
    this.size = random(0.5, 1.55);
    this.vx = random(-0.18, 0.18);
    this.vy = random(-0.12, 0.08);
  }

  update() {
    this.life -= 0.036;
    this.x += this.vx;
    this.y += this.vy;
  }

  display(g) {
    if (this.life <= 0) return;
    g.noStroke();
    g.fill(216, 247, 255, this.life * 88);
    g.ellipse(this.x, this.y, this.size);
  }
}

function spawnFreeParticles() {
  freeParticles.length = 0;
  const fs = appState.freeSettings;
  const n = Math.min(fs.count, deviceMaxParticles());
  const centers = [];
  const cc = 4 + Math.floor(fs.cluster * 9);
  for (let i = 0; i < cc; i++) {
    centers.push({
      x: random(BASE_W * 0.12, BASE_W * 0.88),
      y: random(BASE_H * 0.12, BASE_H * 0.88),
      r: random(110, 360)
    });
  }
  let guard = 0;
  while (freeParticles.length < n && guard < n * 8) {
    guard += 1;
    let x;
    let y;
    if (Math.random() < fs.cluster * 0.45) {
      const c = centers[(Math.random() * centers.length) | 0];
      x = constrain(c.x + randomGaussian(0, c.r * 0.32), 0, BASE_W);
      y = constrain(c.y + randomGaussian(0, c.r * 0.32), 0, BASE_H);
    } else {
      x = random(BASE_W);
      y = random(BASE_H);
    }
    freeParticles.push(new Particle(x, y));
  }
}

function spawnBodyParticles() {
  bodyParticles.length = 0;
  const bs = appState.bodySettings;
  const n = Math.min(bs.count, deviceMaxParticles());
  const centers = [];
  const cc = 5;
  for (let i = 0; i < cc; i++) {
    centers.push({
      x: random(BASE_W * 0.12, BASE_W * 0.88),
      y: random(BASE_H * 0.12, BASE_H * 0.88),
      r: random(120, 340)
    });
  }
  let guard = 0;
  while (bodyParticles.length < n && guard < n * 8) {
    guard += 1;
    let x;
    let y;
    if (Math.random() < 0.38) {
      const c = centers[(Math.random() * centers.length) | 0];
      x = constrain(c.x + randomGaussian(0, c.r * 0.32), 0, BASE_W);
      y = constrain(c.y + randomGaussian(0, c.r * 0.32), 0, BASE_H);
    } else {
      x = random(BASE_W);
      y = random(BASE_H);
    }
    const p = new BodyParticle(x, y);
    p.slot = bodyParticles.length;
    bodyParticles.push(p);
  }
}

function restockBodySea() {
  const bs = appState.bodySettings;
  const base = Math.min(bs.count, deviceMaxParticles());
  const cap = bodyParticleCap();
  if (bodyFound && !silhouetteIsFilled()) return;
  let unlit = 0;
  for (let i = 0; i < bodyParticles.length; i++) {
    if (bodyParticles[i].activation < 0.045) unlit += 1;
  }
  const want = Math.floor(base * 0.62);
  let guard = 0;
  while (unlit < want && bodyParticles.length < cap && guard < 28) {
    guard += 1;
    const p = new BodyParticle(random(BASE_W), random(BASE_H));
    p.slot = bodyParticles.length;
    bodyParticles.push(p);
    unlit += 1;
  }
}

function countGatherRole(role) {
  let n = 0;
  for (let i = 0; i < bodyParticles.length; i++) {
    const p = bodyParticles[i];
    if (p.activation > 0.04 && p.gatherRole === role) n += 1;
  }
  return n;
}

function silhouetteWanted() {
  const nC = Math.max(8, bodyContourTargets.length);
  const nF = Math.max(24, bodyFillTargets.length);
  return {
    rim: Math.ceil(nC * 1.35),
    fill: Math.ceil(nF * 3.1)
  };
}

function silhouetteIsFilled() {
  if (!bodyFound || (!bodyContourTargets.length && !bodyFillTargets.length)) return true;
  const want = silhouetteWanted();
  return countGatherRole("fill") >= want.fill && countGatherRole("rim") >= want.rim;
}

function seedBodyGlow(x, y, radius, budget) {
  if (!bodyFound) return 0;
  const want = silhouetteWanted();
  let haveFill = countGatherRole("fill");
  let haveRim = countGatherRole("rim");
  const cap = bodyParticleCap();
  let spawned = 0;
  while (spawned < budget && bodyParticles.length < cap) {
    const needFill = haveFill < want.fill;
    const needRim = haveRim < want.rim;
    if (!needFill && !needRim) break;
    const preferFill = needFill && (!needRim || spawned % 4 !== 0);
    const role = preferFill && bodyFillTargets.length ? "fill" : bodyContourTargets.length ? "rim" : "fill";
    const targets = role === "fill" ? bodyFillTargets : bodyContourTargets;
    if (!targets.length) break;
    const slot = targets[(Math.random() * targets.length) | 0];
    const p = new BodyParticle(
      constrain(x + randomGaussian(0, radius * 0.42), 0, BASE_W),
      constrain(y + randomGaussian(0, radius * 0.42), 0, BASE_H)
    );
    p.slot = bodyParticles.length;
    p.gatherRole = role;
    p.anchorK = role === "rim" ? Math.random() * 0.24 : 0.58 + Math.random() * 0.4;
    p.aimX = slot.x + randomGaussian(0, role === "fill" ? 7 : 2.2);
    p.aimY = slot.y + randomGaussian(0, role === "fill" ? 7 : 2.2);
    p.activate(0.92);
    bodyParticles.push(p);
    if (role === "fill") haveFill += 1;
    else haveRim += 1;
    spawned += 1;
  }
  return spawned;
}

function bodyVideoRect() {
  const vw = Math.max(1, bodyVideoW);
  const vh = Math.max(1, bodyVideoH);
  const s = Math.min(BASE_W / vw, BASE_H / vh);
  const w = vw * s;
  const h = vh * s;
  return { x: (BASE_W - w) * 0.5, y: (BASE_H - h) * 0.5, w, h };
}

function maskToWorld(mx, my, mw, mh) {
  const r = bodyVideoRect();
  const nx = (mx + 0.5) / mw;
  const ny = (my + 0.5) / mh;
  return {
    x: r.x + (1 - nx) * r.w,
    y: r.y + ny * r.h
  };
}

function bodyCellAt(wx, wy) {
  const r = bodyVideoRect();
  const nx = 1 - (wx - r.x) / Math.max(1, r.w);
  const ny = (wy - r.y) / Math.max(1, r.h);
  const mx = constrain(Math.floor(nx * bodyMaskW), 0, bodyMaskW - 1);
  const my = constrain(Math.floor(ny * bodyMaskH), 0, bodyMaskH - 1);
  return my * bodyMaskW + mx;
}

function ingestBodyMask(info) {
  if (appState.mode !== "body") {
    bodyFound = false;
    bodyHold = 0;
    return;
  }
  if (!info || !info.person) {
    bodyHold = Math.max(0, bodyHold - 1);
    if (bodyHold <= 0) bodyFound = false;
    return;
  }
  if (info.vw) bodyVideoW = info.vw;
  if (info.vh) bodyVideoH = info.vh;
  bodyMaskW = info.w || 160;
  bodyMaskH = info.h || 90;
  const n = bodyMaskW * bodyMaskH;
  const incoming = info.person;
  if (!bodySoft || bodySoft.length !== n) bodySoft = new Float32Array(n);
  if (!bodyPerson || bodyPerson.length !== n) bodyPerson = new Uint8Array(n);
  let filled = 0;
  if (info.found) {
    for (let i = 0; i < n; i++) {
      const on = incoming[i] ? 1 : 0;
      bodySoft[i] = on ? Math.max(bodySoft[i], 0.92) : bodySoft[i] * 0.55;
      const lit = bodySoft[i] > 0.35;
      bodyPerson[i] = lit ? 1 : 0;
      if (lit) filled += 1;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const v = incoming[i] ? 1 : 0;
      bodySoft[i] += (v - bodySoft[i]) * 0.1;
      const on = bodySoft[i] > 0.45;
      bodyPerson[i] = on ? 1 : 0;
      if (on) filled += 1;
    }
  }
  if (filled > 40) {
    const closed = new Uint8Array(bodyPerson);
    const w = bodyMaskW;
    const h = bodyMaskH;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (closed[i]) continue;
        let nb = 0;
        if (bodyPerson[i - 1]) nb += 1;
        if (bodyPerson[i + 1]) nb += 1;
        if (bodyPerson[i - w]) nb += 1;
        if (bodyPerson[i + w]) nb += 1;
        if (bodyPerson[i - w - 1]) nb += 1;
        if (bodyPerson[i - w + 1]) nb += 1;
        if (bodyPerson[i + w - 1]) nb += 1;
        if (bodyPerson[i + w + 1]) nb += 1;
        if (nb >= 5) {
          closed[i] = 1;
          filled += 1;
        }
      }
    }
    bodyPerson = closed;
  }
  const tooBig = filled > n * 0.9;
  const tooSmall = filled < n * 0.004;
  if (!!info.found && !tooBig && !tooSmall) {
    bodyFound = true;
    bodyHold = 50;
    rebuildBodyField();
  } else if (bodyHold > 0 && (bodyContourTargets.length || bodyFillTargets.length)) {
    bodyHold -= 1;
    bodyFound = true;
  } else {
    bodyHold = 0;
    bodyFound = false;
  }
  const m = typeof info.motion === "number" ? info.motion : 0;
  bodyMotion += (m - bodyMotion) * 0.32;
}

function rebuildBodyField() {
  const w = bodyMaskW;
  const h = bodyMaskH;
  const n = w * h;
  const person = bodyPerson;
  if (!person || person.length < n) return;
  if (!bodyNearX || bodyNearX.length !== n) {
    bodyNearX = new Float32Array(n);
    bodyNearY = new Float32Array(n);
    bodyEdgeX = new Float32Array(n);
    bodyEdgeY = new Float32Array(n);
    bodyInside = new Uint8Array(n);
    bodyEdge = new Uint8Array(n);
    bodySrc = new Int32Array(n);
    bodyEdgeSrc = new Int32Array(n);
  }
  bodyInside.fill(0);
  bodyEdge.fill(0);
  bodySrc.fill(-1);
  bodyEdgeSrc.fill(-1);
  const qx = new Int16Array(n);
  const qy = new Int16Array(n);
  let qt = 0;
  const eqx = new Int16Array(n);
  const eqy = new Int16Array(n);
  let eqt = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!person[i]) continue;
      bodyInside[i] = 1;
      bodySrc[i] = i;
      qx[qt] = x;
      qy[qt] = y;
      qt += 1;
      let edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (!edge) {
        if (!person[i - 1] || !person[i + 1] || !person[i - w] || !person[i + w]) edge = true;
      }
      if (edge) {
        bodyEdge[i] = 1;
        bodyEdgeSrc[i] = i;
        eqx[eqt] = x;
        eqy[eqt] = y;
        eqt += 1;
      }
    }
  }
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  let qh = 0;
  while (qh < qt) {
    const x = qx[qh];
    const y = qy[qh];
    qh += 1;
    const src = bodySrc[y * w + x];
    for (let d = 0; d < 4; d++) {
      const nx = x + dirs[d][0];
      const ny = y + dirs[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (bodySrc[ni] >= 0) continue;
      bodySrc[ni] = src;
      qx[qt] = nx;
      qy[qt] = ny;
      qt += 1;
    }
  }
  let eh = 0;
  if (eqt === 0) {
    for (let i = 0; i < n; i++) bodyEdgeSrc[i] = bodySrc[i];
  } else {
    while (eh < eqt) {
      const x = eqx[eh];
      const y = eqy[eh];
      eh += 1;
      const src = bodyEdgeSrc[y * w + x];
      for (let d = 0; d < 4; d++) {
        const nx = x + dirs[d][0];
        const ny = y + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (bodyEdgeSrc[ni] >= 0) continue;
        bodyEdgeSrc[ni] = src;
        eqx[eqt] = nx;
        eqy[eqt] = ny;
        eqt += 1;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const si = bodySrc[i];
    if (si >= 0) {
      const sx = si % w;
      const sy = (si / w) | 0;
      const p = maskToWorld(sx, sy, w, h);
      bodyNearX[i] = p.x;
      bodyNearY[i] = p.y;
    }
    const ei = bodyEdgeSrc[i];
    if (ei >= 0) {
      const ex = ei % w;
      const ey = (ei / w) | 0;
      const p = maskToWorld(ex, ey, w, h);
      bodyEdgeX[i] = p.x;
      bodyEdgeY[i] = p.y;
    }
  }
  bodyContourTargets.length = 0;
  bodyFillTargets.length = 0;
  const rawC = [];
  const rawF = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bodyInside[i]) continue;
      const p = maskToWorld(x, y, w, h);
      if (bodyEdge[i]) rawC.push(p);
      else rawF.push(p);
    }
  }
  const spacing = 9;
  const sortedC = polarSortPoints(rawC);
  const thinnedC = thinBySpacing(sortedC, spacing);
  for (let i = 0; i < thinnedC.length; i++) bodyContourTargets.push(thinnedC[i]);
  const thinnedF = thinBySpacing(rawF, 11);
  for (let i = 0; i < thinnedF.length; i++) bodyFillTargets.push(thinnedF[i]);
  if (!bodyFillTargets.length && bodyContourTargets.length) {
    for (let i = 0; i < bodyContourTargets.length; i += 4) bodyFillTargets.push(bodyContourTargets[i]);
  }
}

function polarSortPoints(pts) {
  if (pts.length < 3) return pts.slice();
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    cx += pts[i].x;
    cy += pts[i].y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function thinBySpacing(pts, minDist) {
  if (!pts.length) return [];
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const q = out[out.length - 1];
    const gap = minDist * lerp(0.5, 1.62, hash01(i * 0.173 + p.x * 0.007));
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    if (dx * dx + dy * dy >= gap * gap) out.push(p);
  }
  return out;
}

function gatherBody() {
  const bs = appState.bodySettings;
  const hasTargets = bodyContourTargets.length || bodyFillTargets.length;
  if ((!bodyFound && bodyHold <= 0) || !bodyInside || !hasTargets) {
    bodyGatherAmt *= 0.9;
    if (bodyGatherAmt < 0.02) bodyGatherAmt = 0;
    for (let i = 0; i < bodyParticles.length; i++) {
      bodyParticles[i].aimX = null;
      bodyParticles[i].aimY = null;
    }
    return;
  }
  bodyGatherAmt = Math.min(1, bodyGatherAmt + lerp(0.08, 0.2, constrain(bs.settle, 0, 1.2) / 1.2));
  const nF = bodyFillTargets.length;
  const nC = bodyContourTargets.length;
  const rimShare = lerp(0.28, 0.52, constrain(bs.contourBias, 0, 1));
  const hasNear = bodyNearX && bodyNearX.length === bodyMaskW * bodyMaskH;

  for (let i = 0; i < bodyParticles.length; i++) {
    const p = bodyParticles[i];
    if (p.activation < 0.04) {
      p.aimX = null;
      p.aimY = null;
      p.gatherRole = null;
      continue;
    }
    if (p.anchorK == null) p.anchorK = hash01(p.slot * 0.618033 + 0.17);
    const wantRim = p.anchorK < rimShare && nC > 1;
    let t0 = null;
    let t1 = null;
    let role;
    if (wantRim) {
      role = "rim";
      const j = Math.floor(p.anchorK * nC) % nC;
      t0 = bodyContourTargets[j];
      t1 = bodyContourTargets[(j + 1) % nC];
    } else if (nF > 1) {
      role = "fill";
      const j = Math.floor(p.anchorK * nF) % nF;
      t0 = bodyFillTargets[j];
      t1 = bodyFillTargets[(j + 1) % nF];
    } else if (nC > 1) {
      role = "rim";
      const j = Math.floor(p.anchorK * nC) % nC;
      t0 = bodyContourTargets[j];
      t1 = bodyContourTargets[(j + 1) % nC];
    } else if (nC === 1 || nF === 1) {
      role = nC ? "rim" : "fill";
      t0 = nC ? bodyContourTargets[0] : bodyFillTargets[0];
      t1 = t0;
    } else if (hasNear) {
      role = "fill";
      const cell = bodyCellAt(p.position.x, p.position.y);
      t0 = { x: bodyNearX[cell], y: bodyNearY[cell] };
      t1 = t0;
    } else {
      p.aimX = null;
      p.aimY = null;
      p.gatherRole = null;
      continue;
    }
    p.gatherRole = role;
    const u = hash01(p.slot * 2.31 + p.noiseOffset);
    let jx = lerp(t0.x, t1.x, u) + Math.sin(p.noiseOffset * 1.7) * (role === "rim" ? 2.4 : 7);
    let jy = lerp(t0.y, t1.y, u) + Math.cos(p.noiseOffset * 1.3) * (role === "rim" ? 2.0 : 6);
    if (!Number.isFinite(jx) || !Number.isFinite(jy)) {
      p.aimX = null;
      p.aimY = null;
      continue;
    }
    if (p.aimX == null) {
      p.aimX = jx;
      p.aimY = jy;
    } else {
      const jump = Math.hypot(jx - p.aimX, jy - p.aimY);
      const follow = jump > 110 ? 0.72 : 0.4;
      p.aimX += (jx - p.aimX) * follow;
      p.aimY += (jy - p.aimY) * follow;
    }
  }
}

function settleBodyGlow() {
  const bs = appState.bodySettings;
  if (!bodyFound || !bodyInside) return;
  const rate = lerp(0.006, 0.038, constrain(bs.settle, 0, 1.2) / 1.2);
  for (let i = 0; i < bodyParticles.length; i++) {
    const p = bodyParticles[i];
    const cell = bodyCellAt(p.position.x, p.position.y);
    if (!bodyInside[cell]) continue;
    const edge = bodyEdge && bodyEdge[cell];
    if (edge) p.activate(rate * 1.2);
    else p.activate(rate * 0.85);
  }
}

function lumaAt(px, w, x, y) {
  const i = 4 * (y * w + x);
  return (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * (px[i + 3] / 255);
}

function sobelAt(px, w, x, y) {
  const n = lumaAt(px, w, x - 1, y - 1);
  const c = lumaAt(px, w, x, y - 1);
  const m = lumaAt(px, w, x + 1, y - 1);
  const k = lumaAt(px, w, x - 1, y);
  const p = lumaAt(px, w, x + 1, y);
  const q = lumaAt(px, w, x - 1, y + 1);
  const r = lumaAt(px, w, x, y + 1);
  const s = lumaAt(px, w, x + 1, y + 1);
  const gx = -n + m - 2 * k + 2 * p - q + s;
  const gy = -n - 2 * c - m + q + 2 * r + s;
  return Math.min(1, Math.hypot(gx, gy) / 1400);
}

function analyzePattern(px, w, h) {
  let lowA = 0;
  let n = 0;
  let lumaSum = 0;
  let cornerLuma = 0;
  let cn = 0;
  let centerLuma = 0;
  let kn = 0;
  const mx0 = w * 0.12;
  const mx1 = w * 0.88;
  const my0 = h * 0.12;
  const my1 = h * 0.88;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = 4 * (y * w + x);
      const a = px[i + 3] / 255;
      const luma = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      n += 1;
      lumaSum += luma;
      if (a < 0.15) lowA += 1;
      const isCorner = x < mx0 || x > mx1 || y < my0 || y > my1;
      if (isCorner) {
        cornerLuma += luma;
        cn += 1;
      } else {
        centerLuma += luma;
        kn += 1;
      }
    }
  }
  const hasAlpha = lowA / Math.max(1, n) > 0.08;
  const cL = cornerLuma / Math.max(1, cn);
  const kL = centerLuma / Math.max(1, kn);
  let mode = "bright";
  if (hasAlpha) mode = "alpha";
  else if (cL > kL + 0.07) mode = "dark";
  else if (kL > cL + 0.07) mode = "bright";
  else mode = lumaSum / n > 0.55 ? "dark" : "bright";
  return { hasAlpha, mode };
}

function isPatternSubject(s, analysis, luma, alpha, rec, invert) {
  let ok = false;
  if (rec === "alpha") ok = alpha > s.alphaCut;
  else if (rec === "bright") ok = luma > s.threshold && alpha > s.alphaCut * 0.5;
  else if (rec === "dark") ok = luma < s.threshold && alpha > 0.04;
  else if (rec === "edge") ok = alpha > 0.04;
  else {
    if (analysis.hasAlpha) ok = alpha > s.alphaCut;
    else if (analysis.mode === "dark") ok = luma < s.threshold && alpha > 0.04;
    else ok = luma > s.threshold && alpha > s.alphaCut * 0.5;
  }
  if (invert) ok = !ok && alpha > 0.03;
  return ok;
}

function readPatternPixels(img, sw, sh) {
  if (patternSampleGfx) {
    patternSampleGfx.remove();
    patternSampleGfx = null;
  }
  patternSampleGfx = createGraphics(sw, sh);
  patternSampleGfx.pixelDensity(1);
  patternSampleGfx.clear();
  patternSampleGfx.image(img, 0, 0, sw, sh);
  const canvas = patternSampleGfx.canvas || patternSampleGfx.elt;
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const pw = canvas.width;
    const ph = canvas.height;
    const px = ctx.getImageData(0, 0, pw, ph).data;
    if (px && px.length >= 16) return { px, pw, ph };
  } catch (err) {
    /* fallback below */
  }
  patternSampleGfx.loadPixels();
  return {
    px: patternSampleGfx.pixels,
    pw: patternSampleGfx.width,
    ph: patternSampleGfx.height
  };
}

function collectPatternCandidates(px, pw, ph, rec, invert) {
  const s = appState.patternSettings;
  const analysis = analyzePattern(px, pw, ph);
  const useRec = rec === "auto" ? analysis.mode : rec;
  const gap = Math.max(2, s.sampleGap);
  const candidates = [];
  for (let y = 1; y < ph - 1; y += gap) {
    for (let x = 1; x < pw - 1; x += gap) {
      const i = 4 * (y * pw + x);
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const a = px[i + 3];
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const alpha = a / 255;
      const edge = sobelAt(px, pw, x, y);
      const subject = isPatternSubject(s, analysis, luma, alpha, useRec, invert);
      let keep = false;
      let contour = false;
      if (useRec === "edge") {
        keep = edge > s.edgeSense && alpha > 0.04;
        if (invert) keep = !keep && alpha > 0.04;
        contour = true;
      } else if (useRec === "contourFill") {
        if (!subject) continue;
        if (edge > s.edgeSense) {
          keep = Math.random() < s.contourDensity * s.density;
          contour = true;
        } else {
          keep = Math.random() < s.fillDensity * s.density;
        }
      } else if (subject) {
        keep = Math.random() < s.density;
        contour = edge > s.edgeSense;
      }
      if (!keep) continue;
      let weight = luma;
      if (useRec === "dark" || (useRec === "contourFill" && analysis.mode === "dark")) weight = 1 - luma;
      else if (useRec === "alpha") weight = alpha;
      if (invert) weight = 1 - weight;
      candidates.push({
        u: (x + (Math.random() - 0.5) * gap * 0.72) / pw,
        v: (y + (Math.random() - 0.5) * gap * 0.72) / ph,
        r,
        g,
        b,
        luma,
        weight: constrain(weight, 0.15, 1),
        contour,
        edge
      });
    }
  }
  return candidates;
}

function collectContrastCandidates(px, pw, ph) {
  const s = appState.patternSettings;
  const gap = Math.max(2, s.sampleGap);
  let sum = 0;
  let n = 0;
  for (let y = 1; y < ph - 1; y += gap) {
    for (let x = 1; x < pw - 1; x += gap) {
      const i = 4 * (y * pw + x);
      sum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      n += 1;
    }
  }
  const mean = sum / Math.max(1, n);
  const candidates = [];
  for (let y = 1; y < ph - 1; y += gap) {
    for (let x = 1; x < pw - 1; x += gap) {
      const i = 4 * (y * pw + x);
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const a = px[i + 3];
      if (a < 12) continue;
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const edge = sobelAt(px, pw, x, y);
      if (Math.abs(luma - mean) < 0.055 && edge < s.edgeSense * 0.5) continue;
      if (Math.random() > s.density) continue;
      candidates.push({
        u: (x + (Math.random() - 0.5) * gap * 0.72) / pw,
        v: (y + (Math.random() - 0.5) * gap * 0.72) / ph,
        r,
        g,
        b,
        luma,
        weight: constrain(Math.abs(luma - mean) * 2.2, 0.15, 1),
        contour: edge > s.edgeSense * 0.7,
        edge
      });
    }
  }
  return candidates;
}

function collectAllOpaqueCandidates(px, pw, ph) {
  const s = appState.patternSettings;
  const gap = Math.max(3, s.sampleGap + 1);
  const candidates = [];
  for (let y = 1; y < ph - 1; y += gap) {
    for (let x = 1; x < pw - 1; x += gap) {
      const i = 4 * (y * pw + x);
      const a = px[i + 3];
      if (a < 18) continue;
      if (Math.random() > Math.min(1, s.density * 0.85)) continue;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      candidates.push({
        u: x / pw,
        v: y / ph,
        r,
        g,
        b,
        luma,
        weight: constrain(1 - Math.abs(luma - 0.5), 0.2, 1),
        contour: false,
        edge: 0
      });
    }
  }
  return candidates;
}

/* 从纹样图片采样生成粒子，不按像素一一对应 */
function samplePattern() {
  patternParticles.length = 0;
  const img = appState.patternImage;
  if (!img) {
    updatePatternHint();
    return;
  }
  const maxSide = 640;
  const sc = Math.min(1, maxSide / Math.max(img.width, img.height));
  const sw = Math.max(8, Math.round(img.width * sc));
  const sh = Math.max(8, Math.round(img.height * sc));
  const { px, pw, ph } = readPatternPixels(img, sw, sh);
  const s = appState.patternSettings;
  let candidates = collectPatternCandidates(px, pw, ph, s.recognition, s.invert);
  if (candidates.length < 40) {
    candidates = collectPatternCandidates(px, pw, ph, s.recognition, !s.invert);
  }
  if (candidates.length < 40) {
    candidates = collectPatternCandidates(px, pw, ph, "edge", s.invert);
  }
  if (candidates.length < 40) {
    candidates = collectContrastCandidates(px, pw, ph);
  }
  if (candidates.length < 40) {
    candidates = collectAllOpaqueCandidates(px, pw, ph);
  }
  const cap = Math.min(s.maxCount, deviceMaxParticles() + 400);
  if (candidates.length > cap) {
    candidates.sort((a, b) => (b.contour ? 1 : 0) - (a.contour ? 1 : 0) || b.edge - a.edge);
    candidates.length = cap;
  }
  for (let i = 0; i < candidates.length; i++) {
    patternParticles.push(new PatternParticle(candidates[i]));
  }
  if (patternParticles.length === 0) {
    toast(t("toast.noParticles"));
  } else {
    toast(t("toast.sampled", { n: patternParticles.length }));
  }
  updatePatternHint();
}

function patternBox() {
  const s = appState.patternSettings;
  const img = appState.patternImage;
  const maxW = BASE_W * s.scale;
  const maxH = BASE_H * s.scale;
  let w = maxW;
  let h = maxH;
  if (img && s.keepAspect) {
    const ir = img.width / img.height;
    if (w / h > ir) w = h * ir;
    else h = w / ir;
  }
  return { w, h, cx: BASE_W * s.posX, cy: BASE_H * s.posY };
}

function uvToCanvas(u, v) {
  const s = appState.patternSettings;
  const box = patternBox();
  let px = (u - 0.5) * box.w;
  let py = (v - 0.5) * box.h;
  if (s.flipH) px = -px;
  if (s.flipV) py = -py;
  const a = (s.rotation * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return { x: box.cx + px * ca - py * sa, y: box.cy + px * sa + py * ca };
}

function refreshPatternLayout() {
  for (let i = 0; i < patternParticles.length; i++) {
    const p = patternParticles[i];
    const q = uvToCanvas(p.u, p.v);
    p.basePosition.set(q.x, q.y);
  }
}

function makeGrain() {
  for (let i = 0; i < grainLayers.length; i++) grainLayers[i].remove();
  grainLayers = [];
  for (let k = 0; k < 4; k++) {
    const g = createGraphics(640, 360);
    g.pixelDensity(1);
    g.clear();
    g.noStroke();
    for (let i = 0; i < 1400; i++) {
      g.fill(220, 230, 240, random(4, 18));
      g.rect(random(g.width), random(g.height), random(1, 2), random(1, 2));
    }
    grainLayers.push(g);
  }
}

function drawProceduralBg(g, w, h) {
  const d = appState.sharedSettings.bgDark;
  const step = 8;
  g.noStroke();
  for (let y = 0; y < h; y += step) {
    const n = noise(y * 0.004, 0.2);
    const k = y / h;
    const r = lerp(1, 5, n) * (1.25 - d);
    const gg = lerp(6, 18, n) * (1.18 - d);
    const b = lerp(12, 30, 1 - k) * (1.12 - d * 0.55);
    g.fill(r, gg, b);
    g.rect(0, y, w, step + 1);
  }
  g.fill(1, 5, 10, 70 * d);
  g.rect(0, 0, w, h);
}

function fittedImageRect(img, w, h, s) {
  const fit = s.bgFit;
  const scale = s.bgScale;
  let dw;
  let dh;
  if (fit === "stretch") {
    dw = w * scale;
    dh = h * scale;
  } else {
    const ir = img.width / img.height;
    const cr = w / h;
    if (fit === "cover") {
      if (ir > cr) {
        dh = h * scale;
        dw = dh * ir;
      } else {
        dw = w * scale;
        dh = dw / ir;
      }
    } else if (ir > cr) {
      dw = w * scale;
      dh = dw / ir;
    } else {
      dh = h * scale;
      dw = dh * ir;
    }
  }
  return {
    dw,
    dh,
    dx: (w - dw) * s.bgX,
    dy: (h - dh) * s.bgY
  };
}

function drawBackground(g, w, h, useBlur) {
  drawProceduralBg(g, w, h);
  const img = appState.backgroundImage;
  if (!img) return;
  const s = appState.sharedSettings;
  const rect = fittedImageRect(img, w, h, s);
  if (useBlur && s.bgBlur > 0.2) {
    if (!bgBlurTmp || bgBlurTmp.width !== w || bgBlurTmp.height !== h) {
      if (bgBlurTmp) bgBlurTmp.remove();
      bgBlurTmp = createGraphics(w, h);
      bgBlurTmp.pixelDensity(1);
    }
    bgBlurTmp.clear();
    bgBlurTmp.tint(255 * s.bgBrightness, s.bgAlpha * 255);
    bgBlurTmp.image(img, rect.dx, rect.dy, rect.dw, rect.dh);
    bgBlurTmp.noTint();
    bgBlurTmp.filter(BLUR, s.bgBlur);
    g.image(bgBlurTmp, 0, 0);
  } else {
    g.tint(255 * s.bgBrightness, s.bgAlpha * 255);
    g.image(img, rect.dx, rect.dy, rect.dw, rect.dh);
    g.noTint();
  }
  g.fill(2, 10, 22, s.bgMask * 220);
  g.noStroke();
  g.rect(0, 0, w, h);
}

function composeBg() {
  bgDirty = false;
  if (!bgLayer) {
    bgLayer = createGraphics(BASE_W, BASE_H);
    bgLayer.pixelDensity(1);
  }
  bgLayer.clear();
  drawBackground(bgLayer, BASE_W, BASE_H, true);
}

function drawWater(g) {
  const amt = appState.sharedSettings.water;
  if (amt < 0.01) return;
  for (let i = 0; i < waterWakes.length; i++) waterWakes[i].display(g);
  if (!waterBow || waterBow.life < 0.04) return;
  const a = waterBow.life * amt;
  const sn = constrain(waterBow.speed / 18, 0.12, 1.25);
  g.push();
  g.translate(waterBow.x, waterBow.y);
  g.rotate(waterBow.heading);
  g.noStroke();
  g.fill(6, 18, 32, a * 78);
  g.ellipse(6, 0, 26 + sn * 24, 9 + sn * 5);
  g.noFill();
  g.stroke(198, 232, 248, a * 150);
  g.strokeWeight(1.25);
  g.ellipse(-1, 0, 16 + sn * 12, 6.5 + sn * 3.2);
  g.stroke(255, 255, 255, a * 55);
  g.strokeWeight(0.7);
  g.arc(0, 0, 22 + sn * 10, 8 + sn * 3, -0.7, 0.7);
  g.pop();
}

function drawGrain(g) {
  if (!grainLayers.length) return;
  const a = appState.sharedSettings.grain * 90;
  if (a < 1) return;
  g.tint(255, a);
  g.image(grainLayers[(frameCount >> 3) & 3], 0, 0, BASE_W, BASE_H);
  g.noTint();
}

function drawPatternPreview(g) {
  const img = appState.patternImage;
  if (!img) return;
  const box = patternBox();
  const s = appState.patternSettings;
  const ctx = (g && g.drawingContext) || drawingContext;
  ctx.save();
  ctx.globalAlpha = 0.07;
  g.push();
  g.translate(box.cx, box.cy);
  g.rotate((s.rotation * Math.PI) / 180);
  g.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1);
  g.tint(160, 200, 220);
  g.image(img, -box.w / 2, -box.h / 2, box.w, box.h);
  g.noTint();
  g.pop();
  ctx.restore();
}

function drawForeground(g, exporting) {
  microBudget = 280;
  if (!exporting && appState.mode === "pattern" && appState.patternSettings.showPreview) {
    drawPatternPreview(g);
  }
  g.blendMode(ADD);
  if (appState.mode === "free") {
    for (let i = 0; i < freeParticles.length; i++) freeParticles[i].display(g);
  } else if (appState.mode === "body") {
    for (let i = 0; i < bodyParticles.length; i++) bodyParticles[i].display(g);
  } else {
    for (let i = 0; i < patternParticles.length; i++) patternParticles[i].display(g);
  }
  for (let i = 0; i < sparkles.length; i++) sparkles[i].display(g);
  g.blendMode(BLEND);
  if (appState.sharedSettings.showNoise) drawGrain(g);
}

function drawScene(g, exporting) {
  if (g) g.image(bgLayer, 0, 0);
  else image(bgLayer, 0, 0);
  drawForeground(g || window, exporting);
}

function cursorX() {
  return useDomPointer ? pointerX : mouseX;
}

function cursorY() {
  return useDomPointer ? pointerY : mouseY;
}

function cursorPX() {
  return useDomPointer ? pointerPX : pmouseX;
}

function cursorPY() {
  return useDomPointer ? pointerPY : pmouseY;
}

function onCanvas() {
  if (handPointerActive) return true;
  if (panelHover) return false;
  if (useDomPointer) return pointerInside;
  return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}

function pointerToSketch(ev) {
  if (!canvasElt) return null;
  const r = canvasElt.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const x = ((ev.clientX - r.left) * width) / r.width;
  const y = ((ev.clientY - r.top) * height) / r.height;
  if (x < -2 || y < -2 || x > width + 2 || y > height + 2) return null;
  return { x: constrain(x, 0, width), y: constrain(y, 0, height) };
}

function addTrail(x, y, speed) {
  const dens =
    appState.mode === "free"
      ? appState.freeSettings.trailDensity
      : appState.mode === "body"
        ? appState.bodySettings.trailDensity
        : 0.62;
  const minStep = lerp(8, 2.4, dens);
  if (lastTrail && dist(lastTrail.x, lastTrail.y, x, y) < minStep) return;
  const mouseR =
    (appState.mode === "free"
      ? appState.freeSettings.mouseRadius
      : appState.mode === "body"
        ? appState.bodySettings.mouseRadius
        : appState.patternSettings.spread) / viewZoom;
  trailPoints.push({
    x,
    y,
    speedN: constrain(speed / 16, 0.2, 1.4),
    radius: constrain(map(speed, 0, 40, mouseR * 0.5, mouseR * 0.82), mouseR * 0.45, mouseR * 0.9),
    life: 1
  });
  lastTrail = { x, y };
  if (trailPoints.length > 140) trailPoints.shift();
}

function addTrailAlong(x0, y0, x1, y1, speed) {
  const dens =
    appState.mode === "free"
      ? appState.freeSettings.trailDensity
      : appState.mode === "body"
        ? appState.bodySettings.trailDensity
        : 0.62;
  const minStep = lerp(8, 2.4, dens);
  const gap = dist(x0, y0, x1, y1);
  const n = Math.max(1, Math.ceil(gap / Math.max(2.2, minStep)));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    addTrail(lerp(x0, x1, t), lerp(y0, y1, t), speed);
  }
}

function clearGlow() {
  for (let i = 0; i < freeParticles.length; i++) {
    freeParticles[i].activation = 0;
    freeParticles[i].brightness = 0;
  }
  for (let i = 0; i < patternParticles.length; i++) {
    patternParticles[i].activation = 0;
    patternParticles[i].memory = 0;
    patternParticles[i].pending = 0;
    patternParticles[i].delay = 0;
  }
  for (let i = 0; i < bodyParticles.length; i++) {
    bodyParticles[i].activation = 0;
    bodyParticles[i].brightness = 0;
  }
  trailPoints.length = 0;
  lastTrail = null;
  previewBurst = 0;
}

function handlePointer(dragging) {
  handlePointerAt(cursorX(), cursorY(), cursorPX(), cursorPY(), dragging);
}

function handlePointerAt(x, y, px, py, dragging) {
  if (!onCanvas()) return;
  const w = toWorld(x, y);
  const wp = toWorld(px, py);
  const screenD = dist(x, y, px, py);
  mouseSpeed = Math.max(mouseSpeed * 0.5, screenD);
  if (screenD > 0.04 || dragging || pointerPressed || mouseIsPressed) {
    addTrailAlong(wp.x, wp.y, w.x, w.y, mouseSpeed * (dragging || pointerPressed || mouseIsPressed ? 1.25 : 1));
    if (mouseSpeed > 7 && sparkles.length < 60 && Math.random() < 0.4) {
      sparkles.push(new Sparkle(w.x, w.y));
    }
  }
}

function spawnWaterPacket(x, y, speed, heading, press) {
  const sn = constrain(speed / 22, 0, 1.45);
  waterWakes.push(new WaterWake(x, y, heading, sn + (press ? 0.28 : 0), 0));
  if (sn > 0.2) {
    const side = lerp(8, 22, constrain(sn, 0, 1));
    const ox = Math.cos(heading + Math.PI / 2) * side;
    const oy = Math.sin(heading + Math.PI / 2) * side;
    waterWakes.push(new WaterWake(x + ox, y + oy, heading, sn * 0.78, 1));
    waterWakes.push(new WaterWake(x - ox, y - oy, heading, sn * 0.78, 1));
  }
  while (waterWakes.length > 64) waterWakes.shift();
}

function maybeSpawnWaterWake(x, y, speed, heading, force) {
  return;
}

function spawnRipple(x, y, strength) {
  return;
}

function activateFree() {
  const fs = appState.freeSettings;
  const wm = toWorld(cursorX(), cursorY());
  const wmp = toWorld(cursorPX(), cursorPY());
  const radius = (fs.mouseRadius * lerp(0.92, 1.06, constrain(mouseSpeed / 22, 0, 1))) / viewZoom;
  grid.configure(BASE_W, BASE_H, Math.max(48, radius * 0.7));
  grid.clear();
  for (let i = 0; i < freeParticles.length; i++) grid.insert(freeParticles[i]);
  const speedN = constrain((mouseSpeed / 14) * fs.speedSense, 0.55, 1.6);
  const press = mouseIsPressed || pointerPressed ? 1.25 : 1;
  const energy = new Map();

  const addHit = (p, glow, fx, fy) => {
    let rec = energy.get(p);
    if (!rec) {
      rec = { best: 0, fx: 0, fy: 0 };
      energy.set(p, rec);
    }
    if (glow > rec.best) rec.best = glow;
    rec.fx += fx;
    rec.fy += fy;
  };

  const stamp = (cx, cy, r, sn, withForce) => {
    let hits = 0;
    grid.query(cx, cy, r * 1.45, queryBuf);
    for (let i = 0; i < queryBuf.length; i++) {
      const p = queryBuf[i];
      const d = dist(p.position.x, p.position.y, cx, cy);
      if (d >= r || d < 0.0001) continue;
      hits += 1;
      const fall = 1 - d / r;
      const soft = fall * fall;
      const glow = soft * sn * (withForce ? press : 1);
      let fx = 0;
      let fy = 0;
      if (withForce) {
        const nx = (p.position.x - cx) / d;
        const ny = (p.position.y - cy) / d;
        const tx = -ny;
        const ty = nx;
        const mdx = wm.x - wmp.x;
        const mdy = wm.y - wmp.y;
        fx += mdx * 0.012 * fs.disturbance * soft;
        fy += mdy * 0.012 * fs.disturbance * soft;
        fx += tx * fs.vortex * 0.08 * soft * sn;
        fy += ty * fs.vortex * 0.08 * soft * sn;
        fx += nx * fs.disturbance * 0.04 * soft;
        fy += ny * fs.disturbance * 0.04 * soft;
      }
      addHit(p, glow, fx, fy);
    }
    return hits;
  };

  if (onCanvas()) {
    const gap = dist(wm.x, wm.y, wmp.x, wmp.y);
    const step = Math.max(4, radius * 0.2);
    const n = Math.max(1, Math.ceil(gap / step));
    let cursorHits = 0;
    for (let s = 0; s <= n; s++) {
      const t = n === 0 ? 1 : s / n;
      const sx = lerp(wmp.x, wm.x, t);
      const sy = lerp(wmp.y, wm.y, t);
      const hits = stamp(sx, sy, radius, speedN, s === n);
      if (s === n) cursorHits = hits;
    }
    if (cursorHits < 2 && mouseSpeed > 0.04 && freeParticles.length < fs.count + 280) {
      const extra = 5;
      for (let i = 0; i < extra; i++) {
        const p = new Particle(
          constrain(wm.x + randomGaussian(0, radius * 0.28), 0, BASE_W),
          constrain(wm.y + randomGaussian(0, radius * 0.28), 0, BASE_H)
        );
        freeParticles.push(p);
        grid.insert(p);
        p.activate(0.42);
      }
    }
  }

  for (let t = 0; t < trailPoints.length; t++) {
    const tr = trailPoints[t];
    stamp(tr.x, tr.y, tr.radius, tr.speedN * tr.life * 0.9, false);
  }

  energy.forEach((rec, p) => {
    if (rec.best <= 0.004) return;
    p.activate(rec.best * lerp(0.72, 1, p.depth));
    p.acceleration.x += rec.fx * lerp(0.55, 1.1, p.depth);
    p.acceleration.y += rec.fy * lerp(0.55, 1.1, p.depth);
  });
}

function activatePattern() {
  const ps = appState.patternSettings;
  const wm = toWorld(cursorX(), cursorY());
  const wmp = toWorld(cursorPX(), cursorPY());
  const spread = ps.spread / viewZoom;
  grid.configure(BASE_W, BASE_H, Math.max(40, spread * 0.65));
  grid.clear();
  for (let i = 0; i < patternParticles.length; i++) grid.insert(patternParticles[i]);

  const speedN = constrain(mouseSpeed / 14, 0.5, 1.35);
  const press = mouseIsPressed || pointerPressed ? 1.2 : 1;
  const energy = new Map();

  const addEnergy = (p, amount) => {
    const prev = energy.get(p) || 0;
    if (amount > prev) energy.set(p, amount);
  };

  if (onCanvas()) {
    const gap = dist(wm.x, wm.y, wmp.x, wmp.y);
    const step = Math.max(4, spread * 0.2);
    const n = Math.max(1, Math.ceil(gap / step));
    for (let s = 0; s <= n; s++) {
      const t = n === 0 ? 1 : s / n;
      const sx = lerp(wmp.x, wm.x, t);
      const sy = lerp(wmp.y, wm.y, t);
      grid.query(sx, sy, spread * 1.65, queryBuf);
      for (let i = 0; i < queryBuf.length; i++) {
        const p = queryBuf[i];
        const d = dist(p.position.x, p.position.y, sx, sy);
        if (d < spread) {
          const fall = 1 - d / spread;
          addEnergy(p, fall * fall * speedN * press);
        }
      }
    }
  }

  for (let t = 0; t < trailPoints.length; t++) {
    const tr = trailPoints[t];
    grid.query(tr.x, tr.y, tr.radius, queryBuf);
    for (let i = 0; i < queryBuf.length; i++) {
      const p = queryBuf[i];
      const d2 = dist(p.position.x, p.position.y, tr.x, tr.y);
      if (d2 < tr.radius) {
        const fall = 1 - d2 / tr.radius;
        addEnergy(p, fall * fall * tr.speedN * tr.life * 0.9);
      }
    }
  }

  energy.forEach((best, p) => {
    if (best <= 0.004) return;
    const delay = (1 - best) * ps.wakeDelay * 48 + random(1, 7);
    p.queueActivate(best * lerp(0.55, 1.15, p.sourceWeight), delay);
    const d = dist(p.position.x, p.position.y, wm.x, wm.y);
    if (d > 0.001 && onCanvas()) {
      const nx = (p.position.x - wm.x) / Math.max(d, 1);
      const ny = (p.position.y - wm.y) / Math.max(d, 1);
      p.acceleration.x += nx * ps.nudge * best * 0.28;
      p.acceleration.y += ny * ps.nudge * best * 0.28;
      p.acceleration.x += (wm.x - wmp.x) * 0.008 * ps.nudge * best;
      p.acceleration.y += (wm.y - wmp.y) * 0.008 * ps.nudge * best;
    }
  });
}

function activateBody() {
  const bs = appState.bodySettings;
  const wm = toWorld(cursorX(), cursorY());
  const wmp = toWorld(cursorPX(), cursorPY());
  const radius = (bs.mouseRadius * lerp(0.92, 1.06, constrain(mouseSpeed / 22, 0, 1))) / viewZoom;
  grid.configure(BASE_W, BASE_H, Math.max(48, radius * 0.7));
  grid.clear();
  for (let i = 0; i < bodyParticles.length; i++) grid.insert(bodyParticles[i]);
  const speedN = constrain((mouseSpeed / 14) * bs.speedSense, 0.55, 1.6);
  const press = mouseIsPressed || pointerPressed ? 1.25 : 1;
  const energy = new Map();

  const addHit = (p, glow, fx, fy) => {
    let rec = energy.get(p);
    if (!rec) {
      rec = { best: 0, fx: 0, fy: 0 };
      energy.set(p, rec);
    }
    if (glow > rec.best) rec.best = glow;
    rec.fx += fx;
    rec.fy += fy;
  };

  const stamp = (cx, cy, r, sn, withForce) => {
    let hits = 0;
    grid.query(cx, cy, r * 1.55, queryBuf);
    for (let i = 0; i < queryBuf.length; i++) {
      const p = queryBuf[i];
      const d = dist(p.position.x, p.position.y, cx, cy);
      const rHit = r * 1.22;
      if (d >= rHit || d < 0.0001) continue;
      hits += 1;
      const fall = 1 - d / rHit;
      const soft = Math.pow(fall, 0.72);
      const glow = soft * sn * (withForce ? press : 1);
      let fx = 0;
      let fy = 0;
      if (withForce && !(p.activation > 0.05 && bodyFound)) {
        const nx = (p.position.x - cx) / d;
        const ny = (p.position.y - cy) / d;
        const tx = -ny;
        const ty = nx;
        const mdx = wm.x - wmp.x;
        const mdy = wm.y - wmp.y;
        fx += mdx * 0.012 * bs.disturbance * soft;
        fy += mdy * 0.012 * bs.disturbance * soft;
        fx += tx * bs.vortex * 0.08 * soft * sn;
        fy += ty * bs.vortex * 0.08 * soft * sn;
        fx += nx * bs.disturbance * 0.04 * soft;
        fy += ny * bs.disturbance * 0.04 * soft;
      }
      addHit(p, glow, fx, fy);
    }
    return hits;
  };

  if (onCanvas()) {
    const gap = dist(wm.x, wm.y, wmp.x, wmp.y);
    const step = Math.max(3.2, radius * 0.16);
    const n = Math.max(1, Math.ceil(gap / step));
    const cap = bodyParticleCap();
    let spawned = 0;
    for (let s = 0; s <= n; s++) {
      const t = n === 0 ? 1 : s / n;
      const sx = lerp(wmp.x, wm.x, t);
      const sy = lerp(wmp.y, wm.y, t);
      stamp(sx, sy, radius, speedN, s === n);
    }
    const drawing = mouseSpeed > 0.04 || mouseIsPressed || pointerPressed;
    if (drawing && bodyFound && !silhouetteIsFilled()) {
      const burst = 18 + Math.round(bs.trailDensity * 28);
      spawned += seedBodyGlow(wm.x, wm.y, radius, burst);
    } else if (drawing && spawned === 0) {
      const want = 6 + Math.round(bs.trailDensity * 8);
      const hitsNear = stamp(wm.x, wm.y, radius, speedN, false);
      if (hitsNear < want && bodyParticles.length < cap) {
        spawned += seedBodyGlow(wm.x, wm.y, radius, Math.min(want - hitsNear + 8, 24));
        if (!bodyFound) {
          for (let i = spawned; i < Math.min(want, 12) && bodyParticles.length < cap; i++) {
            const p = new BodyParticle(
              constrain(wm.x + randomGaussian(0, radius * 0.32), 0, BASE_W),
              constrain(wm.y + randomGaussian(0, radius * 0.32), 0, BASE_H)
            );
            p.slot = bodyParticles.length;
            p.activate(0.55);
            bodyParticles.push(p);
            grid.insert(p);
          }
        }
      }
    }
  }

  for (let t = 0; t < trailPoints.length; t++) {
    const tr = trailPoints[t];
    stamp(tr.x, tr.y, tr.radius, tr.speedN * tr.life * 0.9, false);
  }

  energy.forEach((rec, p) => {
    if (rec.best <= 0.004) return;
    p.activate(rec.best * lerp(0.88, 1.12, p.depth));
    p.acceleration.x += rec.fx * lerp(0.55, 1.1, p.depth);
    p.acceleration.y += rec.fy * lerp(0.55, 1.1, p.depth);
  });
}

function updateSim() {
  if (onCanvas()) {
    const d = dist(cursorX(), cursorY(), cursorPX(), cursorPY());
    mouseSpeed = Math.max(mouseSpeed * 0.72, d);
  } else {
    mouseSpeed *= 0.8;
  }

  for (let i = trailPoints.length - 1; i >= 0; i--) {
    const dec =
      appState.mode === "free"
        ? appState.freeSettings.decay
        : appState.mode === "body"
          ? appState.bodySettings.decay
          : patternTraceDecay();
    trailPoints[i].life -= dec > 0.005 ? lerp(0.012, 0.06, constrain(dec, 0, 1)) : 0.03;
    if (trailPoints[i].life <= 0) trailPoints.splice(i, 1);
  }
  if (!trailPoints.length) lastTrail = null;

  for (let i = rippleEffects.length - 1; i >= 0; i--) {
    rippleEffects[i].update();
    if (!rippleEffects[i].alive) rippleEffects.splice(i, 1);
  }

  for (let i = waterWakes.length - 1; i >= 0; i--) {
    waterWakes[i].update();
    if (!waterWakes[i].alive) waterWakes.splice(i, 1);
  }
  if (waterBow) {
    waterBow.life *= onCanvas() && mouseSpeed > 0.6 ? 0.94 : 0.86;
    if (waterBow.life < 0.04) waterBow = null;
  }
  if (!onCanvas()) lastWaterPt = null;

  if (appState.mode === "body") {
    if (onCanvas() || trailPoints.length) activateBody();
    gatherBody();
    settleBodyGlow();
    for (let i = 0; i < bodyParticles.length; i++) bodyParticles[i].update();
    restockBodySea();
  } else if (onCanvas() || rippleEffects.length || trailPoints.length) {
    if (appState.mode === "free") activateFree();
    else activatePattern();
  }

  if (appState.mode === "free") {
    for (let i = 0; i < freeParticles.length; i++) freeParticles[i].update();
  } else if (appState.mode === "pattern") {
    for (let i = 0; i < patternParticles.length; i++) patternParticles[i].update();
  }

  for (let i = sparkles.length - 1; i >= 0; i--) {
    sparkles[i].update();
    if (sparkles[i].life <= 0) sparkles.splice(i, 1);
  }

  if (previewBurst > 0 && patternFadeRate() > 0) {
    previewBurst = Math.max(0, previewBurst - Math.max(0.0064, patternFadeRate()));
  }
  if (memoryFade > 0) memoryFade = Math.max(0, memoryFade - 0.016);

  if (stillnessHold > 0) {
    stillnessHold -= 1;
    stillness = Math.min(1, stillness + 0.08);
  } else if (mouseSpeed < 0.7 && !pointerPressed && !mouseIsPressed) {
    stillness = Math.min(1, stillness + 0.022);
  } else {
    stillness = Math.max(0, stillness * 0.8);
  }
}

function setup() {
  try {
    const c = createCanvas(BASE_W, BASE_H);
    c.parent("canvas-holder");
    canvasElt = c.elt;
    canvasElt.setAttribute("tabindex", "0");
    canvasElt.setAttribute("role", "application");
    pixelDensity(1);
    frameRate(60);
    colorMode(RGB, 255);
    noiseDetail(3, 0.5);
    grid = new SpatialGrid();
    grid.configure(BASE_W, BASE_H, 80);
    makeGrain();
    composeBg();
    spawnFreeParticles();
    spawnBodyParticles();
    bindUI();
    bindCanvasPointer();
    syncFormFromState();
    updatePatternHint();
    focusArtwork();
    const badge = document.getElementById("zoom-badge");
    if (badge) badge.textContent = "×1.0";
  } catch (err) {
    console.error(err);
    const el = document.getElementById("toast");
    if (el) {
      el.hidden = false;
      el.textContent = t("err.setup", { err: err && err.message ? err.message : err });
    }
  }
}

function draw() {
  try {
    if (bgDirty) composeBg();
    if (!paused) updateSim();
    push();
    applyView();
    if (bgLayer) image(bgLayer, 0, 0);
    drawForeground(window, false);
    pop();
  } catch (err) {
    console.error(err);
    const el = document.getElementById("toast");
    if (el) {
      el.hidden = false;
      el.textContent = t("err.draw", { err: err && err.message ? err.message : err });
    }
    return;
  }

  const fpsEl = document.getElementById("fps-badge");
  if (!fpsEl) return;
  if (appState.sharedSettings.showFps) {
    fpsEl.hidden = false;
    if (frameCount % 10 === 0) fpsEl.textContent = "FPS " + nf(frameRate(), 2, 0);
  } else {
    fpsEl.hidden = true;
  }
}

function mouseMoved() {
  if (useDomPointer) return;
  handlePointer(false);
}

function mouseDragged() {
  if (useDomPointer) return;
  handlePointer(true);
}

function mousePressed() {
  if (useDomPointer) return;
  if (!onCanvas()) return;
  spawnRipple(toWorld(cursorX(), cursorY()).x, toWorld(cursorX(), cursorY()).y, 0.75);
}

function touchMoved() {
  if (useDomPointer) return false;
  if (!onCanvas()) return true;
  handlePointer(true);
  return false;
}

function touchStarted() {
  if (useDomPointer) return false;
  if (!onCanvas()) return true;
  spawnRipple(toWorld(cursorX(), cursorY()).x, toWorld(cursorX(), cursorY()).y, 0.6);
  return false;
}

function applyCameraPointer(nx, ny, pressed) {
  if (appState.mode !== "body") return;
  if (typeof width !== "number" || width < 2) return;
  const x = constrain(nx * width, 0, width);
  const y = constrain(ny * height, 0, height);
  const was = handPointerActive;
  handPointerActive = true;
  if (!was) {
    pointerPX = x;
    pointerPY = y;
  } else {
    pointerPX = pointerX;
    pointerPY = pointerY;
  }
  pointerX = x;
  pointerY = y;
  pointerInside = true;
  const pinchNow = !!pressed;
  if (pinchNow && !pointerPressed) {
    const wpt = toWorld(pointerX, pointerY);
    spawnRipple(wpt.x, wpt.y, 0.75);
    maybeSpawnWaterWake(wpt.x, wpt.y, Math.max(mouseSpeed, 9), waterBow ? waterBow.heading : 0, true);
  }
  pointerPressed = pinchNow;
  handlePointerAt(pointerX, pointerY, pointerPX, pointerPY, pinchNow);
}

function releaseCameraPointer() {
  if (!handPointerActive) return;
  handPointerActive = false;
  pointerPressed = false;
  pointerInside = false;
}

function syncHandCamUi() {
  const btn = document.getElementById("btn-handcam");
  const status = document.getElementById("hand-cam-status");
  const wrap = document.getElementById("hand-preview-wrap");
  const on = typeof HandCam !== "undefined" && HandCam.isOn();
  if (btn) btn.textContent = on ? t("hand.stop") : t("hand.start");
  if (status) status.textContent = t(handStatusKey);
  if (wrap) wrap.hidden = !on;
  if (appState.mode === "body") updatePatternHint();
}

function bindCanvasPointer() {
  const frame = document.querySelector(".canvas-frame");
  if (!frame) return;
  useDomPointer = true;
  const cap = { capture: true };
  const onMove = (ev) => {
    if (handPointerActive) return;
    if (panelHover) {
      pointerInside = false;
      return;
    }
    if (ev.target && ev.target.closest && ev.target.closest(".fs-btn")) return;
    const p = pointerToSketch(ev);
    if (!p) {
      pointerInside = false;
      return;
    }
    if (!pointerInside) {
      pointerPX = p.x;
      pointerPY = p.y;
    } else {
      pointerPX = pointerX;
      pointerPY = pointerY;
    }
    pointerX = p.x;
    pointerY = p.y;
    pointerInside = true;
    handlePointerAt(pointerX, pointerY, pointerPX, pointerPY, pointerPressed || ev.buttons === 1);
  };
  frame.addEventListener("pointermove", onMove, cap);
  frame.addEventListener(
    "pointerdown",
    (ev) => {
      if (handPointerActive) return;
      if (panelHover) return;
      if (ev.target && ev.target.closest && ev.target.closest(".fs-btn")) return;
      if (ev.target && ev.target.closest && ev.target.closest("#capture-hud")) return;
      const p = pointerToSketch(ev);
      if (!p) return;
      pointerPressed = true;
      pointerInside = true;
      pointerX = p.x;
      pointerY = p.y;
      pointerPX = p.x;
      pointerPY = p.y;
      spawnRipple(toWorld(p.x, p.y).x, toWorld(p.x, p.y).y, 0.75);
      maybeSpawnWaterWake(toWorld(p.x, p.y).x, toWorld(p.x, p.y).y, Math.max(mouseSpeed, 9), waterBow ? waterBow.heading : 0, true);
      focusArtwork();
      handlePointerAt(p.x, p.y, p.x, p.y, true);
      const target = canvasElt || frame;
      try {
        target.setPointerCapture(ev.pointerId);
      } catch (err) {
        /* ignore */
      }
    },
    cap
  );
  const endPointer = () => {
    if (handPointerActive) return;
    pointerPressed = false;
  };
  frame.addEventListener("pointerup", endPointer, cap);
  frame.addEventListener("pointercancel", endPointer, cap);
  frame.addEventListener("pointerleave", () => {
    if (handPointerActive) return;
    pointerInside = false;
    pointerPressed = false;
  });
  frame.addEventListener(
    "wheel",
    (ev) => {
      if (panelHover) return;
      ev.preventDefault();
      const p = pointerToSketch(ev);
      if (!p) return;
      stillnessHold = 10;
      const factor = ev.deltaY > 0 ? 1 / 1.12 : 1.12;
      setZoom(viewZoom * factor, p.x, p.y);
    },
    { capture: true, passive: false }
  );
}

function isTypingTarget(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  if (tag !== "INPUT") return false;
  const type = (el.type || "text").toLowerCase();
  return type === "text" || type === "search" || type === "password" || type === "email" || type === "url" || type === "number";
}

function isSpaceEvent(ev) {
  if (!ev) return false;
  return (
    ev.code === "Space" ||
    ev.key === " " ||
    ev.key === "Spacebar" ||
    ev.keyCode === 32 ||
    ev.which === 32
  );
}

function handleSpaceKey(ev) {
  if (ev && !isSpaceEvent(ev)) return;
  if (reviewOpen) return;
  if (ev && isTypingTarget(ev.target)) return;
  if (ev) ev.preventDefault();
  if (ev && ev.repeat) return;
  captureFrame();
}

function keyPressed() {
  if (keyCode === 32) {
    handleSpaceKey();
    return false;
  }
}

function keyReleased() {
  if (keyCode === 32) return false;
}

function focusArtwork() {
  const frame = document.querySelector(".canvas-frame");
  if (canvasElt) canvasElt.setAttribute("tabindex", "0");
  if (!frame) return;
  frame.setAttribute("tabindex", "0");
  try {
    frame.focus({ preventScroll: true });
  } catch (err) {
    try {
      frame.focus();
    } catch (err2) {
      /* ignore */
    }
  }
}

function bindPath(el) {
  const parts = el.getAttribute("data-bind").split(".");
  return { obj: appState[parts[0]], key: parts[1] };
}

function writeBind(el) {
  const { obj, key } = bindPath(el);
  if (el.type === "checkbox") obj[key] = el.checked;
  else if (el.type === "range") obj[key] = parseFloat(el.value);
  else obj[key] = el.value;
}

function fmtVal(v) {
  if (typeof v !== "number") return v;
  if (Math.abs(v - Math.round(v)) < 1e-6) return String(Math.round(v));
  if (Math.abs(v) >= 10) return v.toFixed(1);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

function updateValLabels() {
  document.querySelectorAll("[data-val]").forEach((el) => {
    const parts = el.getAttribute("data-val").split(".");
    el.textContent = fmtVal(appState[parts[0]][parts[1]]);
  });
}

function syncFormFromState() {
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const { obj, key } = bindPath(el);
    const val = obj[key];
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val;
  });
  updateValLabels();
}

function afterControl(el) {
  const rebuild = el.getAttribute("data-rebuild");
  const layout = el.getAttribute("data-layout");
  if (rebuild === "free") {
    clearTimeout(rebuildFreeTimer);
    rebuildFreeTimer = setTimeout(spawnFreeParticles, 140);
  }
  if (rebuild === "body") {
    clearTimeout(rebuildBodyTimer);
    rebuildBodyTimer = setTimeout(spawnBodyParticles, 140);
  }
  if (rebuild === "pattern") {
    clearTimeout(rebuildPatternTimer);
    rebuildPatternTimer = setTimeout(samplePattern, 160);
  }
  if (layout === "pattern") refreshPatternLayout();
  if (layout === "bg") bgDirty = true;
  if (el.getAttribute("data-camera") === "zoom") {
    setZoom(appState.sharedSettings.zoom, width / 2, height / 2);
  }
}

function bindUI() {
  const panel = document.getElementById("panel");
  panel.addEventListener("pointerenter", () => {
    panelHover = true;
  });
  panel.addEventListener("pointerleave", () => {
    panelHover = false;
  });

  document.querySelectorAll("[data-bind]").forEach((el) => {
    const apply = () => {
      writeBind(el);
      updateValLabels();
      afterControl(el);
    };
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });

  document.getElementById("mode-free").addEventListener("click", () => setMode("free"));
  document.getElementById("mode-pattern").addEventListener("click", () => setMode("pattern"));
  document.getElementById("mode-body").addEventListener("click", () => setMode("body"));

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      Object.assign(appState.freeSettings, clone(PRESETS[btn.getAttribute("data-preset")]));
      syncFormFromState();
      spawnFreeParticles();
    });
  });

  document.getElementById("bg-file").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    readImageFile(file, (img) => {
      appState.backgroundImage = img;
      bgDirty = true;
      updatePatternHint();
      if (appState.mode === "pattern" && !appState.patternImage) {
        toast(t("toast.bgNotPattern"));
      }
    });
  });
  document.getElementById("bg-remove").addEventListener("click", () => {
    appState.backgroundImage = null;
    bgDirty = true;
    updatePatternHint();
  });

  document.getElementById("pattern-file").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    readImageFile(file, (img) => {
      appState.patternImage = img;
      samplePattern();
    });
  });
  document.getElementById("pattern-remove").addEventListener("click", () => {
    appState.patternImage = null;
    patternParticles.length = 0;
    if (patternSampleGfx) {
      patternSampleGfx.remove();
      patternSampleGfx = null;
    }
    updatePatternHint();
  });

  document.getElementById("pattern-preview-all").addEventListener("click", () => {
    previewBurst = 1;
    for (let i = 0; i < patternParticles.length; i++) {
      patternParticles[i].activation = 1;
      patternParticles[i].memory = 1;
      patternParticles[i].pending = 0;
      patternParticles[i].delay = 0;
    }
  });
  document.getElementById("pattern-clear-memory").addEventListener("click", () => {
    memoryFade = 1;
    previewBurst = 0;
  });

  const pauseBtn = document.getElementById("btn-pause");
  const syncPauseUi = () => {
    pauseBtn.textContent = paused ? t("feat.resume") : t("feat.pause");
  };
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    syncPauseUi();
    if (!paused) loop();
  });
  syncPauseUi();

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (appState.mode === "free") {
      appState.freeSettings = clone(FREE_DEFAULTS);
      spawnFreeParticles();
    } else if (appState.mode === "body") {
      appState.bodySettings = clone(BODY_DEFAULTS);
      spawnBodyParticles();
    } else {
      appState.patternSettings = clone(PATTERN_DEFAULTS);
      if (appState.patternImage) samplePattern();
    }
    syncFormFromState();
  });

  const clearGlowBtn = document.getElementById("btn-clear-glow");
  if (clearGlowBtn) clearGlowBtn.addEventListener("click", clearGlow);

  document.getElementById("btn-random").addEventListener("click", () => {
    const root =
      appState.mode === "free"
        ? document.getElementById("panel-free")
        : appState.mode === "body"
          ? document.getElementById("panel-body")
          : document.getElementById("panel-pattern");
    root.querySelectorAll("input[type=range][data-bind]").forEach((el) => {
      const min = parseFloat(el.min);
      const max = parseFloat(el.max);
      const step = parseFloat(el.step) || 1;
      let v = min + Math.random() * (max - min);
      v = Math.round(v / step) * step;
      el.value = String(v);
      writeBind(el);
    });
    updateValLabels();
    if (appState.mode === "free") spawnFreeParticles();
    else if (appState.mode === "body") spawnBodyParticles();
    else if (appState.patternImage) samplePattern();
  });

  document.getElementById("btn-export").addEventListener("click", exportPNG);
  bindCaptureUi();

  const handBtn = document.getElementById("btn-handcam");
  const handVideo = document.getElementById("hand-cam-preview");
  if (handBtn && typeof HandCam !== "undefined") {
    HandCam.setHandlers({
      onPoint: applyCameraPointer,
      onLost: releaseCameraPointer,
      onMask: ingestBodyMask,
      onStatus: (key) => {
        handStatusKey = key || "body.statusOff";
        syncHandCamUi();
      },
    });
    handBtn.addEventListener("click", async () => {
      try {
        if (HandCam.isOn()) {
          HandCam.stop();
        } else {
          await HandCam.start(handVideo);
        }
      } catch (err) {
        const name = err && err.name;
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          handStatusKey = "body.statusOff";
          toast(t("toast.handDenied"));
        } else if (err && String(err.message) === "file") {
          handStatusKey = "body.statusFile";
          toast(t("toast.handFile"));
        } else {
          handStatusKey = "body.statusOff";
          toast(t("toast.handFail"));
        }
      }
      syncHandCamUi();
    });
    syncHandCamUi();
  }

  document.getElementById("btn-collapse").addEventListener("click", () => {
    document.querySelector(".app").classList.add("is-collapsed");
    document.getElementById("btn-expand").hidden = false;
  });
  document.getElementById("btn-expand").addEventListener("click", () => {
    document.querySelector(".app").classList.remove("is-collapsed");
    document.getElementById("btn-expand").hidden = true;
  });

  const fsCanvasBtn = document.getElementById("btn-fullscreen");
  const fsPanelBtn = document.getElementById("btn-fullscreen-panel");
  const enterFullscreen = () => {
    const el = document.querySelector(".canvas-frame");
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) {
      toast(t("toast.fsUnsupported"));
      return;
    }
    const result = req.call(el);
    if (result && typeof result.catch === "function") {
      result.catch(() => toast(t("toast.fsFailed")));
    }
  };
  const exitFullscreen = () => {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) fn.call(document);
  };
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const syncFullscreenUi = () => {
    const on = isFullscreen();
    if (fsCanvasBtn) {
      fsCanvasBtn.textContent = t("fullscreen");
      fsCanvasBtn.setAttribute("aria-label", t("fullscreenAria"));
    }
    if (fsPanelBtn) fsPanelBtn.textContent = on ? t("fullscreenExit") : t("fullscreenPanel");
  };
  const toggleFullscreen = (ev) => {
    if (ev) ev.stopPropagation();
    if (isFullscreen()) exitFullscreen();
    else enterFullscreen();
  };
  if (fsCanvasBtn) {
    fsCanvasBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    fsCanvasBtn.addEventListener("click", toggleFullscreen);
  }
  if (fsPanelBtn) fsPanelBtn.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreenUi);
  document.addEventListener("webkitfullscreenchange", syncFullscreenUi);
  const onKey = (ev) => {
    if (ev.key === "Escape" && reviewOpen) {
      ev.preventDefault();
      closeReview();
      return;
    }
    if (ev.key === "f" || ev.key === "F") {
      if (isTypingTarget(ev.target) || reviewOpen) return;
      ev.preventDefault();
      toggleFullscreen();
    }
  };
  window.addEventListener("keydown", onKey, true);

  window.onLangChange = () => {
    updatePatternHint();
    syncPauseUi();
    syncFullscreenUi();
    syncHandCamUi();
    syncCaptureUi();
  };
  window.onLangChange();
}

function setMode(mode) {
  const prev = appState.mode;
  appState.mode = mode;
  document.getElementById("mode-free").classList.toggle("is-on", mode === "free");
  document.getElementById("mode-pattern").classList.toggle("is-on", mode === "pattern");
  const bodyBtn = document.getElementById("mode-body");
  if (bodyBtn) bodyBtn.classList.toggle("is-on", mode === "body");
  document.getElementById("panel-free").hidden = mode !== "free";
  document.getElementById("panel-pattern").hidden = mode !== "pattern";
  const bodyPanel = document.getElementById("panel-body");
  if (bodyPanel) bodyPanel.hidden = mode !== "body";
  trailPoints.length = 0;
  lastTrail = null;
  if (prev === "body" && mode !== "body") {
    if (typeof HandCam !== "undefined" && HandCam.isOn()) HandCam.stop();
    releaseCameraPointer();
    bodyFound = false;
    bodyHold = 0;
    bodyGatherAmt = 0;
    bodyMotion = 0;
    bodySoft = null;
  }
  if (mode === "body" && !bodyParticles.length) spawnBodyParticles();
  updatePatternHint();
  syncHandCamUi();
}

function updatePatternHint() {
  const hint = document.getElementById("pattern-hint");
  const text = document.getElementById("pattern-hint-text");
  const camOn = typeof HandCam !== "undefined" && HandCam.isOn();
  const showPattern = appState.mode === "pattern" && !appState.patternImage;
  const showBody = appState.mode === "body" && !camOn;
  const show = showPattern || showBody;
  hint.hidden = !show;
  hint.classList.toggle("is-on", show);
  if (text) {
    if (showBody) {
      text.textContent = t("hint.bodyCam");
    } else if (showPattern && appState.backgroundImage) {
      text.textContent = t("hint.bgNotPattern");
    } else {
      text.textContent = t("hint.uploadPattern");
    }
  }
  const bgNote = document.getElementById("bg-pattern-note");
  if (bgNote) bgNote.hidden = appState.mode !== "pattern";
  const status = document.getElementById("pattern-status");
  if (status) {
    if (!appState.patternImage) status.textContent = t("status.empty");
    else status.textContent = t("status.ready", { n: patternParticles.length });
  }
}

function readImageFile(file, onok) {
  if (!file) return;
  if (!file.type || !file.type.startsWith("image/")) {
    toast(t("toast.badFormat"));
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    toast(t("toast.tooLarge"));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => toast(t("toast.readFail"));
  reader.onload = () => {
    loadImage(
      reader.result,
      (img) => {
        if (!img || img.width < 2 || img.height < 2) {
          toast(t("toast.cantRead"));
          return;
        }
        if (img.width * img.height > 36e6) {
          toast(t("toast.imageTooBig"));
          return;
        }
        onok(img);
      },
      () => toast(t("toast.cantReadRetry"))
    );
  };
  reader.readAsDataURL(file);
}

function exportFileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `bioluminescent-tide-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

function renderCaptureFrame(pg, w, h) {
  pg.push();
  pg.translate(w / 2, h / 2);
  pg.scale((w / BASE_W) * viewZoom);
  pg.translate(-camX, -camY);
  if (bgLayer) pg.image(bgLayer, 0, 0);
  else drawBackground(pg, BASE_W, BASE_H, false);
  drawForeground(pg, true);
  pg.pop();
}

function flashCapture() {
  const el = document.getElementById("canvas-flash");
  if (!el) return;
  el.hidden = false;
  clearTimeout(flashCapture._t);
  flashCapture._t = setTimeout(() => {
    el.hidden = true;
  }, 160);
}

function captureFrame() {
  const now = Date.now();
  if (now < spaceCaptureLock) return;
  spaceCaptureLock = now + 320;
  if (reviewOpen) return;
  if (typeof createGraphics !== "function") {
    toast(t("err.setup", { err: "p5" }));
    return;
  }
  if (captures.length >= MAX_CAPTURES) {
    toast(t("toast.capturesFull"));
    return;
  }
  try {
    const pg = createGraphics(BASE_W, BASE_H);
    pg.pixelDensity(1);
    pg.colorMode(RGB, 255);
    renderCaptureFrame(pg, BASE_W, BASE_H);
    const canvas = pg.canvas || pg.elt;
    if (!canvas || typeof canvas.toDataURL !== "function") {
      pg.remove();
      throw new Error("canvas");
    }
    const dataUrl = canvas.toDataURL("image/png");
    pg.remove();
    captures.push({ dataUrl });
    selectedCapture = captures.length - 1;
    flashCapture();
    syncCaptureUi();
    toast(t("toast.captured", { n: captures.length, max: MAX_CAPTURES }));
  } catch (err) {
    console.error(err);
    toast(t("err.draw", { err: err && err.message ? err.message : err }));
  }
}

function fillThumbGrid(container, large) {
  if (!container) return;
  container.innerHTML = "";
  if (large && !captures.length) {
    const empty = document.createElement("p");
    empty.className = "review-empty";
    empty.textContent = t("capture.empty");
    container.appendChild(empty);
    return;
  }
  const count = large ? captures.length : MAX_CAPTURES;
  for (let i = 0; i < count; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = large ? "review-card" : "capture-slot";
    if (captures[i] && i === selectedCapture) btn.classList.add("is-on");
    if (!captures[i]) {
      btn.textContent = String(i + 1);
      btn.disabled = true;
    } else {
      const img = document.createElement("img");
      img.src = captures[i].dataUrl;
      img.alt = String(i + 1);
      btn.appendChild(img);
      if (large) {
        const num = document.createElement("span");
        num.className = "review-num";
        num.textContent = String(i + 1);
        btn.appendChild(num);
      }
      btn.addEventListener("click", () => {
        selectedCapture = i;
        syncCaptureUi();
      });
    }
    container.appendChild(btn);
  }
}

function syncCaptureUi() {
  const hud = document.getElementById("capture-hud");
  if (hud) hud.textContent = t("capture.hud", { n: captures.length, max: MAX_CAPTURES });
  const count = document.getElementById("capture-count");
  if (count) count.textContent = t("capture.count", { n: captures.length, max: MAX_CAPTURES });
  fillThumbGrid(document.getElementById("capture-thumbs"), false);
  if (reviewOpen) fillThumbGrid(document.getElementById("review-grid"), true);
  const exportBtn = document.getElementById("btn-review-export");
  const removeBtn = document.getElementById("btn-review-remove");
  const clearBtn = document.getElementById("btn-review-clear");
  const canPick = selectedCapture >= 0 && !!captures[selectedCapture];
  if (exportBtn) exportBtn.disabled = !canPick;
  if (removeBtn) removeBtn.disabled = !canPick;
  if (clearBtn) clearBtn.disabled = !captures.length;
  const sizeEl = document.getElementById("export-size");
  if (sizeEl) sizeEl.disabled = !canPick;
}

function openReview() {
  if (!captures.length) {
    toast(t("capture.empty"));
    return;
  }
  const overlay = document.getElementById("review-overlay");
  if (!overlay) return;
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (fs) {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) fn.call(document);
  }
  if (selectedCapture < 0 || !captures[selectedCapture]) selectedCapture = captures.length - 1;
  pausedBeforeReview = paused;
  paused = true;
  const pauseBtn = document.getElementById("btn-pause");
  if (pauseBtn) pauseBtn.textContent = t("feat.resume");
  reviewOpen = true;
  overlay.hidden = false;
  syncCaptureUi();
}

function closeReview() {
  const overlay = document.getElementById("review-overlay");
  if (overlay) overlay.hidden = true;
  reviewOpen = false;
  paused = pausedBeforeReview;
  const pauseBtn = document.getElementById("btn-pause");
  if (pauseBtn) pauseBtn.textContent = paused ? t("feat.resume") : t("feat.pause");
  if (!paused && typeof loop === "function") loop();
}

function removeSelectedCapture() {
  if (selectedCapture < 0 || !captures[selectedCapture]) return;
  captures.splice(selectedCapture, 1);
  if (!captures.length) selectedCapture = -1;
  else if (selectedCapture >= captures.length) selectedCapture = captures.length - 1;
  syncCaptureUi();
}

function clearCaptures() {
  captures.length = 0;
  selectedCapture = -1;
  syncCaptureUi();
}

function exportSelectedCapture() {
  if (selectedCapture < 0 || !captures[selectedCapture]) {
    toast(t("toast.captureNeedSelect"));
    return;
  }
  const dataUrl = captures[selectedCapture].dataUrl;
  const ew = parseInt(document.getElementById("export-size").value, 10);
  const eh = Math.round((ew * 9) / 16);
  loadImage(
    dataUrl,
    (img) => {
      const pg = createGraphics(ew, eh);
      pg.pixelDensity(1);
      pg.image(img, 0, 0, ew, eh);
      save(pg, exportFileName());
      pg.remove();
      toast(t("toast.captureExported"));
    },
    () => toast(t("toast.readFail"))
  );
}

function bindCaptureUi() {
  const reviewBtn = document.getElementById("btn-review");
  if (reviewBtn) reviewBtn.addEventListener("click", openReview);
  const hud = document.getElementById("capture-hud");
  if (hud) {
    hud.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    hud.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      captureFrame();
    });
  }
  const closeBtn = document.getElementById("btn-review-close");
  if (closeBtn) closeBtn.addEventListener("click", closeReview);
  const exportBtn = document.getElementById("btn-review-export");
  if (exportBtn) exportBtn.addEventListener("click", exportSelectedCapture);
  const removeBtn = document.getElementById("btn-review-remove");
  if (removeBtn) removeBtn.addEventListener("click", removeSelectedCapture);
  const clearBtn = document.getElementById("btn-review-clear");
  if (clearBtn) clearBtn.addEventListener("click", clearCaptures);
  const overlay = document.getElementById("review-overlay");
  if (overlay) {
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) closeReview();
    });
  }
  syncCaptureUi();
}

function exportPNG() {
  const ew = 1920;
  const eh = 1080;
  const pg = createGraphics(ew, eh);
  pg.pixelDensity(1);
  pg.colorMode(RGB, 255);
  renderCaptureFrame(pg, ew, eh);
  save(pg, exportFileName());
  pg.remove();
}

document.addEventListener("visibilitychange", () => {
  if (typeof frameRate !== "function") return;
  if (document.hidden) frameRate(8);
  else if (!paused) frameRate(60);
});

document.addEventListener("keydown", handleSpaceKey, true);
window.addEventListener("keydown", handleSpaceKey, true);
