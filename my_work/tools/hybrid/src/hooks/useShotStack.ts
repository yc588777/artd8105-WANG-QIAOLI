import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { canvasPreview, cloneCanvas, downloadCanvasPng, upsampleCanvas } from "../utils/exportCanvas";
import {
  HIRES_SCALE,
  MAX_SHOTS,
  canAddShot,
  exportTargets,
  nextShotId,
  removeShot,
  shotIndexLabel,
  toggleShotSelected,
} from "../utils/shotStack";
import { tick } from "../utils/sound";
import { useAppStore } from "../store/appStore";
import type { LabId } from "../types";

export type ShotFrame = {
  id: string;
  selected: boolean;
  t: number;
  w: number;
  h: number;
  thumb: string;
  pixels: HTMLCanvasElement;
};

function typingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el.isContentEditable) return true;
  return false;
}

function flashStage() {
  const el = document.querySelector(".canvas-frame");
  if (!el) return;
  el.classList.remove("shot-flash");
  void (el as HTMLElement).offsetWidth;
  el.classList.add("shot-flash");
  window.setTimeout(() => el.classList.remove("shot-flash"), 200);
}

export function useShotStack(canvasRef: RefObject<HTMLCanvasElement | null>, module: LabId) {
  const seed = useAppStore((s) => s.seed);
  const sound = useAppStore((s) => s.sound);
  const setLog = useAppStore((s) => s.setLog);
  const [shots, setShots] = useState<ShotFrame[]>([]);
  const salt = useRef(0);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  const capture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 8 || canvas.height < 8) return false;
    const current = shotsRef.current;
    if (!canAddShot(current.length)) {
      setLog(`SHOT FULL // ${MAX_SHOTS}/4 先删一张`);
      tick(sound, "scan");
      return false;
    }
    const pixels = cloneCanvas(canvas);
    salt.current += 1;
    const shot: ShotFrame = {
      id: nextShotId(Date.now(), salt.current),
      selected: true,
      t: Date.now(),
      w: pixels.width,
      h: pixels.height,
      thumb: canvasPreview(pixels),
      pixels,
    };
    setShots((list) => (canAddShot(list.length) ? [...list, shot] : list));
    flashStage();
    tick(sound, "done");
    setLog(`SHOT ${current.length + 1}/${MAX_SHOTS} // ${pixels.width}×${pixels.height}`);
    return true;
  }, [canvasRef, setLog, sound]);

  const toggle = useCallback((id: string) => {
    setShots((list) => toggleShotSelected(list, id));
  }, []);

  const remove = useCallback((id: string) => {
    setShots((list) => removeShot(list, id));
  }, []);

  const clear = useCallback(() => setShots([]), []);

  const exportSelected = useCallback(async () => {
    const targets = exportTargets(shotsRef.current);
    if (!targets.length) {
      setLog("SHOT EMPTY // 先按空格截取");
      return;
    }
    for (const shot of targets) {
      const n = shotIndexLabel(shotsRef.current, shot.id);
      const hi = upsampleCanvas(shot.pixels, HIRES_SCALE);
      await downloadCanvasPng(hi, module, seed, `SHOT${n}x${HIRES_SCALE}`);
    }
    tick(sound, "done");
    setLog(`EXPORT HIRES PNG // ${targets.length} FILE // ${HIRES_SCALE}×`);
  }, [module, seed, setLog, sound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (typingTarget(e.target)) return;
      e.preventDefault();
      capture();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [capture]);

  return { shots, capture, toggle, remove, clear, exportSelected };
}
