import { useEffect, useRef, useState } from "react";
import { MetricReadout, PresetSelector, Toggle } from "../../components/ControlPanel/Controls";
import { ParameterSlider } from "../../components/ControlPanel/ParameterSlider";
import { ExportDialog } from "../../components/ExportDialog/ExportDialog";
import { LabLayout } from "../../components/LabLayout/LabLayout";
import { Transport } from "../../components/Timeline/Transport";
import { useAnimationFrame, useLatest } from "../../hooks/useAnimationFrame";
import { sizeCanvas, useCanvasResize } from "../../hooks/useCanvasResize";
import { useInfiniteView } from "../../hooks/useInfiniteView";
import { ViewPanel } from "../../components/ControlPanel/ViewPanel";
import { useAppStore } from "../../store/appStore";
import { loadLab, useLabPersist } from "../../store/labPersist";
import { C, rgba } from "../../utils/color";
import { tick } from "../../utils/sound";
import { AURA, drawPyrocystis, worldInView } from "../../render/pyrocystis";
import { auraLevel } from "../../utils/auraAudio";
import type { LabMode } from "../../types";
import { FLOCK_WORLD_H, FLOCK_WORLD_W, FlockWorld, type MouseTool } from "./boidsEngine";
import { FLOCK_DEFAULT, FLOCK_PRESETS } from "./flockPresets";

export function FlockLab() {
  const lang = useAppStore((s) => s.lang);
  const seed = useAppStore((s) => s.seed);
  const running = useAppStore((s) => s.running);
  const sound = useAppStore((s) => s.sound);
  const setFps = useAppStore((s) => s.setFps);
  const setLog = useAppStore((s) => s.setLog);
  const [mode, setMode] = useState<LabMode>("experiment");
  const [step, setStep] = useState(0);
  const [params, setParams] = useState(() => loadLab("flock", { ...FLOCK_DEFAULT }));
  const [tool, setTool] = useState<MouseTool>("attract");
  const [glyph, setGlyph] = useState<"aura" | "bird" | "fish" | "drone">("aura");
  const [preset, setPreset] = useState("stable");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const holdRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef(new FlockWorld(seed));
  const mouse = useRef({ x: 0, y: 0, down: false, tool: "attract" as MouseTool });
  const tracked = useRef(0);
  const booted = useRef(false);
  const size = useCanvasResize(canvasRef);
  const view = useInfiniteView(canvasRef, size.w);
  const rec = useLatest({ params, mode, glyph, running });
  useEffect(() => {
    useLabPersist.getState().setLab("flock", params);
  }, [params]);
  const acc = useRef({ n: 0, t: performance.now() });
  const pendingStep = useRef(false);

  const frameView = () => {
    const c = canvasRef.current;
    if (!c) return;
    view.lookAt(FLOCK_WORLD_W / 2, FLOCK_WORLD_H / 2, c.width, c.height, 0.55);
  };

  const boot = () => {
    world.current = new FlockWorld(seed);
    world.current.resize(FLOCK_WORLD_W, FLOCK_WORLD_H);
    world.current.seed(params.count);
    booted.current = false;
  };

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useAnimationFrame((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeCanvas(canvas);
    if (!booted.current && w > 180 && h > 180) {
      if (!world.current.boids.length) boot();
      frameView();
      booted.current = true;
    }
    const p = rec.current.params;
    mouse.current.tool = tool;
    if (rec.current.running || pendingStep.current) {
      world.current.step(dt, p, mouse.current);
      pendingStep.current = false;
    }
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    view.apply(ctx);
    ctx.strokeStyle = "rgba(0, 240, 255, 0.18)";
    ctx.strokeRect(0, 0, FLOCK_WORLD_W, FLOCK_WORLD_H);
    const pulse = auraLevel() || 0.14 + 0.1 * Math.sin(performance.now() * 0.0022);
    world.current.obstacles.forEach((o) => {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.strokeStyle = C.coral;
      ctx.stroke();
    });
    if (world.current.predator) {
      drawPyrocystis(ctx, world.current.predator.x, world.current.predator.y, 22, 0, pulse, {
        core: true,
        highlight: true,
        detail: "body",
        mutant: true,
      });
    }
    const list = world.current.boids;
    const k = view.cam.current.k;
    const cam = view.cam.current;
    list.forEach((b, i) => {
      if (!worldInView(b.x, b.y, cam, w, h, 40)) return;
      const ang = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      const g = rec.current.glyph;
      if (g === "aura" || g === "fish" || g === "bird") {
        drawPyrocystis(ctx, b.x, b.y, g === "fish" ? 26 : 22, ang, pulse, {
          core: i === tracked.current || g === "aura",
          highlight: i === tracked.current,
          detail: k > 0.9 && list.length < 140 ? "full" : k > 0.42 ? "body" : "spark",
        });
      } else {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(ang - Math.PI / 2);
        ctx.strokeStyle = i === tracked.current ? AURA.cyan : C.paper;
        ctx.lineWidth = 1 / k;
        ctx.strokeRect(-5, -5, 10, 10);
        ctx.restore();
      }
      if (rec.current.mode === "analyze" && i === tracked.current) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.strokeStyle = rgba(C.ash, 0.7);
        ctx.lineWidth = 1 / k;
        ctx.beginPath();
        ctx.arc(0, 0, p.vis, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = C.coral;
        ctx.beginPath();
        ctx.arc(0, 0, p.protect, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });
    view.identity(ctx);
    const m = world.current.metrics;
    if (m.polarity > 0.72 && m.avgNeighbors > 3) {
      holdRef.current += dt;
      if (holdRef.current > 2.5) setDone((d) => (d["flock-stable"] ? d : { ...d, "flock-stable": true }));
    } else holdRef.current = 0;
    if (world.current.obstacles.length >= 2) {
      const gap = world.current.boids.filter((b) => Math.abs(b.x - FLOCK_WORLD_W / 2) < 18).length;
      if (gap > params.count * 0.2) setDone((d) => ({ ...d, "flock-gap": true }));
    }
    if (world.current.predator && m.collisions < 8) setDone((d) => ({ ...d, "flock-predator": true }));
    acc.current.n++;
    if (performance.now() - acc.current.t > 400) {
      setFps((acc.current.n * 1000) / (performance.now() - acc.current.t));
      acc.current = { n: 0, t: performance.now() };
      setLog(`SYSTEM STABLE // ${list.length} AGENTS // WORLD ${FLOCK_WORLD_W}×${FLOCK_WORLD_H}`);
    }
  }, true);

  const set = (patch: Partial<typeof params>) => setParams((q) => ({ ...q, ...patch }));
  const explain =
    !params.enableSep
      ? "分离关闭后个体互相穿透，碰撞计数会上升。"
      : params.coh > params.sep
        ? "凝聚权重大于分离，群体正在形成高密度聚集。"
        : params.ali > 1.6
          ? "对齐很高：云团被拉成平行鱼群。"
          : "世界远大于视口。提高感知与数量后群体会在平面上延申，滚轮跟随即可。";

  return (
    <LabLayout
      id="flock"
      lang={lang}
      mode={mode}
      onMode={setMode}
      explain={explain}
      step={step}
      onStep={setStep}
      done={done}
      summary={`${world.current.boids.length} agents`}
      canvas={
        <canvas
          ref={canvasRef}
          aria-label="Boids 群集观测窗"
          onPointerDown={(e) => {
            if (view.beginPan(e)) return;
            const pt = view.worldFromEvent(e);
            mouse.current = { ...pt, down: true, tool };
            if (tool === "obstacle") world.current.addObstacle(pt.x, pt.y);
            const i = world.current.boids.reduce((best, b, idx) => {
              const d = Math.hypot(b.x - pt.x, b.y - pt.y);
              return d < best.d ? { i: idx, d } : best;
            }, { i: 0, d: 1e9 });
            tracked.current = i.i;
            tick(sound, "click");
          }}
          onPointerMove={(e) => {
            if (view.movePan(e)) return;
            const pt = view.worldFromEvent(e);
            mouse.current.x = pt.x;
            mouse.current.y = pt.y;
          }}
          onPointerUp={() => {
            view.endPan();
            mouse.current.down = false;
          }}
          onPointerCancel={() => {
            view.endPan();
            mouse.current.down = false;
          }}
        />
      }
      inspector={
        <>
          <h3>PRESET</h3>
          <PresetSelector
            value={preset}
            options={FLOCK_PRESETS.map((p) => ({ id: p.id, label: lang === "zh" ? p.zh : p.en }))}
            onChange={(id) => {
              setPreset(id);
              const p = FLOCK_PRESETS.find((x) => x.id === id)!;
              set({ ...FLOCK_DEFAULT, ...p.params });
            }}
          />
          <h3>RULES</h3>
          <div className="seg">
            <Toggle label="SEP" on={params.enableSep} onChange={(v) => set({ enableSep: v })} />
            <Toggle label="ALI" on={params.enableAli} onChange={(v) => set({ enableAli: v })} />
            <Toggle label="COH" on={params.enableCoh} onChange={(v) => set({ enableCoh: v })} />
          </div>
          <ParameterSlider label="Separation" value={params.sep} min={0} max={8} recMin={0.8} recMax={1.8} hint="近距排斥" onChange={(v) => set({ sep: v })} onReset={() => set({ sep: 1.4 })} />
          <ParameterSlider label="Alignment" value={params.ali} min={0} max={8} recMin={0.6} recMax={1.8} hint="航向对齐" onChange={(v) => set({ ali: v })} onReset={() => set({ ali: 1 })} />
          {mode !== "learn" && (
            <>
              <ParameterSlider label="Cohesion" value={params.coh} min={0} max={8} recMin={0.5} recMax={1.4} hint="质心吸引" onChange={(v) => set({ coh: v })} onReset={() => set({ coh: 0.9 })} />
              <ParameterSlider label="Perception" value={params.vis} min={8} max={480} step={1} unit="px" onChange={(v) => set({ vis: v })} onReset={() => set({ vis: 72 })} />
              <ParameterSlider label="Protect" value={params.protect} min={4} max={220} step={1} unit="px" onChange={(v) => set({ protect: v })} onReset={() => set({ protect: 22 })} />
              <ParameterSlider label="Max speed" value={params.maxSpeed} min={10} max={800} step={1} onChange={(v) => set({ maxSpeed: v })} onReset={() => set({ maxSpeed: 140 })} />
              <ParameterSlider label="Max force" value={params.maxForce} min={40} max={1400} step={1} onChange={(v) => set({ maxForce: v })} onReset={() => set({ maxForce: 280 })} />
              <ParameterSlider label="Count" value={params.count} min={8} max={480} step={1} hint=">80 启用空间哈希" onChange={(v) => set({ count: v })} onReset={() => set({ count: 70 })} />
            </>
          )}
          <h3>TOOL</h3>
          <PresetSelector
            value={tool}
            options={[
              { id: "attract", label: "吸引" },
              { id: "repel", label: "排斥" },
              { id: "obstacle", label: "障碍" },
            ]}
            onChange={setTool}
          />
          <PresetSelector
            value={glyph}
            options={[
              { id: "aura", label: "梭梨甲藻" },
              { id: "bird", label: "鸟" },
              { id: "fish", label: "鱼" },
              { id: "drone", label: "无人机" },
            ]}
            onChange={setGlyph}
          />
          <Toggle
            label="PREDATOR"
            on={!!world.current.predator}
            onChange={(v) => world.current.setPredator(v)}
          />
          <ViewPanel zoom={view.zoom} onReset={frameView} />
          <ExportDialog module="flock" canvasRef={canvasRef} params={params} />
        </>
      }
      timeline={
        <>
          <Transport onReset={boot} onStep={() => { pendingStep.current = true; }} />
          <MetricReadout
            items={[
              { k: "NEIGHBORS", v: world.current.metrics.avgNeighbors.toFixed(1) },
              { k: "POLARITY", v: world.current.metrics.polarity.toFixed(2) },
              { k: "COLLISIONS", v: String(world.current.metrics.collisions) },
              { k: "CENTER V", v: world.current.metrics.centerSpeed.toFixed(1) },
            ]}
          />
        </>
      }
    />
  );
}
