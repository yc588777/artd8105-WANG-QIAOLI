import { useMemo, useRef, useState, useEffect } from "react";
import { MetricReadout, PresetSelector, Toggle } from "../../components/ControlPanel/Controls";
import { ParameterSlider } from "../../components/ControlPanel/ParameterSlider";
import { ExportDialog } from "../../components/ExportDialog/ExportDialog";
import { LabLayout } from "../../components/LabLayout/LabLayout";
import { Transport } from "../../components/Timeline/Transport";
import { useAnimationFrame } from "../../hooks/useAnimationFrame";
import { sizeCanvas, useCanvasResize } from "../../hooks/useCanvasResize";
import { useInfiniteView } from "../../hooks/useInfiniteView";
import { ViewPanel } from "../../components/ControlPanel/ViewPanel";
import { useAppStore } from "../../store/appStore";
import { useLabPersist } from "../../store/labPersist";
import { downloadSvg, downloadText, stampName } from "../../utils/exportCanvas";
import { C } from "../../utils/color";
import { SeededRandom } from "../../utils/seededRandom";
import { AURA, drawAuraFilament, drawPyrocystis, worldInView } from "../../render/pyrocystis";
import { auraLevel } from "../../utils/auraAudio";
import type { LabMode } from "../../types";
import { expandLSystem, parseRules, rulesToText } from "./lsystemEngine";
import { GROW_PRESETS } from "./growPresets";
import { hitSegmentWorld, segsToSvg, turtleWalk } from "./turtleRenderer";

export function GrowLab() {
  const lang = useAppStore((s) => s.lang);
  const seed = useAppStore((s) => s.seed);
  const running = useAppStore((s) => s.running);
  const setFps = useAppStore((s) => s.setFps);
  const setLog = useAppStore((s) => s.setLog);
  const [mode, setMode] = useState<LabMode>("experiment");
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState("fern");
  const sys = GROW_PRESETS.find((p) => p.id === preset) ?? GROW_PRESETS[0]!;
  const [axiom, setAxiom] = useState(sys.axiom);
  const [ruleText, setRuleText] = useState(rulesToText(sys.rules));
  const [iters, setIters] = useState(sys.iters);
  const [angle, setAngle] = useState(sys.angle);
  const [stepLen, setStepLen] = useState(8);
  const [jitter, setJitter] = useState(0);
  const [wind, setWind] = useState(0);
  const [light, setLight] = useState(0);
  const [playGen, setPlayGen] = useState(sys.iters);
  const [obs, setObs] = useState<{ x: number; y: number; r: number }[]>([]);
  const [hit, setHit] = useState(-1);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastUi = useRef(0);
  const fitKey = useRef("");
  const size = useCanvasResize(canvasRef);
  const view = useInfiniteView(canvasRef, size.w);

  useEffect(() => {
    useLabPersist.getState().setLab("grow", { axiom, ruleText, iters, angle, preset });
  }, [axiom, ruleText, iters, angle, preset]);
  const rng = useMemo(() => new SeededRandom(seed), [seed]);

  const derived = useMemo(() => {
    const rules = parseRules(ruleText);
    return expandLSystem(axiom, rules, iters, () => rng.next());
  }, [axiom, ruleText, iters, rng, seed]);

  const geo = useMemo(() => {
    return turtleWalk(derived.str, {
      angle,
      step: stepLen,
      wind,
      light,
      obstacles: obs,
      jitter,
      rnd: () => rng.next(),
    });
  }, [derived, angle, stepLen, wind, light, obs, jitter, rng]);

  const peakGen = useMemo(() => {
    let m = 1;
    for (const s of geo.segs) if (s.gen > m) m = s.gen;
    return Math.max(m, playGen);
  }, [geo, playGen]);

  const fitCurrent = () => {
    const canvas = canvasRef.current;
    if (!canvas || !geo.segs.length) return;
    view.fitWorld(geo.minX, geo.minY, geo.maxX, geo.maxY, canvas.width, canvas.height);
  };

  useAnimationFrame((_, now) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeCanvas(canvas);
    const audioLevel = auraLevel() || 0.14 + 0.1 * Math.sin(now * 0.0022);
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    const key = `${preset}-${seed}`;
    if (fitKey.current !== key && geo.segs.length && w > 180 && h > 180) {
      view.fitWorld(geo.minX, geo.minY, geo.maxX, geo.maxY, w, h);
      fitKey.current = key;
    }
    view.apply(ctx);
    ctx.lineCap = "round";
    const cam = view.cam.current;
    const lw = Math.max(1.05, 2.1 / cam.k);
    ctx.lineWidth = lw;
    const tips: typeof geo.segs = [];
    for (let i = 0; i < geo.segs.length; i++) {
      const s = geo.segs[i]!;
      if (s.gen > playGen) continue;
      const mx = (s.x1 + s.x2) * 0.5;
      const my = (s.y1 + s.y2) * 0.5;
      if (!worldInView(mx, my, cam, w, h, 64)) continue;
      const phase = Math.sin(i * 0.1 - now * 0.005) > 0.45;
      drawAuraFilament(ctx, s.x1, s.y1, s.x2, s.y2, audioLevel, s.gen >= peakGen - 1 || phase, i === hit);
      if (s.gen >= peakGen - 2 || phase || i === hit) tips.push(s);
    }
    const stride = Math.max(1, Math.ceil(tips.length / 360));
    const zoomed = cam.k > 0.55;
    for (let i = 0; i < tips.length; i += stride) {
      const s = tips[i]!;
      const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1) + Math.PI / 2;
      const sz = Math.max(10, Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * 2.15);
      drawPyrocystis(ctx, (s.x1 + s.x2) * 0.5, (s.y1 + s.y2) * 0.5, sz, ang, audioLevel, {
        core: true,
        highlight: i === 0 || Math.sin(i * 0.1 - now * 0.005) > 0.5,
        detail: zoomed && tips.length < 120 ? "full" : "body",
      });
    }
    ctx.strokeStyle = C.yellow;
    ctx.lineWidth = lw;
    for (const o of obs) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    view.identity(ctx);
    if (hit >= 0 && geo.segs[hit] && mode === "analyze") {
      const s = geo.segs[hit]!;
      ctx.fillStyle = C.blue;
      ctx.font = "11px IBM Plex Mono";
      ctx.fillText(`${s.symbol} GEN ${s.gen} PARENT ${s.parent}`, 12, 20);
    }
    if (iters >= 4 && geo.segs.length > 40) setDone((d) => (d["grow-canopy"] ? d : { ...d, "grow-canopy": true }));
    if (wind > 8 && geo.segs.length > 10) setDone((d) => (d["grow-wind"] ? d : { ...d, "grow-wind": true }));
    if (obs.length) setDone((d) => (d["grow-bound"] ? d : { ...d, "grow-bound": true }));
    if (now - lastUi.current > 400) {
      lastUi.current = now;
      setFps(60);
      if (running) setLog(`L-SYS // ${derived.str.length} SYMBOLS${derived.truncated ? " // TRUNCATED" : ""}`);
    }
  }, true);

  const explain =
    derived.truncated
      ? "迭代次数增加导致字符串指数增长，已触发安全截断；形态继续向视口外延申。"
      : wind > 0
        ? "风向使海龟航向偏移，新枝向一侧倾斜。"
        : "提高迭代与步长后分枝会越过画面，而不是被重新装进视口。";

  const apply = (id: string) => {
    const p = GROW_PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setAxiom(p.axiom);
    setRuleText(rulesToText(p.rules));
    setAngle(p.angle);
    setIters(p.iters);
    setPlayGen(p.iters);
    fitKey.current = "";
  };

  return (
    <LabLayout
      id="grow"
      lang={lang}
      mode={mode}
      onMode={setMode}
      explain={explain}
      step={step}
      onStep={setStep}
      done={done}
      summary={`${derived.str.length} symbols`}
      canvas={
        <canvas
          ref={canvasRef}
          aria-label="L-system 海龟绘图"
          onPointerDown={(e) => {
            if (view.beginPan(e)) return;
            const pt = view.worldFromEvent(e);
            if (e.shiftKey) {
              setObs((o) => [...o, { x: pt.x, y: pt.y, r: 28 }]);
              return;
            }
            const thresh = 14 / Math.max(0.04, view.cam.current.k);
            setHit(hitSegmentWorld(geo, pt.x, pt.y, thresh));
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
            value={preset}
            options={GROW_PRESETS.map((p) => ({ id: p.id, label: lang === "zh" ? p.zh : p.en }))}
            onChange={apply}
          />
          <label className="param">
            公理
            <input value={axiom} onChange={(e) => setAxiom(e.target.value)} />
          </label>
          <label className="param">
            产生式
            <textarea rows={5} value={ruleText} onChange={(e) => setRuleText(e.target.value)} />
          </label>
          <ParameterSlider
            label="Iterations"
            value={iters}
            min={1}
            max={12}
            step={1}
            recMin={2}
            recMax={6}
            hint="升高后向画面外生长，不回缩视口"
            onChange={(v) => {
              setIters(v);
              setPlayGen(v);
            }}
            onReset={() => setIters(sys.iters)}
          />
          <ParameterSlider label="Angle" value={angle} min={1} max={180} step={0.1} unit="°" recMin={15} recMax={90} onChange={setAngle} onReset={() => setAngle(sys.angle)} />
          {mode !== "learn" && (
            <>
              <ParameterSlider label="Step" value={stepLen} min={1} max={64} step={0.5} recMin={4} recMax={16} onChange={setStepLen} onReset={() => setStepLen(8)} />
              <ParameterSlider label="Random" value={jitter} min={0} max={1.2} hint="随机 L-system 抖动" onChange={setJitter} onReset={() => setJitter(0)} />
              <ParameterSlider label="Wind" value={wind} min={-80} max={80} step={1} onChange={setWind} onReset={() => setWind(0)} />
              <ParameterSlider label="Light" value={light} min={-80} max={80} step={1} onChange={setLight} onReset={() => setLight(0)} />
            </>
          )}
          <p className="muted">Shift+点击放置障碍（世界坐标）</p>
          <Toggle label="逐代高亮" on={playGen < iters} onChange={(v) => setPlayGen(v ? Math.max(1, iters - 1) : iters)} />
          <ViewPanel zoom={view.zoom} onReset={fitCurrent} />
          <ExportDialog
            module="grow"
            canvasRef={canvasRef}
            params={{ axiom, ruleText, iters, angle, seed }}
            extra={
              <>
                <button type="button" onClick={() => downloadSvg(segsToSvg(geo), "GROW", seed)}>
                  SVG
                </button>
                <button
                  type="button"
                  onClick={() => downloadText(`${axiom}\n${ruleText}`, stampName("GROW", seed, "txt"))}
                >
                  RULES
                </button>
              </>
            }
          />
        </>
      }
      timeline={
        <>
          <Transport
            onReset={() => apply(preset)}
            onStep={() => setPlayGen((g) => Math.min(iters, g + 1))}
          />
          <MetricReadout
            items={[
              { k: "LEN", v: String(derived.str.length) },
              { k: "SEGS", v: String(geo.segs.length) },
              { k: "GEN", v: String(playGen) },
            ]}
          />
          <p className="seq">{derived.str.slice(0, 180)}{derived.str.length > 180 ? "…" : ""}</p>
        </>
      }
    />
  );
}
