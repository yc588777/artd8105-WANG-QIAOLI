import { useEffect, useRef, useState } from "react";
import { MetricReadout, PresetSelector } from "../../components/ControlPanel/Controls";
import { ParameterSlider } from "../../components/ControlPanel/ParameterSlider";
import { ExportDialog } from "../../components/ExportDialog/ExportDialog";
import { LabLayout } from "../../components/LabLayout/LabLayout";
import { Transport } from "../../components/Timeline/Transport";
import { useAnimationFrame, useLatest } from "../../hooks/useAnimationFrame";
import { sizeCanvas, useCanvasResize } from "../../hooks/useCanvasResize";
import { useInfiniteView } from "../../hooks/useInfiniteView";
import { ViewPanel } from "../../components/ControlPanel/ViewPanel";
import { useAppStore } from "../../store/appStore";
import { useLabPersist } from "../../store/labPersist";
import { C } from "../../utils/color";
import { SeededRandom } from "../../utils/seededRandom";
import { AURA, drawPyrocystis } from "../../render/pyrocystis";
import { auraLevel } from "../../utils/auraAudio";
import type { LabMode } from "../../types";
import { nextElementaryRow, rowEntropy, ruleBits, wolframClassHint } from "./elementaryCA";
import { CELL_PRESETS } from "./cellPresets";
import {
  BLINKER,
  BLOCK,
  GLIDER,
  densityEntropy,
  matchPattern,
  neighborCount,
  placePattern,
  stepLife,
} from "./gameOfLife";

const LIFE_COLS = 320;
const LIFE_ROWS = 220;
const WOLF_COLS = 512;
const CELL_PX = 8;
const WOLF_CAP = 8000;
const REWIND_CAP = 240;

export function CellLab() {
  const lang = useAppStore((s) => s.lang);
  const seed = useAppStore((s) => s.seed);
  const running = useAppStore((s) => s.running);
  const setFps = useAppStore((s) => s.setFps);
  const setLog = useAppStore((s) => s.setLog);
  const [mode, setMode] = useState<LabMode>("experiment");
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<"life" | "wolfram">("life");
  const [rule, setRule] = useState(30);
  const [birth, setBirth] = useState("3");
  const [survive, setSurvive] = useState("23");
  const [speed, setSpeed] = useState(8);
  const [brush, setBrush] = useState<"draw" | "erase">("draw");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [gen, setGen] = useState(0);
  const [metrics, setMetrics] = useState({ live: 0, density: 0, change: 0, entropy: 0 });
  const genRef = useRef(0);
  const metricsRef = useRef({ live: 0, density: 0, change: 0, entropy: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = useRef(new Uint8Array(0));
  const next = useRef(new Uint8Array(0));
  const hist = useRef<Uint8Array[]>([]);
  const wolfHist = useRef<Uint8Array[]>([]);
  const originGen = useRef(0);
  const dim = useRef({ cols: LIFE_COLS, rows: LIFE_ROWS, cell: CELL_PX });
  const acc = useRef(0);
  const pick = useRef({ x: 10, y: 10 });
  const pending = useRef(0);
  const booted = useRef(false);
  const size = useCanvasResize(canvasRef);
  const view = useInfiniteView(canvasRef, size.w);
  const rec = useLatest({ kind, rule, birth, survive, speed, brush, mode, running });
  useEffect(() => {
    useLabPersist.getState().setLab("cell", { kind, rule, birth, survive });
  }, [kind, rule, birth, survive]);
  const fps = useRef({ n: 0, t: performance.now() });

  const parseSet = (s: string) => [...s].map(Number).filter((n) => n >= 0 && n <= 8);

  const frameView = () => {
    const c = canvasRef.current;
    if (!c) return;
    const { cols, rows, cell } = dim.current;
    if (rec.current.kind === "wolfram") {
      view.lookAt((cols * cell) / 2, 48, c.width, c.height, 1);
    } else {
      view.lookAt((cols * cell) / 2, (rows * cell) / 2, c.width, c.height, 0.48);
    }
  };

  const init = () => {
    const wolf = rec.current.kind === "wolfram";
    const cols = wolf ? WOLF_COLS : LIFE_COLS;
    const rows = wolf ? 1 : LIFE_ROWS;
    dim.current = { cols, rows, cell: CELL_PX };
    grid.current = new Uint8Array(cols * (wolf ? 1 : rows));
    next.current = new Uint8Array(grid.current.length);
    hist.current = [];
    wolfHist.current = [];
    originGen.current = 0;
    genRef.current = 0;
    setGen(0);
    booted.current = false;
    const rng = new SeededRandom(seed);
    if (wolf) {
      const row = new Uint8Array(cols);
      row[cols >> 1] = 1;
      wolfHist.current = [row];
      genRef.current = 1;
    } else {
      placePattern(grid.current, cols, rows, cols >> 1, rows >> 1, GLIDER);
      const n = Math.floor(cols * rows * 0.055);
      for (let i = 0; i < n; i++) grid.current[(rng.next() * grid.current.length) | 0] = 1;
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, seed, rule]);

  const stepOnce = () => {
    const { cols, rows } = dim.current;
    if (!cols) return;
    if (rec.current.kind === "wolfram") {
      const rowsHist = wolfHist.current;
      const last = rowsHist[rowsHist.length - 1];
      if (!last) return;
      const nxt = nextElementaryRow(last, rec.current.rule, true);
      rowsHist.push(nxt);
      if (rowsHist.length > WOLF_CAP) {
        rowsHist.shift();
        originGen.current += 1;
      }
      genRef.current = originGen.current + rowsHist.length;
      const live = [...nxt].reduce((a, b) => a + b, 0);
      const ent = rowEntropy(nxt);
      metricsRef.current = { live, density: ent, change: 1, entropy: ent };
      if (rec.current.rule === 30 && genRef.current > 20) setDone((d) => (d["cell-chaos"] ? d : { ...d, "cell-chaos": true }));
    } else {
      const snap = new Uint8Array(grid.current);
      hist.current.push(snap);
      if (hist.current.length > REWIND_CAP) hist.current.shift();
      const { live, changed } = stepLife(
        grid.current,
        next.current,
        cols,
        rows,
        parseSet(rec.current.birth),
        parseSet(rec.current.survive),
        true,
      );
      const tmp = grid.current;
      grid.current = next.current;
      next.current = tmp;
      genRef.current += 1;
      if (genRef.current >= 100 && live > 0) setDone((d) => (d["cell-100"] ? d : { ...d, "cell-100": true }));
      const ent = densityEntropy(grid.current);
      metricsRef.current = { live, density: live / grid.current.length, change: changed / grid.current.length, entropy: ent };
      if (matchPattern(grid.current, cols, rows, GLIDER) > 0) setDone((d) => (d["cell-glider"] ? d : { ...d, "cell-glider": true }));
    }
  };

  useAnimationFrame((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sized = sizeCanvas(canvas);
    if (!dim.current.cols) {
      init();
      return;
    }
    if (!booted.current && sized.w > 180 && sized.h > 180) {
      frameView();
      booted.current = true;
    }
    acc.current += dt * rec.current.speed;
    let steps = Math.min(24, Math.floor(acc.current));
    acc.current -= steps;
    if (!rec.current.running) steps = pending.current;
    pending.current = 0;
    for (let i = 0; i < steps; i++) stepOnce();

    const { cols, rows, cell } = dim.current;
    const cam = view.cam.current;
    const x0 = Math.max(0, Math.floor(-cam.x / cam.k / cell) - 1);
    const y0 = Math.max(0, Math.floor(-cam.y / cam.k / cell) - 1);
    const x1 = Math.min(cols, Math.ceil((sized.w - cam.x) / cam.k / cell) + 1);
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, sized.w, sized.h);
    view.apply(ctx);
    const pulse = auraLevel() || 0.14 + 0.1 * Math.sin(performance.now() * 0.002);
    const screenCell = cell * cam.k;
    const useGlyph = rec.current.kind === "life" && screenCell >= 7;
    if (rec.current.kind === "wolfram") {
      const list = wolfHist.current;
      const yEnd = Math.min(list.length, Math.ceil((sized.h - cam.y) / cam.k / cell) + 1 - originGen.current);
      const yStart = Math.max(0, y0 - originGen.current);
      ctx.fillStyle = `rgba(0, 240, 255, ${0.55 + pulse * 0.3})`;
      for (let i = yStart; i < yEnd; i++) {
        const row = list[i]!;
        const y = (originGen.current + i) * cell;
        for (let x = x0; x < x1; x++) {
          if (row[x]) ctx.fillRect(x * cell, y, cell - 1, cell - 1);
        }
      }
    } else {
      const y1 = Math.min(rows, Math.ceil((sized.h - cam.y) / cam.k / cell) + 1);
      if (useGlyph) {
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (!grid.current[y * cols + x]) continue;
            drawPyrocystis(ctx, x * cell + cell * 0.5, y * cell + cell * 0.5, cell * 1.1, x * 0.7 + y * 0.3, pulse, {
              core: ((x ^ y) & 1) === 0,
              detail: screenCell > 14 ? "body" : "spark",
            });
          }
        }
      } else {
        ctx.fillStyle = `rgba(0, 240, 255, ${0.5 + pulse * 0.35})`;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (grid.current[y * cols + x]) ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          }
        }
      }
    }
    if (rec.current.mode === "analyze") {
      const { x, y } = pick.current;
      ctx.strokeStyle = C.blue;
      ctx.strokeRect((x - 1) * cell, (y - 1) * cell, cell * 3, cell * 3);
      ctx.fillStyle = C.coral;
      ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
    }
    view.identity(ctx);
    ctx.fillStyle = C.ash;
    ctx.font = "42px Archivo Black";
    if (rec.current.kind === "wolfram") ctx.fillText(`R${rec.current.rule}`, 16, 48);
    fps.current.n++;
    if (performance.now() - fps.current.t > 400) {
      setFps((fps.current.n * 1000) / (performance.now() - fps.current.t));
      fps.current = { n: 0, t: performance.now() };
      setGen(genRef.current);
      setMetrics(metricsRef.current);
      setLog(`CA // GEN ${genRef.current} // LIVE ${metricsRef.current.live}`);
    }
  }, true);

  const rewind = () => {
    if (rec.current.kind === "wolfram") {
      if (wolfHist.current.length <= 1) return;
      wolfHist.current.pop();
      genRef.current = originGen.current + wolfHist.current.length;
      setGen(genRef.current);
      return;
    }
    if (!hist.current.length) return;
    const prev = hist.current.pop();
    if (prev) {
      grid.current = new Uint8Array(prev);
      genRef.current = Math.max(0, genRef.current - 1);
      setGen(genRef.current);
    }
  };

  const worldCell = (e: { clientX: number; clientY: number }) => {
    const pt = view.worldFromEvent(e);
    return { x: Math.floor(pt.x / CELL_PX), y: Math.floor(pt.y / CELL_PX) };
  };

  const bits = ruleBits(rule);
  const nhood = neighborCount(grid.current, dim.current.cols, dim.current.rows, pick.current.x, pick.current.y, true);
  const explain =
    kind === "wolfram"
      ? wolframClassHint(rule) === "class3"
        ? "时间轴向下无限堆积。提高速度后新行会伸出画面，用平移跟随即可。"
        : wolframClassHint(rule) === "class4"
          ? "Class 4：可移动结构出现在秩序与混沌的边缘。"
          : `规则 ${rule} 的八位邻域输出为 ${bits.join("")}。`
      : metrics.change < 0.01
        ? "变化率极低，格子接近稳定结构或振荡。"
        : "网格大于视口。滑翔机可以飞出画面，平移缩放继续追踪。";

  return (
    <LabLayout
      id="cell"
      lang={lang}
      mode={mode}
      onMode={setMode}
      explain={explain}
      step={step}
      onStep={setStep}
      done={done}
      summary={`GEN ${gen}`}
      canvas={
        <canvas
          ref={canvasRef}
          aria-label="元胞自动机网格"
          onPointerDown={(e) => {
            if (view.beginPan(e)) return;
            const { x, y } = worldCell(e);
            if (rec.current.kind === "wolfram") {
              const list = wolfHist.current;
              const iy = y - originGen.current;
              if (x < 0 || x >= WOLF_COLS || iy < 0 || iy >= list.length) return;
              pick.current = { x, y };
              list[iy]![x] = rec.current.brush === "erase" ? 0 : 1;
              return;
            }
            const { cols, rows } = dim.current;
            if (x < 0 || y < 0 || x >= cols || y >= rows) return;
            pick.current = { x, y };
            grid.current[y * cols + x] = rec.current.brush === "erase" ? 0 : 1;
          }}
          onPointerMove={(e) => {
            view.movePan(e);
          }}
          onPointerUp={view.endPan}
          onPointerCancel={view.endPan}
        />
      }
      inspector={
        <>
          <PresetSelector
            value={kind}
            options={[
              { id: "life", label: "2D LIFE" },
              { id: "wolfram", label: "1D ECA" },
            ]}
            onChange={setKind}
          />
          {kind === "wolfram" ? (
            <>
              <ParameterSlider label="Rule" value={rule} min={0} max={255} step={1} recMin={0} recMax={255} onChange={setRule} onReset={() => setRule(30)} />
              <PresetSelector
                value={`r${rule}`}
                options={CELL_PRESETS.wolfram.map((p) => ({ id: `r${p.rule}`, label: p.zh }))}
                onChange={(id) => setRule(Number(id.slice(1)))}
              />
              <p className="seq">bits {bits.join(" ")}</p>
            </>
          ) : (
            <>
              <label className="param">
                出生 B
                <input value={birth} onChange={(e) => setBirth(e.target.value.replace(/\D/g, ""))} />
              </label>
              <label className="param">
                存活 S
                <input value={survive} onChange={(e) => setSurvive(e.target.value.replace(/\D/g, ""))} />
              </label>
              <div className="seg">
                <button type="button" onClick={() => { setBirth("3"); setSurvive("23"); }}>
                  B3/S23
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { cols, rows } = dim.current;
                    grid.current.fill(0);
                    placePattern(grid.current, cols, rows, cols >> 1, rows >> 1, GLIDER);
                    placePattern(grid.current, cols, rows, 8, 8, BLOCK);
                    placePattern(grid.current, cols, rows, 16, 6, BLINKER);
                  }}
                >
                  滑翔机种子
                </button>
              </div>
            </>
          )}
          <PresetSelector
            value={brush}
            options={[
              { id: "draw", label: "绘制" },
              { id: "erase", label: "擦除" },
            ]}
            onChange={setBrush}
          />
          <ParameterSlider label="Speed" value={speed} min={1} max={64} step={1} recMin={4} recMax={16} onChange={setSpeed} onReset={() => setSpeed(8)} />
          {mode === "analyze" && <p>选中邻域活细胞 {nhood}</p>}
          <ViewPanel zoom={view.zoom} onReset={frameView} />
          <ExportDialog module="cell" canvasRef={canvasRef} params={{ kind, rule, birth, survive, seed }} />
        </>
      }
      timeline={
        <>
          <Transport
            onReset={init}
            onStep={() => {
              pending.current = 1;
            }}
            extra={
              <button type="button" onClick={rewind}>
                REWIND {REWIND_CAP}
              </button>
            }
          />
          <MetricReadout
            items={[
              { k: "LIVE", v: String(metrics.live) },
              { k: "DENSITY", v: metrics.density.toFixed(3) },
              { k: "Δ", v: metrics.change.toFixed(3) },
              { k: "ENTROPY", v: metrics.entropy.toFixed(3) },
            ]}
          />
        </>
      }
    />
  );
}
