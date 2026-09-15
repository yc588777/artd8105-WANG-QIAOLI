import { useEffect, useRef } from "react";

export function GrainOverlay() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = Math.random() * 255;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const url = c.toDataURL();
    const el = document.querySelector(".grain") as HTMLElement | null;
    if (el) el.style.backgroundImage = `url(${url})`;
  }, []);
  return (
    <>
      <canvas ref={ref} hidden />
      <div className="grain" />
    </>
  );
}
