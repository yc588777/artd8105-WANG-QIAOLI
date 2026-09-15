import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MODULES } from "../data/moduleContent";
import { useAnimationFrame } from "../hooks/useAnimationFrame";
import { sizeCanvas } from "../hooks/useCanvasResize";
import { useAppStore } from "../store/appStore";
import { AURA, drawPyrocystis } from "../render/pyrocystis";
import type { PodRadii } from "../render/podRim";
import { nextElementaryRow } from "../labs/cell/elementaryCA";
import { expandLSystem } from "../labs/grow/lsystemEngine";
import { fitTurtle, turtleWalk } from "../labs/grow/turtleRenderer";
import { stepGrayScottCPU, seedSpot } from "../labs/diff/reactionDiffusion";
import { bioRgb } from "../labs/diff/bioColor";
import { PodRimLabel } from "./PodRimLabel";

function usePreview(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  useAnimationFrame((_, now) => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeCanvas(c);
    draw(ctx, w, h, now / 1000);
  }, true);
  return ref;
}

function useBox(el: { current: HTMLElement | null }) {
  const [box, setBox] = useState({ w: 0, h: 0, bw: 0, bh: 0 });
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const apply = (w: number, h: number, bw: number, bh: number) => {
      setBox((prev) => (prev.w === w && prev.h === h && prev.bw === bw && prev.bh === bh ? prev : { w, h, bw, bh }));
    };
    const read = (entry?: ResizeObserverEntry) => {
      const cRaw = entry?.contentBoxSize;
      const bRaw = entry?.borderBoxSize;
      const c = Array.isArray(cRaw) ? cRaw[0] : cRaw;
      const b = Array.isArray(bRaw) ? bRaw[0] : bRaw;
      if (c && b) {
        apply(c.inlineSize, c.blockSize, b.inlineSize, b.blockSize);
        return;
      }
      apply(node.clientWidth, node.clientHeight, node.offsetWidth, node.offsetHeight);
    };
    read();
    const ro = new ResizeObserver((entries) => read(entries[0]));
    ro.observe(node);
    return () => ro.disconnect();
  }, [el]);
  return box;
}

function Pod({
  cls,
  to,
  id,
  code,
  title,
  scale,
  body,
  hover,
  onEnter,
  canvasRef,
  radii,
}: {
  cls: string;
  to: string;
  id: string;
  code: string;
  title: string;
  scale: string;
  body: string;
  hover: string | null;
  onEnter: (id: string | null) => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  radii: PodRadii;
}) {
  const wrapRef = useRef<HTMLAnchorElement>(null);
  const box = useBox(wrapRef);
  const dim = hover && hover !== code;
  return (
    <Link
      ref={wrapRef}
      to={to}
      className={`pod ${cls}`}
      style={{ opacity: dim ? 0.28 : 1 }}
      aria-label={`${code} ${title}`}
      onMouseEnter={() => onEnter(code)}
      onMouseLeave={() => onEnter(null)}
      onFocus={() => onEnter(code)}
      onBlur={() => onEnter(null)}
    >
      <canvas ref={canvasRef} />
      <PodRimLabel
        id={id}
        box={box}
        radii={radii}
        primary={`${code}  ${title}`}
        scale={scale}
        secondary={body}
        active={hover === code}
      />
    </Link>
  );
}

export function HomePage() {
  const lang = useAppStore((s) => s.lang);
  const setTour = useAppStore((s) => s.setTour);
  const [hover, setHover] = useState<string | null>(null);
  const gene = usePreview((ctx, w, h, t) => {
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    const pulse = 0.15 + 0.12 * Math.sin(t * 3);
    drawPyrocystis(ctx, w * 0.28, h * 0.55, 36, t * 0.3, pulse, { core: true, detail: "full" });
    drawPyrocystis(ctx, w * 0.62, h * 0.48, 28, -t * 0.2, pulse, { core: true, highlight: true, detail: "body" });
  });
  const boids = useRef<{ x: number; y: number; a: number }[]>([]);
  const flock = usePreview((ctx, w, h, t) => {
    if (boids.current.length < 18) {
      boids.current = Array.from({ length: 18 }, (_, i) => ({ x: (i * 37) % w, y: (i * 53) % h, a: i }));
    }
    ctx.fillStyle = "rgba(5,5,8,0.28)";
    ctx.fillRect(0, 0, w, h);
    const pulse = 0.12 + 0.1 * Math.sin(t * 2);
    for (const b of boids.current) {
      b.a += 0.02;
      b.x = (b.x + Math.cos(b.a + t) * 1.4 + w) % w;
      b.y = (b.y + Math.sin(b.a + t * 0.7) * 1.4 + h) % h;
      drawPyrocystis(ctx, b.x, b.y, 11, b.a + Math.PI / 2, pulse, { core: true, detail: "spark" });
    }
  });
  const caRow = useRef(new Uint8Array(80));
  const caHist = useRef<Uint8Array[]>([]);
  useEffect(() => {
    caRow.current[40] = 1;
  }, []);
  const cell = usePreview((ctx, w, h) => {
    const cols = Math.max(20, Math.floor(w / 4));
    if (caRow.current.length !== cols) {
      caRow.current = new Uint8Array(cols);
      caRow.current[cols >> 1] = 1;
      caHist.current = [];
    }
    caRow.current = nextElementaryRow(caRow.current, 30);
    caHist.current.push(new Uint8Array(caRow.current));
    if (caHist.current.length > Math.floor(h / 4)) caHist.current.shift();
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0, 240, 255, 0.7)";
    caHist.current.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x]) ctx.fillRect(x * 4, y * 4, 3, 3);
    });
  });
  const growT = useRef(1);
  const grow = usePreview((ctx, w, h, t) => {
    if (Math.floor(t) !== growT.current) growT.current = 1 + (Math.floor(t) % 4);
    const exp = expandLSystem("F", { F: "F[+F]F[-F][F]" }, growT.current, () => 0.3);
    const geo = turtleWalk(exp.str, {
      angle: 22,
      step: 7,
      wind: Math.sin(t) * 4,
      light: 0,
      obstacles: [],
      jitter: 0,
      rnd: () => 0.5,
    });
    const fit = fitTurtle(geo, w, h);
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0, 230, 255, 0.75)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const s of geo.segs) {
      ctx.moveTo(s.x1 * fit.scale + fit.ox, s.y1 * fit.scale + fit.oy);
      ctx.lineTo(s.x2 * fit.scale + fit.ox, s.y2 * fit.scale + fit.oy);
    }
    ctx.stroke();
    const pulse = 0.22 + 0.12 * Math.sin(t * 4);
    const stride = Math.max(1, Math.ceil(geo.segs.length / 18));
    for (let i = 0; i < geo.segs.length; i += stride) {
      const s = geo.segs[i]!;
      drawPyrocystis(
        ctx,
        s.x2 * fit.scale + fit.ox,
        s.y2 * fit.scale + fit.oy,
        11,
        Math.atan2(s.y2 - s.y1, s.x2 - s.x1) + Math.PI / 2,
        pulse,
        { core: true, highlight: i % (stride * 2) === 0, detail: "body" },
      );
    }
  });
  const rdU = useRef(new Float32Array(48 * 48));
  const rdV = useRef(new Float32Array(48 * 48));
  const rdUn = useRef(new Float32Array(48 * 48));
  const rdVn = useRef(new Float32Array(48 * 48));
  const rdInit = useRef(false);
  const rdOff = useRef<HTMLCanvasElement | null>(null);
  const diff = usePreview((ctx, w, h) => {
    if (!rdInit.current) {
      seedSpot(rdU.current, rdV.current, 48, () => 0.4);
      rdInit.current = true;
    }
    stepGrayScottCPU(rdU.current, rdV.current, rdUn.current, rdVn.current, 48, {
      Du: 0.16,
      Dv: 0.08,
      F: 0.035,
      K: 0.065,
      dt: 1,
    });
    rdU.current.set(rdUn.current);
    rdV.current.set(rdVn.current);
    if (!rdOff.current) {
      rdOff.current = document.createElement("canvas");
      rdOff.current.width = 48;
      rdOff.current.height = 48;
    }
    const octx = rdOff.current.getContext("2d");
    if (!octx) return;
    const img = octx.createImageData(48, 48);
    for (let i = 0; i < 48 * 48; i++) {
      const [r, g, b] = bioRgb(rdU.current[i]!, rdV.current[i]!, 2);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(rdOff.current, 0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  });

  const zh = lang === "zh";
  return (
    <div className="home">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <div>
          <p className="kicker">MORPHOSYSTEM // 05</p>
          <h1>{zh ? "形态系统 05" : "MORPHOSYSTEM"}</h1>
          <p>{zh ? MODULES.index.thesisZh : MODULES.index.thesisEn}</p>
        </div>
        <div className="legend">
          GENE.01 信息
          <br />
          FLOCK.02 群体
          <br />
          CELL.03 格子
          <br />
          GROW.04 拓扑
          <br />
          DIFF.05 物质场
        </div>
      </header>
      <div className="pods">
        <Pod
          cls="pod-gene"
          to="/lab/gene"
          id="pod-gene"
          code="GENE.01"
          title={zh ? MODULES.gene.zh : MODULES.gene.en}
          scale={zh ? MODULES.gene.scaleZh : MODULES.gene.scaleEn}
          body={zh ? MODULES.gene.thesisZh : MODULES.gene.thesisEn}
          hover={hover}
          onEnter={setHover}
          canvasRef={gene}
          radii={{ kind: "pct", h: [0.46, 0.54, 0.42, 0.58], v: [0.52, 0.36, 0.64, 0.48] }}
        />
        <Pod
          cls="pod-flock"
          to="/lab/flock"
          id="pod-flock"
          code="FLOCK.02"
          title={zh ? MODULES.flock.zh : MODULES.flock.en}
          scale={zh ? MODULES.flock.scaleZh : MODULES.flock.scaleEn}
          body={zh ? MODULES.flock.thesisZh : MODULES.flock.thesisEn}
          hover={hover}
          onEnter={setHover}
          canvasRef={flock}
          radii={{ kind: "pct", h: [0.38, 0.62, 0.48, 0.52], v: [0.4, 0.55, 0.45, 0.6] }}
        />
        <Pod
          cls="pod-cell"
          to="/lab/cell"
          id="pod-cell"
          code="CELL.03"
          title={zh ? MODULES.cell.zh : MODULES.cell.en}
          scale={zh ? MODULES.cell.scaleZh : MODULES.cell.scaleEn}
          body={zh ? MODULES.cell.thesisZh : MODULES.cell.thesisEn}
          hover={hover}
          onEnter={setHover}
          canvasRef={cell}
          radii={{ kind: "px", r: 8 }}
        />
        <Pod
          cls="pod-grow"
          to="/lab/grow"
          id="pod-grow"
          code="GROW.04"
          title={zh ? MODULES.grow.zh : MODULES.grow.en}
          scale={zh ? MODULES.grow.scaleZh : MODULES.grow.scaleEn}
          body={zh ? MODULES.grow.thesisZh : MODULES.grow.thesisEn}
          hover={hover}
          onEnter={setHover}
          canvasRef={grow}
          radii={{ kind: "pct", h: [0.7, 0.3, 0.48, 0.52], v: [0.42, 0.58, 0.42, 0.58] }}
        />
        <Pod
          cls="pod-diff"
          to="/lab/diff"
          id="pod-diff"
          code="DIFF.05"
          title={zh ? MODULES.diff.zh : MODULES.diff.en}
          scale={zh ? MODULES.diff.scaleZh : MODULES.diff.scaleEn}
          body={zh ? MODULES.diff.thesisZh : MODULES.diff.thesisEn}
          hover={hover}
          onEnter={setHover}
          canvasRef={diff}
          radii={{ kind: "pct", h: [0.32, 0.68, 0.4, 0.6], v: [0.7, 0.3, 0.7, 0.3] }}
        />
      </div>
      <div className="home-actions">
        <Link to="/lab/gene">
          <button type="button" className="active">
            ENTER LAB
          </button>
        </Link>
        <button type="button" onClick={() => setTour(true)}>
          GUIDED TOUR
        </button>
        <Link to="/about">
          <button type="button">ABOUT</button>
        </Link>
      </div>
    </div>
  );
}
