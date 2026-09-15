import { useEffect, useMemo, useRef, useState } from "react";
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
import { C } from "../../utils/color";
import { SeededRandom } from "../../utils/seededRandom";
import { tick } from "../../utils/sound";
import { AURA, drawPyrocystis } from "../../render/pyrocystis";
import { auraLevel } from "../../utils/auraAudio";
import type { LabMode } from "../../types";
import {
  TRAIT_ORDER,
  TRAITS,
  encodeGeneCode,
  genotypeProbs,
  jointGenotypeProb,
  makeOffspring,
  mapGeneToWorld,
  offTargetRisk,
  editLocus,
  phenotypeOf,
  phenotypeProbs,
  type Allele,
  type GeneCode,
  type Inheritance,
  type Parent,
  type Pair,
  type TraitId,
} from "./geneticsEngine";
import { GENE_PRESETS } from "./genePresets";

function setPair(p: Parent, id: TraitId, pair: Pair): Parent {
  return { ...p, alleles: { ...p.alleles, [id]: pair } };
}

function drawPlant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  ph: Record<TraitId, ReturnType<typeof phenotypeOf>>,
  mutant = false,
  audioLevel = 0.15,
) {
  const arms = ph.branch === "dominant" ? 7 : ph.branch === "mixed" ? 5 : 3;
  const size = (ph.leaf === "dominant" ? 22 : ph.leaf === "mixed" ? 18 : 14) * s;
  drawPyrocystis(ctx, x, y, size, -Math.PI / 2, audioLevel, {
    core: ph.pigment !== "recessive",
    highlight: ph.pigment === "mixed",
    detail: s > 1.5 ? "full" : "body",
    mutant,
  });
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = mutant ? "rgba(255,100,40,0.45)" : "rgba(0,240,255,0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i < arms; i++) {
    const a = -Math.PI / 2 + (i - (arms - 1) / 2) * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 26 * s, Math.sin(a) * 26 * s);
    ctx.stroke();
    drawPyrocystis(ctx, Math.cos(a) * 24 * s, Math.sin(a) * 22 * s, 7 * s, a + Math.PI / 2, audioLevel, {
      core: false,
      detail: "spark",
      mutant,
    });
  }
  ctx.restore();
}

export function GeneLab() {
  const lang = useAppStore((s) => s.lang);
  const seed = useAppStore((s) => s.seed);
  const running = useAppStore((s) => s.running);
  const sound = useAppStore((s) => s.sound);
  const setLog = useAppStore((s) => s.setLog);
  const setFps = useAppStore((s) => s.setFps);
  const [mode, setMode] = useState<LabMode>("experiment");
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState(() => loadLab("gene", { preset: "mendel", mut: 0 }).preset);
  const [parents, setParents] = useState<[Parent, Parent]>(GENE_PRESETS[0]!.code.parents);
  const [inh, setInh] = useState<Record<TraitId, Inheritance>>(GENE_PRESETS[0]!.code.inheritance);
  const [mut, setMut] = useState(0);
  const [edit, setEdit] = useState(false);
  const [locus, setLocus] = useState<TraitId>("leaf");
  const [nKids, setNKids] = useState(24);
  const [kids, setKids] = useState<ReturnType<typeof makeOffspring>[]>([]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const booted = useRef(false);
  const size = useCanvasResize(canvasRef);
  const cam = useInfiniteView(canvasRef, size.w);
  useEffect(() => {
    useLabPersist.getState().setLab("gene", { preset, parents, inh, mut });
  }, [preset, parents, inh, mut]);
  const rng = useMemo(() => new SeededRandom(seed), [seed]);
  const seq = useMemo(
    () =>
      encodeGeneCode({
        version: 1,
        seed,
        mutationRate: mut,
        inheritance: inh,
        parents,
      }),
    [seed, mut, inh, parents],
  );

  const frameView = () => {
    const c = canvasRef.current;
    if (!c) return;
    cam.lookAt(720, 360, c.width, c.height, 0.9);
  };

  const sample = () => {
    const rnd = () => rng.next();
    const batch = Array.from({ length: nKids }, () => makeOffspring(parents[0], parents[1], mut, rnd));
    setKids(batch);
    if (batch.some((k) => k.mutated.length)) {
      setDone((d) => ({ ...d, "gene-mutate": true }));
      tick(sound, "done");
    }
  };

  useEffect(() => {
    sample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parents, mut, seed, nKids]);

  const rec = useLatest({ kids, parents, inh, mut, edit, locus, mode });
  const frames = useRef({ n: 0, t: performance.now() });

  useAnimationFrame((_dt, now) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeCanvas(canvas);
    if (!booted.current && w > 180 && h > 180) {
      frameView();
      booted.current = true;
    }
    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    cam.apply(ctx);
    const pulse = auraLevel() || 0.14 + 0.1 * Math.sin(now * 0.0022);
    const st = rec.current;
    const phOf = (p: Parent) => {
      const o = {} as Record<TraitId, ReturnType<typeof phenotypeOf>>;
      for (const id of TRAIT_ORDER) o[id] = phenotypeOf(p.alleles[id], st.inh[id]);
      return o;
    };
    drawPlant(ctx, 120, 220, 2.2, phOf(st.parents[0]), false, pulse);
    drawPlant(ctx, 120, 460, 2.2, phOf(st.parents[1]), false, pulse);
    ctx.fillStyle = C.ash;
    ctx.font = "11px IBM Plex Mono";
    ctx.fillText("P0", 110, 270);
    ctx.fillText("P1", 110, 510);

    const leafP = genotypeProbs(st.parents[0].alleles.leaf, st.parents[1].alleles.leaf);
    void leafP;
    ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
    ctx.strokeRect(280, 80, 220, 160);
    ctx.fillStyle = C.paper;
    ctx.fillText("PUNNETT // LEAF", 280, 70);
    const pcells = [
      st.parents[0].alleles.leaf[0],
      st.parents[0].alleles.leaf[1],
    ];
    const qcells = [
      st.parents[1].alleles.leaf[0],
      st.parents[1].alleles.leaf[1],
    ];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const x = 300 + c * 70;
        const y = 100 + r * 50;
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(x, y, 66, 44);
        ctx.fillStyle = C.paper;
        ctx.fillText(`${pcells[c]}${qcells[r]}`.replace("aA", "Aa"), x + 18, y + 26);
      }
    }

    st.kids.forEach((k, i) => {
      const ph = {} as Record<TraitId, ReturnType<typeof phenotypeOf>>;
      for (const id of TRAIT_ORDER) ph[id] = phenotypeOf(k.alleles[id], st.inh[id]);
      drawPlant(ctx, 560 + (i % 8) * 110, 200 + Math.floor(i / 8) * 130, 1.1, ph, k.mutated.length > 0, pulse);
    });

    if (st.edit) {
      ctx.strokeStyle = C.coral;
      ctx.strokeRect(260, 280, 160, 28);
      ctx.fillStyle = C.coral;
      ctx.fillText(`EDIT LOCUS ${st.locus.toUpperCase()}`, 270, 300);
    }
    cam.identity(ctx);
    ctx.fillStyle = C.paper;
    ctx.font = "12px Space Mono";
    ctx.fillText(seq, 16, h - 18);
    frames.current.n++;
    if (now - frames.current.t > 400) {
      setFps((frames.current.n * 1000) / (now - frames.current.t));
      frames.current = { n: 0, t: now };
    }
  }, running || true);

  const recPheno = phenotypeProbs(parents[0].alleles.leaf, parents[1].alleles.leaf, inh.leaf);
  const pointed = recPheno.find((x) => x.value === "recessive")?.p ?? 0;
  useEffect(() => {
    if (pointed >= 0.5) setDone((d) => ({ ...d, "gene-recessive": true }));
    if (Object.values(inh).includes("codominant")) setDone((d) => ({ ...d, "gene-codominant": true }));
  }, [pointed, inh]);

  const explain =
    mut > 0.1
      ? "突变率偏高，子代序列会偏离潘尼特理论频率。"
      : inh.leaf === "codominant"
        ? "叶片为共显性：杂合呈现中间形态，而不是完全遮盖。"
        : pointed >= 0.5
          ? "两个亲本都向子代提供隐性等位基因，尖叶理论概率升高。"
          : "当前接近经典孟德尔：显性表现型占表格的多数格子。";

  const applyPreset = (id: string) => {
    const p = GENE_PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setParents(p.code.parents);
    setInh(p.code.inheritance);
    setMut(p.code.mutationRate);
  };

  const code: GeneCode = { version: 1, seed, mutationRate: mut, inheritance: inh, parents };
  const mapped = mapGeneToWorld(code);
  void mapped;

  const alleleBtn = (who: 0 | 1, trait: TraitId, idx: 0 | 1) => (
    <button
      type="button"
      className={parents[who].alleles[trait][idx] === "A" ? "active" : ""}
      onClick={() => {
        const next = parents[who].alleles[trait][idx] === "A" ? "a" : "A";
        const pair = [...parents[who].alleles[trait]] as Pair;
        pair[idx] = next as Allele;
        const copy: [Parent, Parent] = [...parents];
        copy[who] = setPair(parents[who], trait, pair);
        setParents(copy);
      }}
    >
      {parents[who].alleles[trait][idx]}
    </button>
  );

  return (
    <LabLayout
      id="gene"
      lang={lang}
      mode={mode}
      onMode={setMode}
      explain={explain}
      step={step}
      onStep={setStep}
      done={done}
      summary="抽象生物体 · 非临床模拟"
      canvas={
        <canvas
          ref={canvasRef}
          aria-label="遗传规则观测窗：亲本、潘尼特方格与子代样本"
          onPointerDown={(e) => {
            if (cam.beginPan(e)) return;
            if (!edit) return;
            const risk = offTargetRisk(0.7, 1);
            const res = editLocus(parents[0].alleles[locus], "A", risk, () => rng.next());
            const copy: [Parent, Parent] = [...parents];
            copy[0] = setPair(parents[0], locus, res.pair);
            setParents(copy);
            setLog(res.offTargetHit ? "EDIT OFF-TARGET // CONCEPTUAL" : "EDIT HDR-LIKE REPAIR");
            tick(sound, "scan");
          }}
          onPointerMove={(e) => cam.movePan(e)}
          onPointerUp={cam.endPan}
          onPointerCancel={cam.endPan}
        />
      }
      inspector={
        <>
          <h3>PRESET</h3>
          <PresetSelector
            value={preset}
            options={GENE_PRESETS.map((p) => ({ id: p.id, label: lang === "zh" ? p.zh : p.en }))}
            onChange={applyPreset}
          />
          {TRAIT_ORDER.map((id) => (
            <div key={id}>
              <h3>{TRAITS[id].zh}</h3>
              <p>
                P0 {alleleBtn(0, id, 0)}
                {alleleBtn(0, id, 1)} · P1 {alleleBtn(1, id, 0)}
                {alleleBtn(1, id, 1)}
              </p>
              {(mode !== "learn" || id === "leaf") && (
                <PresetSelector
                  value={inh[id]}
                  options={[
                    { id: "dominant", label: "显性" },
                    { id: "recessive", label: "隐性映射" },
                    { id: "codominant", label: "共显性" },
                  ]}
                  onChange={(v) => setInh({ ...inh, [id]: v })}
                />
              )}
            </div>
          ))}
          <ParameterSlider
            label="Offspring"
            value={nKids}
            min={4}
            max={64}
            step={1}
            recMin={8}
            recMax={24}
            hint="子代铺开到视口外"
            onChange={setNKids}
            onReset={() => setNKids(24)}
          />
          <ParameterSlider
            label="Mutation"
            value={mut}
            min={0}
            max={0.95}
            step={0.01}
            hint="子代等位基因翻转概率"
            recMin={0}
            recMax={0.08}
            onChange={setMut}
            onReset={() => setMut(0)}
          />
          <ViewPanel zoom={cam.zoom} onReset={frameView} />
          <Toggle label="EDIT MODE" on={edit} onChange={setEdit} />
          {edit && (
            <>
              <p className="warn">概念模拟，不代表临床脱靶数据。风险 {(offTargetRisk(0.7, 1) * 100).toFixed(0)}%</p>
              <PresetSelector
                value={locus}
                options={TRAIT_ORDER.map((id) => ({ id, label: TRAITS[id].zh }))}
                onChange={setLocus}
              />
            </>
          )}
          <MetricReadout
            items={[
              { k: "AA/Aa/aa leaf", v: genotypeProbs(parents[0].alleles.leaf, parents[1].alleles.leaf).map((x) => `${x.value}:${(x.p * 100).toFixed(0)}%`).join(" ") },
              { k: "尖叶概率", v: `${(pointed * 100).toFixed(0)}%` },
              { k: "联合基因型", v: String(jointGenotypeProb(parents[0], parents[1]).length) },
            ]}
          />
          <p className="seq">{seq}</p>
          <ExportDialog module="gene" canvasRef={canvasRef} params={code} />
        </>
      }
      timeline={
        <>
          <Transport
            onReset={() => {
              applyPreset(preset);
              sample();
            }}
            onStep={sample}
          />
          <MetricReadout items={[{ k: "SAMPLES", v: String(kids.length) }, { k: "MUT EVENTS", v: String(kids.filter((k) => k.mutated.length).length) }]} />
        </>
      }
    />
  );
}
