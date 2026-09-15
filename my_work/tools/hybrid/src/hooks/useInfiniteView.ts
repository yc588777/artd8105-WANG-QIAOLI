import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { pointerToCanvas } from "./useCanvasResize";

export type Cam = { x: number; y: number; k: number };

export function useInfiniteView(canvasRef: RefObject<HTMLCanvasElement | null>, alive = 1) {
  const cam = useRef<Cam>({ x: 0, y: 0, k: 1 });
  const pan = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const syncZoom = useCallback(() => setZoom(cam.current.k), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = pointerToCanvas(canvas, e);
      const { x, y, k } = cam.current;
      const factor = Math.exp(-e.deltaY * 0.0018);
      const nk = Math.min(48, Math.max(0.02, k * factor));
      cam.current = {
        k: nk,
        x: pt.x - ((pt.x - x) * nk) / k,
        y: pt.y - ((pt.y - y) * nk) / k,
      };
      syncZoom();
    };
    const onMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onMenu);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onMenu);
    };
  }, [canvasRef, alive, syncZoom]);

  const wantsPan = (e: { button: number; altKey: boolean }) =>
    e.altKey || e.button === 1 || e.button === 2;

  const beginPan = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !wantsPan(e)) return false;
    const pt = pointerToCanvas(canvas, e);
    pan.current = { sx: pt.x, sy: pt.y, cx: cam.current.x, cy: cam.current.y };
    canvas.setPointerCapture(e.pointerId);
    return true;
  };

  const movePan = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !pan.current) return false;
    const pt = pointerToCanvas(canvas, e);
    cam.current.x = pan.current.cx + (pt.x - pan.current.sx);
    cam.current.y = pan.current.cy + (pt.y - pan.current.sy);
    return true;
  };

  const endPan = () => {
    if (pan.current) {
      pan.current = null;
      syncZoom();
    }
  };

  const apply = (ctx: CanvasRenderingContext2D) => {
    const { x, y, k } = cam.current;
    ctx.setTransform(k, 0, 0, k, x, y);
  };

  const identity = (ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const worldFromEvent = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const pt = pointerToCanvas(canvas, e);
    const { x, y, k } = cam.current;
    return { x: (pt.x - x) / k, y: (pt.y - y) / k };
  };

  const reset = (next?: Partial<Cam>) => {
    cam.current = { x: 0, y: 0, k: 1, ...next };
    syncZoom();
  };

  const fitWorld = (minX: number, minY: number, maxX: number, maxY: number, vw: number, vh: number, pad = 56) => {
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const k = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh);
    const nk = Math.min(8, Math.max(0.04, k));
    cam.current = {
      k: nk,
      x: (vw - bw * nk) / 2 - minX * nk,
      y: (vh - bh * nk) / 2 - minY * nk,
    };
    syncZoom();
  };

  const lookAt = (wx: number, wy: number, vw: number, vh: number, k = cam.current.k) => {
    cam.current = { k, x: vw / 2 - wx * k, y: vh / 2 - wy * k };
    syncZoom();
  };

  return {
    cam,
    zoom,
    apply,
    identity,
    beginPan,
    movePan,
    endPan,
    worldFromEvent,
    reset,
    fitWorld,
    lookAt,
    panning: () => !!pan.current,
  };
}
