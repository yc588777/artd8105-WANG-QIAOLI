import type { Cam } from "../hooks/useInfiniteView";

export const AURA = {
  ocean: "#050508",
  cyan: "#00F0FF",
  amber: "#FF6600",
  core: "#FFC800",
};

export type AuraDetail = "full" | "body" | "spark";

export function worldInView(x: number, y: number, cam: Cam, vw: number, vh: number, pad = 48) {
  const sx = x * cam.k + cam.x;
  const sy = y * cam.k + cam.y;
  return sx > -pad && sy > -pad && sx < vw + pad && sy < vh + pad;
}

function fusiform(ctx: CanvasRenderingContext2D, h: number, w: number) {
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.bezierCurveTo(w, -h / 4, w, h / 4, 0, h / 2);
  ctx.bezierCurveTo(-w, h / 4, -w, -h / 4, 0, -h / 2);
  ctx.closePath();
}

export function drawPyrocystis(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  audioLevel: number,
  opts: { core?: boolean; highlight?: boolean; detail?: AuraDetail; mutant?: boolean; gain?: number } = {},
) {
  const detail = opts.detail ?? "body";
  const gain = Math.max(0, opts.gain ?? 1);
  const pulse = 1 + audioLevel * 0.3;
  const h = Math.max(3, size * pulse);
  const w = size * (opts.mutant ? 0.48 : 0.35) * pulse;
  const cyanA = 0.55 + audioLevel * 0.25;
  const alpha = (v: number) => Math.min(1, Math.max(0, v * gain));

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (detail === "spark") {
    ctx.fillStyle = `rgba(0, 240, 255, ${alpha(0.16 + audioLevel * 0.2)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 1.05, h * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = opts.highlight ? `rgba(0, 240, 255, ${alpha(0.7 + audioLevel * 0.2)})` : `rgba(0, 210, 240, ${alpha(0.55 + audioLevel * 0.3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.62, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (opts.core) {
      ctx.fillStyle = `rgba(255, 140, 20, ${alpha(0.7 + audioLevel * 0.2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1.2, w * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = `rgba(0, 240, 255, ${alpha(0.1 + audioLevel * 0.16)})`;
  fusiform(ctx, h * (1.55 + Math.max(0, gain - 1) * 0.35), w * (1.75 + Math.max(0, gain - 1) * 0.35));
  ctx.fill();

  ctx.fillStyle = opts.highlight ? `rgba(0, 190, 255, ${alpha(0.58)})` : `rgba(0, 55, 110, ${alpha(0.7)})`;
  ctx.strokeStyle = opts.mutant ? `rgba(255, 120, 40, ${alpha(0.9)})` : `rgba(0, 240, 255, ${alpha(Math.min(1, cyanA + 0.2))})`;
  ctx.lineWidth = Math.max(1.15, size * 0.07);
  fusiform(ctx, h, w);
  ctx.fill();
  ctx.stroke();

  if (opts.core) {
    const rad = Math.max(2.2, w * 0.62);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    grad.addColorStop(0, `rgba(255, 200, 0, ${alpha(0.85 + audioLevel * 0.1)})`);
    grad.addColorStop(0.5, `rgba(255, 80, 0, ${alpha(0.7)})`);
    grad.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();

    if (detail === "full") {
      ctx.strokeStyle = `rgba(255, 150, 0, ${alpha(0.4)})`;
      ctx.lineWidth = 0.5;
      const fibers = 6 + Math.floor(audioLevel * 3);
      for (let i = 0; i < fibers; i++) {
        const ang = (Math.PI * 2 * i) / fibers + audioLevel;
        const r = h * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(ang + 0.5) * r * 0.5, Math.sin(ang + 0.5) * r * 0.5, Math.cos(ang) * r, Math.sin(ang) * r);
        ctx.stroke();
      }
    }
  }

  if (detail === "full") {
    ctx.fillStyle = `rgba(0, 255, 255, ${alpha(0.45 + audioLevel * 0.4)})`;
    let seed = ((x * 1.35 + y * 9.87) % 1 + 1) % 1;
    const n = 4 + Math.floor(audioLevel * 5);
    for (let i = 0; i < n; i++) {
      const px = seed * w * 1.5 - w * 0.75;
      seed = (seed * 11.3) % 1;
      const py = seed * h * 0.8 - h * 0.4;
      seed = (seed * 7.9) % 1;
      ctx.beginPath();
      ctx.arc(px, py, 0.5 + audioLevel * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawAuraFilament(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  audioLevel: number,
  hot = false,
  hit = false,
) {
  const prev = ctx.lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = Math.max(2.4, prev * 3.4);
  ctx.strokeStyle = hit
    ? "rgba(80, 140, 255, 0.28)"
    : hot
      ? `rgba(0, 240, 255, ${0.32 + audioLevel * 0.2})`
      : `rgba(0, 190, 230, ${0.18 + audioLevel * 0.12})`;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = Math.max(1, prev);
  ctx.strokeStyle = hit
    ? `rgba(120, 170, 255, ${0.95})`
    : hot
      ? `rgba(0, 245, 255, ${0.82 + audioLevel * 0.18})`
      : `rgba(0, 220, 255, ${0.55 + audioLevel * 0.3})`;
  ctx.stroke();
  ctx.lineWidth = prev;
}
