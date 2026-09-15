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
import type { LabMode } from "../../types";
import { DIFF_PRESETS } from "./diffPresets";
import { RDEngine, type RDView } from "./reactionDiffusion";
import { FitzHughNagumo } from "./fitzhughNagumo";
import { AURA } from "../../render/pyrocystis";
import { auraLevel } from "../../utils/auraAudio";

const GL_N = 512;
const CPU_N = 160;
const SCALE = 6;

export function DiffLab({
  seedGrid,
}: {
  seedGrid?: Float32Array;
} = {}) {
  const lang = useAppStore((s) => s.lang);
  const running = useAppStore((s) => s.running);
  const seed = useAppStore((s) => s.seed);
  const setFps = useAppStore((s) => s.setFps);
  const setLog = useAppStore((s) => s.setLog);
  const [mode, setMode] = useState<LabMode>("experiment");
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState("spots");
  const cur = DIFF_PRESETS.find((p) => p.id === preset) ?? DIFF_PRESETS[0]!;
  const [Du, setDu] = useState(cur.Du);
  const [Dv, setDv] = useState(cur.Dv);
  const [F, setF] = useState(cur.F);
  const [K, setK] = useState(cur.K);
  const [rdView, setRdView] = useState<RDView>("combo");
  const [brush, setBrush] = useState<"inject" | "erase">("inject");
  const [speed, setSpeed] = useState(8);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [kind, setKind] = useState<"webgl" | "cpu">("cpu");
  const [solver, setSolver] = useState<"gs" | "fhn">("gs");
  const [thresh, setThresh] = useState(0.06);
  const [recovery, setRecovery] = useState(0.01);
  const [diffusion, setDiffusion] = useState(0.16);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvas = useRef<HTMLCanvasElement | null>(null);
  const eng = useRef(new RDEngine(CPU_N));
  const fhn = useRef(new FitzHughNagumo(120));
  const pending = useRef(0);
  const paint = useRef(false);
  const lastUi = useRef(0);
  const pick = useRef({ x: 48, y: 48, mag: 0, v: 0 });
  const framedFor = useRef("");
  const size = useCanvasResize(canvasRef);
  const cam = useInfiniteView(canvasRef, size.w);
  const rec = useLatest({ Du, Dv, F, K, view: rdView, running, speed, brush, mode, solver, thresh, recovery, diffusion });
  useEffect(() => {
    useLabPersist.getState().setLab("diff", { Du, Dv, F, K, preset, view: rdView });
  }, [Du, Dv, F, K, preset, rdView]);

  const worldSizeFor = (which: "gs" | "fhn") => (which === "fhn" ? fhn.current.n * SCALE : eng.current.n * SCALE);

  const frameView = () => {
    const c = canvasRef.current;
    if (!c) return;
    const which = rec.current.solver;
    const s = worldSizeFor(which);
    const k = Math.min(c.width / s, c.height / s) * 1.28;
    cam.lookAt(s / 2, s / 2, c.width, c.height, Math.max(0.15, k));
    framedFor.current = which;
  };

  useEffect(() => {
    const off = document.createElement("canvas");
    off.width = GL_N;
    off.height = GL_N;
    off.style.cssText = "position:fixed;left:-9999px;top:0;width:512px;height:512px;pointer-events:none;opacity:0";
    document.body.appendChild(off);
    glCanvas.current = off;
    const ok = eng.current.tryWebGL(off, GL_N);
    setKind(ok ? "webgl" : "cpu");
    if (!ok) eng.current = new RDEngine(CPU_N);
    if (seedGrid) eng.current.seedFromDensity(seedGrid, 64, 48);
    else eng.current.reset();
    framedFor.current = "";
    return () => {
      eng.current.dispose();
      off.remove();
    };
  }, [seed, seedGrid]);

  const splatAt = (e: { clientX: number; clientY: number }) => {
    if (rec.current.solver === "fhn") return;
    const pt = cam.worldFromEvent(e);
    const n = eng.current.n;
    const nx = Math.floor(pt.x / SCALE);
    const ny = Math.floor(pt.y / SCALE);
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) return;
    eng.current.splat(nx, ny, 8, rec.current.brush === "erase");
  };

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const p = rec.current;
    const { w, h } = sizeCanvas(canvas);
    if (w > 180 && h > 180 && framedFor.current !== p.solver) {
      const s0 = worldSizeFor(p.solver);
      const k0 = Math.min(canvas.width / s0, canvas.height / s0) * 1.28;
      cam.lookAt(s0 / 2, s0 / 2, canvas.width, canvas.height, Math.max(0.15, k0));
      framedFor.current = p.solver;
    }
    let n = p.running ? p.speed : pending.current;
    pending.current = 0;
    const pulse = auraLevel() || 0.12 + 0.08 * Math.sin(performance.now() * 0.002);
    if (p.solver === "fhn") {
      if (n) fhn.current.step({ threshold: p.thresh, recovery: p.recovery, diffusion: p.diffusion, audioImpact: 1 }, pulse, Math.min(6, n));
    } else if (n) {
      eng.current.step({ Du: p.Du, Dv: p.Dv, F: p.F, K: p.K, dt: 1 }, n);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    let sprite: HTMLCanvasElement | null = null;
    if (p.solver === "fhn") sprite = fhn.current.sprite(pulse);
    else if (eng.current.kind === "webgl") sprite = eng.current.glSprite(p.view);
    else sprite = eng.current.fieldSprite(p.view);
    const s = p.solver === "fhn" ? fhn.current.n * SCALE : eng.current.n * SCALE;
    cam.apply(ctx);
    ctx.imageSmoothingEnabled = false;
    if (sprite) {
      ctx.globalCompositeOperation = p.solver === "fhn" ? "source-over" : "screen";
      ctx.drawImage(sprite, 0, 0, s, s);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 2 / Math.max(0.04, cam.cam.current.k);
    ctx.strokeRect(0, 0, s, s);
    if (p.mode === "analyze") {
      ctx.strokeStyle = C.lime;
      ctx.strokeRect(s * 0.35, s * 0.35, 80, 80);
    }
    cam.identity(ctx);
    if (p.mode === "analyze") {
      ctx.fillStyle = C.yellow;
      ctx.font = "11px IBM Plex Mono";
      ctx.fillText(`∇ ${pick.current.mag.toFixed(3)}  B ${pick.current.v.toFixed(3)}`, 12, 20);
    }
    if (p.F < 0.032) setDone((d) => (d["diff-maze"] ? d : { ...d, "diff-maze": true }));
    if (preset === "spots") setDone((d) => (d["diff-spots"] ? d : { ...d, "diff-spots": true }));
    if (performance.now() - lastUi.current > 500) {
      lastUi.current = performance.now();
      setDone((d) => (d["diff-edge"] ? d : { ...d, "diff-edge": true }));
      setFps(p.running ? 60 : 0);
      setLog(p.solver === "fhn" ? `FHN // A ${p.thresh.toFixed(3)} ε ${p.recovery.toFixed(3)}` : `RD ${eng.current.kind.toUpperCase()} // F ${p.F.toFixed(3)} K ${p.K.toFixed(3)}`);
    }
  }, true);

  const apply = (id: string) => {
    const p = DIFF_PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setDu(p.Du);
    setDv(p.Dv);
    setF(p.F);
    setK(p.K);
    eng.current.reset();
  };

  const explain =
    solver === "fhn"
      ? "FitzHugh–Nagumo 把可兴奋介质写成断波。阈值下降时螺旋波会碎成湍流，AUDIO 会扰动兴奋阈值。"
      : Math.abs(Du - Dv) < 0.02
        ? "Du 与 Dv 过近，图灵条件变弱，图案趋向均匀。"
        : Dv > Du
          ? "抑制剂扩散更快，局部激活被拉开为青绿外膜与琥珀核的生物发光斑纹。"
          : "请让抑制剂扩散快于激活剂，否则斑图难以维持。";

  return (
    <LabLayout
      id="diff"
      lang={lang}
      mode={mode}
      onMode={setMode}
      explain={explain}
      step={step}
      onStep={setStep}
      done={done}
      summary={solver === "fhn" ? "FHN" : kind.toUpperCase()}
      canvas={
        <canvas
          ref={canvasRef}
          aria-label="Gray–Scott 反应扩散场"
          onPointerDown={(e) => {
            if (cam.beginPan(e)) return;
            paint.current = true;
            splatAt(e);
            if (eng.current.kind === "cpu") {
              const pt = cam.worldFromEvent(e);
              const n = eng.current.n;
              const x = Math.min(n - 1, Math.max(0, Math.floor(pt.x / SCALE)));
              const y = Math.min(n - 1, Math.max(0, Math.floor(pt.y / SCALE)));
              const s = eng.current.sampleCPU(x, y);
              pick.current = { x, y, mag: s.mag, v: s.v };
            }
          }}
          onPointerMove={(e) => {
            if (cam.movePan(e)) return;
            if (paint.current) splatAt(e);
          }}
          onPointerUp={() => {
            cam.endPan();
            paint.current = false;
          }}
          onPointerCancel={() => {
            cam.endPan();
            paint.current = false;
          }}
        />
      }
      inspector={
        <>
          <PresetSelector
            value={solver}
            options={[
              { id: "gs", label: "Gray–Scott 化学波" },
              { id: "fhn", label: "FHN 神经螺旋" },
            ]}
            onChange={(id) => {
              setSolver(id);
              framedFor.current = "";
              if (id === "fhn") fhn.current.reset();
            }}
          />
          {solver === "gs" ? (
            <>
          <PresetSelector
            value={preset}
            options={DIFF_PRESETS.map((p) => ({ id: p.id, label: lang === "zh" ? p.zh : p.en }))}
            onChange={apply}
          />
          <ParameterSlider label="Du" value={Du} min={0.01} max={0.4} step={0.002} recMin={0.12} recMax={0.18} hint="激活剂扩散" onChange={setDu} onReset={() => setDu(0.16)} />
          <ParameterSlider label="Dv" value={Dv} min={0.01} max={0.3} step={0.002} recMin={0.06} recMax={0.1} hint="抑制剂扩散" onChange={setDv} onReset={() => setDv(0.08)} />
          <ParameterSlider label="Feed F" value={F} min={0.001} max={0.14} step={0.0005} recMin={0.02} recMax={0.06} onChange={setF} onReset={() => setF(cur.F)} />
          {mode !== "learn" && (
            <ParameterSlider label="Kill K" value={K} min={0.02} max={0.12} step={0.0005} recMin={0.05} recMax={0.066} onChange={setK} onReset={() => setK(cur.K)} />
          )}
          <PresetSelector
            value={rdView}
            options={[
              { id: "combo", label: "综合" },
              { id: "A", label: "A" },
              { id: "B", label: "B" },
            ]}
            onChange={setRdView}
          />
          <PresetSelector
            value={brush}
            options={[
              { id: "inject", label: "注入 B" },
              { id: "erase", label: "擦除" },
            ]}
            onChange={setBrush}
          />
            </>
          ) : (
            <>
              <ParameterSlider label="Excitation" value={thresh} min={0.01} max={0.15} step={0.01} recMin={0.04} recMax={0.08} hint="兴奋阈值" onChange={setThresh} onReset={() => setThresh(0.06)} />
              <ParameterSlider label="Recovery" value={recovery} min={0.005} max={0.05} step={0.001} recMin={0.01} recMax={0.02} hint="恢复 / 脉冲速度" onChange={setRecovery} onReset={() => setRecovery(0.01)} />
              <ParameterSlider label="Diffusion" value={diffusion} min={0.05} max={0.4} step={0.01} recMin={0.15} recMax={0.28} hint="波前尺度" onChange={setDiffusion} onReset={() => setDiffusion(0.16)} />
            </>
          )}
          <ParameterSlider label="Steps/frame" value={speed} min={1} max={48} step={1} recMin={4} recMax={16} onChange={setSpeed} onReset={() => setSpeed(8)} />
          <ViewPanel zoom={cam.zoom} onReset={frameView} />
          <ExportDialog module="diff" canvasRef={canvasRef} params={{ Du, Dv, F, K, seed, kind }} />
        </>
      }
      timeline={
        <>
          <Transport
            onReset={() => {
              if (solver === "fhn") fhn.current.reset();
              else eng.current.reset();
            }}
            onStep={() => {
              pending.current = 1;
            }}
          />
          <MetricReadout
            items={
              solver === "fhn"
                ? [
                    { k: "BACKEND", v: "fhn" },
                    { k: "GRID", v: String(fhn.current.n) },
                    { k: "A", v: thresh.toFixed(3) },
                    { k: "ε", v: recovery.toFixed(3) },
                  ]
                : [
                    { k: "BACKEND", v: kind },
                    { k: "GRID", v: String(eng.current.n) },
                    { k: "F", v: F.toFixed(4) },
                    { k: "K", v: K.toFixed(4) },
                  ]
            }
          />
        </>
      }
    />
  );
}
