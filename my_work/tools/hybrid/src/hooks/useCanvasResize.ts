import { useEffect, useState, type RefObject } from "react";

export type CanvasSize = { w: number; h: number; dpr: number; cssW: number; cssH: number };

export function sizeCanvas(canvas: HTMLCanvasElement): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr, cssW, cssH };
}

export function pointerToCanvas(canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

export function useCanvasResize(ref: RefObject<HTMLCanvasElement | null>, onResize?: (s: CanvasSize) => void) {
  const [size, setSize] = useState<CanvasSize>({ w: 1, h: 1, dpr: 1, cssW: 1, cssH: 1 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement ?? canvas;
    const apply = () => {
      const s = sizeCanvas(canvas);
      setSize(s);
      onResize?.(s);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [ref, onResize]);

  return size;
}
