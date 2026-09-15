export function stampName(module: string, seed: number, ext: string, tag?: string) {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const extra = tag ? `_${tag}` : "";
  return `M05_${module.toUpperCase()}_${String(seed).padStart(4, "0")}${extra}_${ts}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png");
  });
}

export async function downloadCanvasPng(canvas: HTMLCanvasElement, module: string, seed: number, tag?: string) {
  const blob = await canvasToPngBlob(canvas);
  downloadBlob(blob, stampName(module, seed, "png", tag));
}

export function cloneCanvas(source: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, source.width);
  c.height = Math.max(1, source.height);
  const ctx = c.getContext("2d");
  if (ctx) ctx.drawImage(source, 0, 0);
  return c;
}

export function upsampleCanvas(source: HTMLCanvasElement, scale = 2) {
  const s = Math.max(1, Math.min(4, scale));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(source.width * s));
  c.height = Math.max(1, Math.round(source.height * s));
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, c.width, c.height);
  }
  return c;
}

export function canvasPreview(source: HTMLCanvasElement, maxEdge = 220) {
  const r = Math.min(1, maxEdge / Math.max(source.width, source.height, 1));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(source.width * r));
  c.height = Math.max(1, Math.round(source.height * r));
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

export function canvasThumbnail(canvas: HTMLCanvasElement, size = 240) {
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const ctx = off.getContext("2d");
  if (!ctx) return "";
  const s = Math.min(canvas.width, canvas.height);
  const sx = (canvas.width - s) / 2;
  const sy = (canvas.height - s) / 2;
  ctx.drawImage(canvas, sx, sy, s, s, 0, 0, size, size);
  return off.toDataURL("image/png");
}

export function downloadJson(data: unknown, module: string, seed: number) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, stampName(module, seed, "json"));
}

export async function copyJson(data: unknown) {
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
}

export function downloadText(text: string, filename: string) {
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
}

export function downloadSvg(svg: string, module: string, seed: number) {
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), stampName(module, seed, "svg"));
}
