export type MotionSample = {
  energy: number;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
};

export const IDLE_MOTION: MotionSample = { energy: 0, cx: 0.5, cy: 0.5, vx: 0, vy: 0 };

function luma(data: Uint8ClampedArray, i: number) {
  const o = i * 4;
  return data[o]! * 0.299 + data[o + 1]! * 0.587 + data[o + 2]! * 0.114;
}

export function frameMotion(
  prev: Uint8ClampedArray,
  next: Uint8ClampedArray,
  w: number,
  h: number,
  threshold = 26,
): MotionSample {
  const n = w * h;
  let mass = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(luma(next, i) - luma(prev, i));
    if (d < threshold) continue;
    const x = i % w;
    const y = (i / w) | 0;
    const m = d / 255;
    mass += m;
    sx += x * m;
    sy += y * m;
  }
  const energy = Math.min(1, mass / (n * 0.045));
  if (mass < 1e-4) return { ...IDLE_MOTION, energy: 0 };
  return {
    energy,
    cx: sx / mass / Math.max(1, w - 1),
    cy: sy / mass / Math.max(1, h - 1),
    vx: 0,
    vy: 0,
  };
}

export class MotionTracker {
  sample: MotionSample = { ...IDLE_MOTION };
  error: string | null = null;
  ready = false;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private prev: Uint8ClampedArray | null = null;
  private preview: HTMLVideoElement | null = null;
  private w = 160;
  private h = 90;

  attachPreview(el: HTMLVideoElement | null) {
    this.preview = el;
    if (el && this.stream) el.srcObject = this.stream;
  }

  async start() {
    this.error = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = "此浏览器没有摄像头接口。";
      return false;
    }
    if (!window.isSecureContext) {
      this.error = "摄像头需要安全上下文。请用 http://localhost:5173 打开。";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
        audio: false,
      });
      this.stream = stream;
      const video = document.createElement("video");
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      video.srcObject = stream;
      await video.play();
      this.video = video;
      this.canvas = document.createElement("canvas");
      this.canvas.width = this.w;
      this.canvas.height = this.h;
      if (this.preview) this.preview.srcObject = stream;
      this.ready = true;
      this.prev = null;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "无法打开摄像头";
      this.error = window.isSecureContext ? msg : `${msg}。局域网 IP 下请改用 localhost。`;
      this.ready = false;
      return false;
    }
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
    if (this.preview) this.preview.srcObject = null;
    this.ready = false;
    this.prev = null;
    this.sample = { ...IDLE_MOTION };
  }

  poll(): MotionSample {
    const video = this.video;
    const canvas = this.canvas;
    if (!video || !canvas || video.readyState < 2) return this.sample;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return this.sample;
    ctx.drawImage(video, 0, 0, this.w, this.h);
    const next = ctx.getImageData(0, 0, this.w, this.h).data;
    if (this.prev) {
      const raw = frameMotion(this.prev, next, this.w, this.h);
      const prev = this.sample;
      const a = 0.22;
      const cx = 1 - (prev.cx * (1 - a) + raw.cx * a);
      const cy = prev.cy * (1 - a) + raw.cy * a;
      this.sample = {
        energy: prev.energy * (1 - a) + raw.energy * a,
        cx,
        cy,
        vx: cx - prev.cx,
        vy: cy - prev.cy,
      };
    }
    this.prev = new Uint8ClampedArray(next);
    return this.sample;
  }
}
