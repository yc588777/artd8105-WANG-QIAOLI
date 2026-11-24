import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ExportBlocked,
  fetchPlan,
  fetchPreview,
  type Issue,
  downloadEffectImage,
  generate,
  getBaseline,
  parseStl,
  type LayerPreset,
  type WeaveLayer,
  type WeaveParams,
} from "./api";
import { presetLabel, translate, type Lang } from "./i18n";
import { Viewer } from "./Viewer";
import { SessionBar } from "./SessionBar";
import { GatePanel } from "./GatePanel";
import { CrossingView } from "./CrossingView";
import { logEvent } from "./sessionLog";

const ZONES = ["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"];
const PATTERNS = [
  ["radial", "放射星纹"],
  ["diamond", "旋转菱纹"],
  ["ripple", "涟漪"],
  ["cellular", "笼目网纹"],
  ["blank", "素面灰边"],
  ["plain", "平纹"],
] as const;

const emptyZones = () => Object.fromEntries(ZONES.map((id) => [id, { enabled: true }]));

function freshParams(): WeaveParams {
  return {
    pattern: "diamond",
    t_min: 0,
    t_max: 2.2,
    allow_extra_thickness: true,
    rim_width: 5.8,
    rim_depth: 7,
    ribbon_thickness: 1.2,
    contrast: 1.35,
    dark_levels: 5,
    smoothness: 0.15,
    invert: false,
    density_u: 1.55,
    density_v: 1.55,
    strand_width_u: 1.6,
    strand_width_v: 1.6,
    relief: 0.75,
    cell_aspect: 1,
    stagger: 0,
    weave_angle: 0,
    frequency: 1.4,
    amplitude: 2.4,
    randomness: 0,
    seed: 5205,
    blend_radius: 14,
    target_height: 180,
    frame_mm: 2.6,
    geometry_lock: true,
    print_safe: true,
    show_master: false,
    diff_only: false,
    preset: "rotating-diamond-reference",
    support_level: "off",
    support_density: 0,
    support_motif: "bar-h",
    support_motifs: ["bar-h"],
    support_size: 3.2,
    layers: [
      {
        id: "L2",
        name: "主图案",
        enabled: true,
        visible: true,
        locked: false,
        solo: false,
        algorithm: "rotating-diamond",
        seed: 5205,
        density: 1.15,
        strip_width: 2.6,
        priority: 2,
        tone: "light",
        crossing_lift: 1.8,
        diamond_part: "both",
        pattern_angle: 0,
        edge_compression: 0.42,
        rotation_strength: 0.28,
        center_spacing: 4.8,
        direction_a: 0,
        direction_b: 0,
        arc_a: 18,
        arc_b: -18,
        edge_spacing: 3.4,
        secondary_strength: 0.7,
        structural_strength: 0,
        binder_density: 0,
      },
    ],
    crossing_locks: [],
    zones: emptyZones(),
    polygons: [],
    brush: null,
  };
}

const STORAGE_KEY = "haitang-weave-params-v8";
const LANG_KEY = "haitang-weave-lang";

function storedLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "en" || saved === "zh-Hans" || saved === "zh-Hant") return saved;
  return "zh-Hant";
}
const PATTERN_IDS = ["rotating-diamond-reference", "radial-star", "ripple-wave", "cellular-growth"] as const;

export function App() {
  const [lang, setLang] = useState<Lang>(storedLang);
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const [tab, setTab] = useState<"design" | "handle" | "print" | "library" | "help">("design");
  const [params, setParams] = useState<WeaveParams>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...freshParams(), ...JSON.parse(saved) };
    } catch {
      /* keep defaults */
    }
    return freshParams();
  });
  const [zone, setZone] = useState("C");
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [mesh, setMesh] = useState<{ positions: Float32Array; indices: Uint32Array; colors: Float32Array | null } | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [baseline, setBaseline] = useState<Record<string, unknown> | null>(null);
  const [original, setOriginal] = useState<Float32Array | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [quality, setQuality] = useState("recommended");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [planMode, setPlanMode] = useState<"plan" | "cross">("plan");
  const [refusal, setRefusal] = useState<{ issues: Issue[]; quality: string } | null>(null);
  const [presets, setPresets] = useState<{ id: string; name: string; params: WeaveParams }[]>([]);
  const [layerPresets, setLayerPresets] = useState<LayerPreset[]>([]);
  const [layerIndex, setLayerIndex] = useState(1);
  const [calibrate, setCalibrate] = useState(window.location.pathname.includes("fan-calibration"));
  const [presetName, setPresetName] = useState("未命名织序");
  const [handleInfo, setHandleInfo] = useState<Record<string, unknown> | null>(null);
  const [align, setAlign] = useState({ dx: -300, dy: -20, dz: 0, rz_deg: 0 });

  useEffect(() => {
    getBaseline().then(setBaseline).catch((err) => setError(String(err)));
    fetch("/api/presets").then((r) => r.json()).then(setPresets).catch(() => undefined);
    fetch("/api/weave/layer-presets").then((r) => r.json()).then(setLayerPresets).catch(() => undefined);
    fetch("/api/handle/candidate").then((r) => r.json()).then(setHandleInfo).catch(() => undefined);
    fetch("/api/master/shell")
      .then((res) => res.arrayBuffer())
      .then((buf) => setOriginal(parseStl(buf)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    setRefusal(null);
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchPlan(params)
        .then((url) => {
          setPlanUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        })
        .catch((err) => setError(String(err)));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchPreview(params, "draft")
        .then((payload) => {
          setMesh({ positions: payload.positions, indices: payload.indices, colors: payload.colors });
          setReport(payload.report);
          setError("");
        })
        .catch((err) => setError(String(err.message || err)));
    }, 480);
    return () => window.clearTimeout(timer);
  }, [params]);

  const setNumber = (key: string, value: number) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value } as WeaveParams;
      if (!prev.layers.length) return next;
      const index = prev.layers.findIndex((item) => item.enabled !== false && item.visible !== false && item.algorithm !== "plain" && item.algorithm !== "none");
      const current = prev.layers[index >= 0 ? index : layerIndex];
      if (!current || current.locked) return next;
      const layer = { ...current };
      if (key === "density_u" || key === "density_v") layer.density = value;
      if (key === "strand_width_u" || key === "strand_width_v") layer.strip_width = value;
      if (key === "amplitude") layer.amplitude = value;
      if (key === "frequency") layer.frequency = value;
      if (key === "weave_angle") {
        const diamond = String(current.algorithm || "").includes("diamond");
        layer.pattern_angle = diamond && value > 24 ? value - 42 : value;
      }
      if (key === "relief") layer.crossing_lift = Math.max(0.4, value);
      if (key === "seed") layer.seed = Math.round(value);
      if (key === "cell_aspect") layer.cell_aspect = value;
      if (key === "randomness") layer.randomness = value;
      if (key === "spoke_count") layer.spoke_count = Math.round(value);
      if (key === "ring_count") layer.ring_count = Math.round(value);
      if (key === "edge_compression") layer.edge_compression = value;
      if (key === "rotation_strength") layer.rotation_strength = value;
      if (key === "wave_phase") layer.wave_phase = value;
      if (key === "center_spacing") layer.center_spacing = value;
      if (key === "direction_a") layer.direction_a = value;
      if (key === "direction_b") layer.direction_b = value;
      if (key === "arc_a") layer.arc_a = value;
      if (key === "arc_b") layer.arc_b = value;
      if (key === "edge_spacing") layer.edge_spacing = value;
      if (key === "secondary_strength") layer.secondary_strength = value;
      if (key === "structural_strength") layer.structural_strength = value;
      if (key === "binder_density") layer.binder_density = value;
      const layers = prev.layers.map((item, itemIndex) => itemIndex === (index >= 0 ? index : layerIndex) ? layer : item);
      return { ...next, layers };
    });
  };

  useEffect(() => {
    if (!layerPresets.length || params.layers.length || params.preset === "blank") return;
    const diamond = layerPresets.find((item) => item.id === "rotating-diamond-reference")
      ?? layerPresets.find((item) => item.id === "radial-star");
    if (!diamond) return;
    const reference = layerPresets.find((item) => item.id === "rotating-diamond-reference") ?? diamond;
    setParams((prev) => prev.layers.length ? prev : { ...prev, preset: reference.id, pattern: reference.pattern, seed: reference.seed, layers: reference.layers, rim_width: 5.8, rim_depth: 7 });
  }, [layerPresets, params.layers.length]);

  const debug = calibrate || window.location.pathname.includes("debug");

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    document.title = lang === "en" ? "Haitang Weave" : lang === "zh-Hans" ? "海棠经纬 · HAITANG WEAVE LAB" : "海棠經緯 · HAITANG WEAVE LAB";
  }, [lang]);
  const primaryLayer = params.layers.find((layer) => layer.enabled !== false && layer.visible !== false && layer.algorithm !== "plain" && layer.algorithm !== "none") ?? params.layers[1];
  const breakCount = report == null ? 0 : Number(report.visible_endpoint_count ?? 0) + Number(report.interior_endpoint_count ?? 0) + Number(report.insufficient_embed_count ?? 0) + Number(report.short_fragment_count ?? 0) + Number(report.unanchored_strip_count ?? 0) + Number(report.path_discontinuity_count ?? 0);
  const curveCount = report == null ? 0 : Number(report.curve_count ?? 0);
  const continuityOk = report != null && report.path_continuity === "PASS" && breakCount === 0 && curveCount > 0;
  const gateBlocked = report != null && (report.export_blocked === true || report.path_continuity === "FAIL");
  useEffect(() => {
    if (report == null) return;
    logEvent(gateBlocked ? "gate_block" : "gate_pass", {
      reason: String(report.export_block_reason ?? ""),
      free_ends: Number(report.visible_endpoint_count ?? 0) + Number(report.interior_endpoint_count ?? 0),
    });
  }, [gateBlocked]);
  const patternChoices = PATTERN_IDS.map((id) => layerPresets.find((item) => item.id === id)).filter((item): item is LayerPreset => item != null);

  function applyPreset(item: LayerPreset) {
    logEvent("preset_load", { id: item.id });
    setParams((prev) => ({
      ...prev,
      preset: item.id,
      pattern: item.pattern === "blank" ? "blank" : item.pattern,
      seed: item.seed,
      layers: item.layers.map((layer) => ({ ...layer })),
      crossing_locks: [],
    }));
  }

  function toggleAux(algo: string) {
    setParams((prev) => {
      const exists = prev.layers.some((item) => item.modulate && item.algorithm === algo);
      if (exists) {
        return { ...prev, layers: prev.layers.filter((item) => !(item.modulate && item.algorithm === algo)) };
      }
      const count = prev.layers.filter((item) => item.modulate).length;
      if (count >= 3) return prev;
      const layer: WeaveLayer = {
        id: `A${count + 1}`,
        name: "辅助调制",
        enabled: true,
        visible: true,
        locked: false,
        solo: false,
        algorithm: algo,
        modulate: true,
        seed: prev.seed,
        density: 0.7,
        strip_width: 1.4,
      };
      return { ...prev, layers: [...prev.layers, layer] };
    });
  }

  function selectedMotifs(current: WeaveParams) {
    if (Array.isArray(current.support_motifs)) return current.support_motifs;
    return current.support_motif ? [current.support_motif] : [];
  }

  function toggleSupportMotif(motif: "bar-h" | "bar-v" | "circle" | "dot" | "triangle" | "star") {
    setParams((prev) => {
      const current = selectedMotifs(prev);
      const next = current.includes(motif) ? current.filter((item) => item !== motif) : [...current, motif];
      return { ...prev, support_motifs: next, support_motif: next[0] ?? "bar-h" };
    });
  }
  const algorithm = primaryLayer?.algorithm ?? "";
  const sliders = useMemo(() => {
    const rows = [
      ["target_height", "整扇高度", 140, 210, 2, "mm"],
      ["t_max", "竹篾厚度", 0.55, 1.25, 0.05, "mm"],
      ["density_u", "图层密度", 0.35, 1.8, 0.05, ""],
      ["strand_width_u", "竹篾宽度", 1.2, 3.2, 0.05, "mm"],
      ["weave_angle", "纹样方向", -40, 40, 1, "°"],
      ["relief", "交点抬升", 0.1, 0.9, 0.02, ""],
      ["frequency", "波频", 0.2, 3, 0.05, ""],
      ["amplitude", "波幅", 0, 10, 0.1, "mm"],
      ["cell_aspect", "细胞纵横比", 0.6, 1.6, 0.02, ""],
      ["randomness", "随机扰动", 0, 0.08, 0.01, ""],
      ["seed", "随机种子", 1, 999, 1, ""],
    ] as const;
    const hidden = new Set<string>();
    if (!algorithm.includes("ripple") && algorithm !== "plain") hidden.add("frequency").add("amplitude");
    if (!algorithm.includes("cellular")) hidden.add("cell_aspect").add("randomness");
    if (algorithm.includes("radial")) hidden.add("frequency").add("amplitude");
    return rows.filter(([key]) => !hidden.has(key));
  }, [algorithm]);

  async function onExport(kind: "stl" | "3mf") {
    setBusy(kind);
    setError("");
    try {
      const record = await generate(params, quality === "draft" ? "recommended" : quality, presetName || "haitang");
      logEvent("export", { kind, job: record.id, quality });
      setJob(record);
      setReport(record.report as Record<string, unknown>);
      const file = kind === "stl" ? "fan_parametric.stl" : "fan_parametric.3mf";
      const link = document.createElement("a");
      link.href = `/api/exports/${record.id}/${file}`;
      link.download = file;
      link.click();
    } catch (err) {
      if (err instanceof ExportBlocked) {
        logEvent("gate_block", { at: "export", quality: err.quality, issues: err.issues });
        setRefusal({ issues: err.issues, quality: err.quality });
      } else {
        setError(String(err));
      }
    } finally {
      setBusy("");
    }
  }

  async function onEffect() {
    setBusy("effect");
    setError("");
    try {
      await downloadEffectImage(params);
      logEvent("effect_image", {});
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy("");
    }
  }

  function applyFix(layerIndex: number, changes: { key: string; to: unknown }[]) {
    setParams((prev) => ({
      ...prev,
      layers: prev.layers.map((layer, index) =>
        index === layerIndex ? { ...layer, ...Object.fromEntries(changes.map((item) => [item.key, item.to])) } : layer,
      ),
    }));
  }

  const exportQuality = quality === "draft" ? "recommended" : quality;
  const gate = <GatePanel params={params} report={report} refusal={refusal} quality={exportQuality} onApply={applyFix} t={t} />;

  async function loadOriginal() {
    const res = await fetch("/api/model/original/fan");
    setOriginal(parseStl(await res.arrayBuffer()));
    setShowOriginal(true);
  }

  async function savePreset() {
    const res = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: presetName, params }),
    });
    const item = await res.json();
    setPresets((prev) => [...prev, item]);
  }

  async function confirmText() {
    const res = await fetch("/api/handle/remove-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setHandleInfo(await (await fetch("/api/handle/candidate")).json());
  }

  async function saveAlign() {
    const res = await fetch("/api/assembly/align", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...align, user_confirmed_fit: false }),
    });
    setBaseline(await (await fetch("/api/project/baseline")).json());
    await res.json();
  }

  const fanMeta = (baseline?.immutable_sources as { fan?: { bbox_min: number[]; bbox_max: number[] } } | undefined)?.fan;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="seal">棠</div>
          <div>
            <h1>{t("brand.title")}</h1>
            <p>{t("brand.sub")}</p>
          </div>
        </div>
        <div className="top-actions">
          <div className="lang">
            <button type="button" className={lang === "zh-Hans" ? "on" : ""} onClick={() => setLang("zh-Hans")}>简体</button>
            <button type="button" className={lang === "zh-Hant" ? "on" : ""} onClick={() => setLang("zh-Hant")}>繁體</button>
            <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <nav className="nav">
            {([
              ["design", "nav.design"],
              ["handle", "nav.handle"],
              ["print", "nav.print"],
              ["library", "nav.library"],
              ["help", "nav.help"],
            ] as const).map(([id, label]) => (
              <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                {t(label)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <SessionBar params={params} onRestore={(next) => setParams({ ...freshParams(), ...next })} t={t} lang={lang} />

      {tab === "help" ? (
        <article className="help">
          <h2>{t("help.title")}</h2>
          <p>{t("help.p1")}</p>
          <p>{t("help.p2")}</p>
        </article>
      ) : (
        <main className="workspace">
          <section className="panel">
            {tab === "design" && (
              <>
                <div className="step">
                  <h2>{t("design.pattern")}</h2>
                  <div className="cards">
                    {(patternChoices.length ? patternChoices : [{ id: "rotating-diamond-reference", name: "旋转菱纹", pattern: "diamond", seed: 5205, layers: params.layers }]).map((item) => (
                      <button key={item.id} type="button" className={params.preset === item.id ? "card on" : "card"} onClick={() => applyPreset(item)}>
                        <strong>{presetLabel(lang, item.id, item.name)}</strong>
                      </button>
                    ))}
                  </div>
                  <p>{t("design.blurb")}</p>
                </div>
                <div className="step">
                  <h2>{t("design.adjust")}</h2>
                  {controlRows(primaryLayer?.algorithm ?? "rotating-diamond", primaryLayer, t).map((row) => {
                    const shown = controlValue(row.key, primaryLayer, params);
                    return (
                      <Fragment key={row.key}>
                      {row.heading ? <h3 className="adjust-group">{t(row.heading)}</h3> : null}
                      <label className="slider">
                        <span>{row.label}</span>
                        <input
                          className="num"
                          type="number"
                          min={row.min}
                          max={row.max}
                          step="any"
                          value={Number(shown.toFixed(row.step < 1 ? 2 : 0))}
                          aria-label={`${row.label}数值`}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            if (Number.isFinite(next)) setNumber(row.key, Math.min(row.max, Math.max(row.min, next)));
                          }}
                        />
                        <em>{row.unit}</em>
                        <input
                          type="range"
                          min={row.min}
                          max={row.max}
                          step={row.step}
                          value={shown}
                          aria-label={row.label}
                          onChange={(event) => setNumber(row.key, Number(event.target.value))}
                        />
                        <small>{row.hint}</small>
                        <button type="button" className="textish" onClick={() => setNumber(row.key, row.fallback)}>{t("reset")}</button>
                      </label>
                      </Fragment>
                    );
                  })}
                </div>
                {debug && (
                <div className="step">
                  <h2>调试图层</h2>
                  {params.layers.map((layer, index) => (
                    <div key={layer.id} className={index === layerIndex ? "layer-card on" : "layer-card"} onClick={() => setLayerIndex(index)}>
                      <b>{layer.id} {layer.name}</b>
                      <span>{layer.algorithm}</span>
                      <button type="button" title="显示或隐藏这一层" onClick={(event) => { event.stopPropagation(); const layers = params.layers.map((item, i) => i === index ? { ...item, visible: !item.visible } : item); setParams({ ...params, layers }); }}>显</button>
                      <button type="button" title="只看这一层" onClick={(event) => { event.stopPropagation(); const layers = params.layers.map((item, i) => i === index ? { ...item, solo: !item.solo } : item); setParams({ ...params, layers }); }}>独</button>
                    </div>
                  ))}
                  {params.layers[layerIndex] && (
                    <LayerFields
                      layer={params.layers[layerIndex]}
                      onChange={(next) => {
                        const layers = params.layers.map((item, i) => i === layerIndex ? next : item);
                        setParams({ ...params, layers });
                      }}
                    />
                  )}
                </div>
                )}
                <div className="step">
                  <h2>{t("design.check")}</h2>
                  <StatusList report={report} t={t} />
                  {gate}
                  <div className="export-actions">
                    <button className="primary" disabled={!!busy || curveCount === 0 || gateBlocked} onClick={() => onExport("stl")}>{busy === "stl" ? t("export.stlBusy") : t("export.stl")}</button>
                    <button className="ghost" disabled={!!busy || curveCount === 0 || gateBlocked} onClick={() => onExport("3mf")}>{busy === "3mf" ? t("export.mfBusy") : t("export.mf")}</button>
                    <button className="ghost effect" disabled={!!busy || curveCount === 0} onClick={() => void onEffect()}>{busy === "effect" ? t("export.effectBusy") : t("export.effect")}</button>
                  </div>
                  <button className="ghost" onClick={() => setParams({ ...freshParams(), pattern: "blank", preset: "blank", layers: [] })}>{t("export.blank")}</button>
                  <details className="advanced">
                    <summary>{t("advanced")}</summary>
                    <label className="slider">
                      <span>{t("support.density")}</span>
                      <b>{(params.support_density ?? 0).toFixed(2)}</b>
                      <input type="range" min={0} max={1} step={0.02} value={params.support_density ?? 0} onChange={(event) => setParams({ ...params, support_density: Number(event.target.value) })} />
                      <small>{t("support.densityHint")}</small>
                    </label>
                    <div className="row motifs">
                      {(["bar-h", "bar-v", "circle", "dot", "triangle", "star"] as const).map((motif) => (
                        <button key={motif} type="button" className={selectedMotifs(params).includes(motif) ? "ghost on" : "ghost"} onClick={() => toggleSupportMotif(motif)}>{t(`motif.${motif}`)}</button>
                      ))}
                    </div>
                    <small className="motif-note">{t("support.stackHint")}</small>
                    <label className="slider">
                      <span>{t("support.size")}</span>
                      <b>{(params.support_size ?? 3.2).toFixed(1)} mm</b>
                      <input type="range" min={1.6} max={8} step={0.1} value={params.support_size ?? 3.2} onChange={(event) => setParams({ ...params, support_size: Number(event.target.value) })} />
                      <small>{t("support.sizeHint")}</small>
                    </label>
                    <label className="slider">
                      <span>{t("support.secondary")}</span>
                      <b>{(primaryLayer?.secondary_strength ?? 0.7).toFixed(2)}</b>
                      <input type="range" min={0.55} max={0.85} step={0.01} value={primaryLayer?.secondary_strength ?? 0.7} onChange={(event) => setNumber("secondary_strength", Number(event.target.value))} />
                      <small>{t("support.secondaryHint")}</small>
                    </label>
                    <label className="slider">
                      <span>{t("support.strength")}</span>
                      <b>{(primaryLayer?.structural_strength ?? 0).toFixed(2)}</b>
                      <input type="range" min={0} max={0.4} step={0.01} value={primaryLayer?.structural_strength ?? 0} onChange={(event) => setNumber("structural_strength", Number(event.target.value))} />
                      <small>{t("support.strengthHint")}</small>
                    </label>
                    <label className="slider">
                      <span>{t("seed")}</span>
                      <b>{Math.round(primaryLayer?.seed ?? params.seed)}</b>
                      <input type="range" min={1} max={9999} step={1} value={primaryLayer?.seed ?? params.seed} onChange={(event) => setNumber("seed", Number(event.target.value))} />
                      <small>{t("seedHint")}</small>
                    </label>
                    <label className="slider">
                      <span>{t("height")}</span>
                      <b>{params.target_height.toFixed(0)} mm</b>
                      <input type="range" min={140} max={210} step={2} value={params.target_height} onChange={(event) => setNumber("target_height", Number(event.target.value))} />
                      <small>{t("heightHint")}</small>
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={params.geometry_lock} onChange={(event) => setParams({ ...params, geometry_lock: event.target.checked })} />
                      {t("lock")}
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={params.show_master} onChange={(event) => setParams({ ...params, show_master: event.target.checked })} />
                      {t("showMaster")}
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={params.print_safe} onChange={(event) => setParams({ ...params, print_safe: event.target.checked })} />
                      {t("printSafe")}
                    </label>
                    <button className="ghost" onClick={() => setParams(freshParams())}>{t("restore")}</button>
                  </details>
                  {debug && (
                  <div className="lock-readout">
                    <span>Geometry Lock {String(report?.geometry_lock ?? "…")}</span>
                    <span>Outer silhouette {String(report?.outer_silhouette ?? "…")}</span>
                    <span>Guard {String(report?.guard_consistency ?? "…")}</span>
                    <span>Handle {String(report?.handle_consistency ?? "…")}</span>
                    <span>Printable {String(report?.printable_mesh ?? "…")}</span>
                    <span>总高 {String(report?.height_mm ?? "…")} mm</span>
                    <span>总宽 {String(report?.width_mm ?? "…")} mm</span>
                    <span>宽高比 {String(report?.aspect ?? "…")}</span>
                    <span>扇柄长度 {String(report?.handle_length_mm ?? "…")} mm</span>
                    <span>护片宽度 {String(report?.guard_width_mm ?? "…")} mm</span>
                    <span>最小竹条 {String(report?.min_feature_mm ?? "…")} mm</span>
                    <span>固定偏差 {String(report?.silhouette_deviation_mm ?? "…")} mm</span>
                    <span>组件 {String(report?.component_count ?? "…")}</span>
                  </div>
                  )}
                  {debug && (
                  <>
                  <h2>九区</h2>
                  {params.geometry_lock ? <p>分区密度只在关闭母版锁定后生效。</p> : (
                  <>
                  <div className="zones">
                    {ZONES.map((id) => (
                      <button key={id} className={zone === id ? "on" : ""} onClick={() => setZone(id)}>{id}</button>
                    ))}
                  </div>
                  <label className="slider">
                    <span>{zone} 经密覆盖</span>
                    <b>{params.zones[zone]?.density_u ?? "继承"}</b>
                    <input
                      type="range"
                      min={0.3}
                      max={2.4}
                      step={0.02}
                      value={params.zones[zone]?.density_u ?? params.density_u}
                      onChange={(event) => {
                        const density_u = Number(event.target.value);
                        setParams({ ...params, zones: { ...params.zones, [zone]: { ...params.zones[zone], enabled: true, density_u } } });
                      }}
                    />
                  </label>
                  <div className="row">
                    <button className="ghost" onClick={() => setParams({ ...params, zones: { ...params.zones, [zone]: { enabled: true } } })}>清除 {zone} 覆盖</button>
                    <button className="ghost" onClick={() => setParams({ ...params, polygons: [...params.polygons, { points: [[0.02, 0.98], [0.42, 0.98], [0.42, 0.58], [0.02, 0.58]], density_u: 1.8, density_v: 1.8 }] })}>左上自由分区加密</button>
                    <button className="ghost" onClick={() => setParams({ ...params, polygons: [] })}>清除自由分区</button>
                  </div>
                  </>
                  )}
                  </>
                  )}
                </div>
              </>
            )}

            {tab === "handle" && (
              <div className="step">
                <h2>{t("handle.title")}</h2>
                <p>{t("handle.p1")}</p>
                <p>{t("handle.p2")}</p>
                <div className="stat"><span>{t("handle.current")}</span><b>{report?.width_mm ? `${String(report.width_mm)} × ${String(report.height_mm)} mm` : t("handle.wait")}</b></div>
                <div className="stat"><span>{t("handle.bed")}</span><b>{report?.fits_220 ? t("handle.fit") : t("handle.shrink")}</b></div>
              </div>
            )}

            {tab === "print" && (
              <div className="step">
                <h2>{t("print.title")}</h2>
                <div className="cards">
                  {([
                    ["draft", "print.draft"],
                    ["recommended", "print.recommended"],
                    ["high", "print.high"],
                  ] as const).map(([id, label]) => (
                    <button key={id} className={quality === id ? "card on" : "card"} onClick={() => setQuality(id)}>
                      <strong>{t(label)}</strong>
                    </button>
                  ))}
                </div>
                <p>{t("print.p1")}</p>
                {gate}
                <div className="export-actions">
                  <button className="primary" disabled={!!busy || curveCount === 0 || gateBlocked} onClick={() => onExport("stl")}>{busy === "stl" ? t("export.stlBusy") : t("export.stl")}</button>
                  <button className="ghost" disabled={!!busy || curveCount === 0 || gateBlocked} onClick={() => onExport("3mf")}>{busy === "3mf" ? t("export.mfBusy") : t("export.mf")}</button>
                  <button className="ghost effect" disabled={!!busy || curveCount === 0} onClick={() => void onEffect()}>{busy === "effect" ? t("export.effectBusy") : t("export.effect")}</button>
                </div>
                <p>{t("print.p2")}</p>
                {job && (
                  <div>
                    {Array.isArray(job.files) && (job.files as string[]).map((file) => (
                      <div className="stat" key={file}>
                        <span>{file}</span>
                        <a href={`/api/exports/${job.id}/${file}`}>{file.endsWith(".stl") || file.endsWith(".3mf") ? t("download") : t("open")}</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "library" && (
              <div className="step">
                <h2>{t("library.title")}</h2>
                <input value={presetName} onChange={(event) => setPresetName(event.target.value)} />
                <div className="row">
                  <button className="primary" onClick={savePreset}>{t("library.save")}</button>
                </div>
                {presets.map((item) => (
                  <div className="stat" key={item.id}>
                    <button className="ghost" onClick={() => setParams({ ...freshParams(), ...item.params, zones: { ...emptyZones(), ...item.params.zones } })}>{item.name}</button>
                    <button className="ghost danger" onClick={async () => {
                      await fetch(`/api/presets/${item.id}`, { method: "DELETE" });
                      setPresets((prev) => prev.filter((row) => row.id !== item.id));
                    }}>{t("library.delete")}</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="stage">
            <div className="pane-head">
              <span className="mode-toggle">
                <button type="button" className={planMode === "plan" ? "on" : ""} onClick={() => setPlanMode("plan")}>{t("pane.planMode")}</button>
                <button type="button" className={planMode === "cross" ? "on" : ""} onClick={() => { setPlanMode("cross"); logEvent("view_crossings", {}); }}>{t("pane.crossMode")}</button>
              </span>
              <span>{report == null ? t("continuity.checking") : curveCount === 0 ? t("continuity.empty") : continuityOk ? t("continuity.ok") : t("continuity.fail", { n: breakCount })} · {report?.width_mm ? `${String(report.width_mm)} × ${String(report.height_mm)} mm` : t("outline.wait")}</span>
            </div>
            {planMode === "cross" ? (
              <CrossingView params={params} t={t} />
            ) : (
              <div className="plan-wrap">
                {planUrl && <img src={planUrl} alt={t("plan.alt")} />}
              </div>
            )}
          </section>

          <section className="viewcol">
            <div className="pane-head">
              <strong>{t("pane.view")}</strong>
              <span>{report?.triangles ? t("faces", { n: String(report.triangles) }) : t("generating")} · {report?.fits_220 ? t("bed.ok") : t("bed.wait")}{params.t_min <= 0.011 ? ` · ${t("openwork")}` : ""}</span>
            </div>
            <Viewer
              positions={mesh?.positions ?? null}
              indices={mesh?.indices ?? null}
              colors={mesh?.colors ?? null}
              original={original}
              showOriginal={params.show_master}
              diffOnly={params.diff_only}
              modelScale={params.target_height / 180}
            />
            {error && <p className="warn">{error}</p>}
          </section>
        </main>
      )}
    </div>
  );
}

type ControlRow = { key: string; label: string; min: number; max: number; step: number; unit: string; hint: string; fallback: number; heading?: string };

function controlRows(algorithm: string, layer: WeaveLayer | undefined, t: (key: string) => string): ControlRow[] {
  const row = (key: string, label: string, min: number, max: number, step: number, unit: string, hint: string, fallback: number, heading?: string): ControlRow => ({ key, label: t(label), min, max, step, unit, hint: t(hint), fallback, heading });
  const shared: ControlRow[] = [
    row("density_u", "ctrl.density", 0.4, 2.4, 0.05, "", "ctrl.densityHint", 1.2),
    row("strand_width_u", "ctrl.width", 1.4, 3.2, 0.05, "mm", "ctrl.widthHint", 1.6),
    row("relief", "ctrl.relief", 0.4, 2.6, 0.05, "mm", "ctrl.reliefHint", 1.8),
  ];
  if (algorithm.includes("ripple")) {
    return [
      row("density_u", "ctrl.density", 0.4, 2.4, 0.05, "", "ctrl.densityHint", 1.35),
      row("strand_width_u", "ctrl.width", 1.4, 3.2, 0.05, "mm", "ctrl.widthHint", 2.0),
      row("relief", "ctrl.relief", 0.4, 2.6, 0.05, "mm", "ctrl.reliefHint", 1.8),
      row("amplitude", "ctrl.amp", 0, 10, 0.1, "mm", "ctrl.ampHint", 4.6),
      row("frequency", "ctrl.freq", 0.3, 2.4, 0.05, "", "ctrl.freqHint", 2.0),
      row("wave_phase", "ctrl.phase", 0, 6.2, 0.1, "", "ctrl.phaseHint", 0.4),
    ];
  }
  if (algorithm === "plain") {
    return [
      ...shared,
      row("amplitude", "ctrl.amp", 0, 10, 0.1, "mm", "ctrl.ampHint", 5.6),
      row("frequency", "ctrl.freq", 0.3, 2.4, 0.05, "", "ctrl.freqHint", 1.05),
      row("wave_phase", "ctrl.phase", 0, 6.2, 0.1, "", "ctrl.phaseHint", 0.4),
    ];
  }
  if (algorithm.includes("radial")) {
    return [
      ...shared,
      row("spoke_count", "ctrl.spokes", 8, 48, 1, "", "ctrl.spokesHint", 32),
      row("ring_count", "ctrl.rings", 0, 18, 1, "", "ctrl.ringsHint", 14),
      row("weave_angle", "ctrl.angleShift", -25, 25, 1, "°", "ctrl.angleShiftHint", 0),
    ];
  }
  if (algorithm.includes("cellular")) {
    return [
      ...shared,
      row("randomness", "ctrl.random", 0, 2, 0.02, "", "ctrl.randomHint", 0),
      row("cell_aspect", "ctrl.aspect", 0.6, 1.6, 0.02, "", "ctrl.aspectHint", 1),
    ];
  }
  if (algorithm.includes("diamond") || (layer?.center_spacing ?? 0) >= 6) {
    return [
      row("center_spacing", "ctrl.center", 2.8, 16, 0.2, "mm", "ctrl.centerHint", 4.8),
      row("edge_spacing", "ctrl.edge", 2.2, 8, 0.2, "mm", "ctrl.edgeHint", 3.4),
      row("rotation_strength", "ctrl.spin", 0, 1.2, 0.02, "", "ctrl.spinHint", 0.28),
      row("weave_angle", "ctrl.cross", 28, 58, 1, "°", "ctrl.crossHint", 42),
      row("direction_a", "ctrl.dirA", -40, 40, 1, "°", "ctrl.dirAHint", 0, "ctrl.arcModule"),
      row("arc_a", "ctrl.arcA", -42, 42, 1, "mm", "ctrl.arcAHint", 18),
      row("direction_b", "ctrl.dirB", -40, 40, 1, "°", "ctrl.dirBHint", 0),
      row("arc_b", "ctrl.arcB", -42, 42, 1, "mm", "ctrl.arcBHint", -18),
      row("target_height", "ctrl.fanHeight", 120, 220, 1, "mm", "ctrl.fanHeightHint", 180),
      row("strand_width_u", "ctrl.lightWidth", 1.2, 4.2, 0.1, "mm", "ctrl.lightWidthHint", 3.4),
      row("ribbon_thickness", "ctrl.thick", 0.6, 2.2, 0.05, "mm", "ctrl.thickHint", 1.2),
      row("relief", "ctrl.reliefMm", 0.4, 2.6, 0.05, "mm", "ctrl.reliefMmHint", 1.8),
      row("rim_width", "ctrl.rimW", 1, 8, 0.1, "mm", "ctrl.rimWHint", 5.8),
      row("rim_depth", "ctrl.rimD", 1, 12, 0.1, "mm", "ctrl.rimDHint", 7),
    ];
  }
  return [
    ...shared,
    row("weave_angle", "ctrl.cross2", 0, 36, 1, "°", "ctrl.cross2Hint", 6),
    row("rotation_strength", "ctrl.spin2", 0, 1.2, 0.02, "", "ctrl.spin2Hint", 0.2),
    row("edge_compression", "ctrl.edge2", 0.55, 1, 0.01, "", "ctrl.edge2Hint", 0.82),
  ];
}

function controlValue(key: string, layer: WeaveLayer | undefined, params: WeaveParams): number {
  const diamond = (layer?.algorithm ?? "").includes("diamond") || (layer?.center_spacing ?? 0) >= 6;
  const storedAngle = layer?.pattern_angle ?? 0;
  const map: Record<string, number | undefined> = layer ? {
    density_u: layer.density,
    strand_width_u: layer.strip_width,
    amplitude: layer.amplitude,
    frequency: layer.frequency,
    weave_angle: diamond && storedAngle <= 24 ? storedAngle + 42 : storedAngle,
    relief: layer.crossing_lift,
    cell_aspect: layer.cell_aspect,
    randomness: layer.randomness,
    spoke_count: layer.spoke_count,
    ring_count: layer.ring_count,
    edge_compression: layer.edge_compression,
    rotation_strength: layer.rotation_strength,
    wave_phase: layer.wave_phase,
    center_spacing: layer.center_spacing,
    direction_a: layer.direction_a,
    direction_b: layer.direction_b,
    arc_a: layer.arc_a,
    arc_b: layer.arc_b,
    edge_spacing: layer.edge_spacing,
    secondary_strength: layer.secondary_strength,
  } : {};
  if (key === "target_height") return params.target_height;
  if (key === "ribbon_thickness") return params.ribbon_thickness ?? 1.2;
  if (key === "rim_width" || key === "rim_depth") {
    const direct = Number(params[key]);
    return Number.isFinite(direct) ? direct : key === "rim_depth" ? 7 : 3.4;
  }
  const value = map[key];
  if (value == null || Number.isNaN(Number(value))) {
    const fallback = Number(params[key as keyof WeaveParams]);
    return Number.isFinite(fallback) ? fallback : 0;
  }
  return Number(value);
}

function StatusList({ report, t }: { report: Record<string, unknown> | null; t: (key: string) => string }) {
  const row = (label: string, ok: boolean | null) => (
    <div className="stat">
      <span>{t(label)}</span>
      <b className={ok == null ? "" : ok ? "good" : "bad"}>{ok == null ? t("status.pending") : ok ? t("status.pass") : t("status.fail")}</b>
    </div>
  );
  return (
    <div className="status">
      {row("status.path", report ? report.path_continuity === "PASS" : null)}
      {row("status.anchor", report ? report.frame_anchor === "PASS" : null)}
      {row("status.solid", report ? report.printable_mesh === "PASS" && report.connected_component_count === 1 : null)}
      {row("status.thick", report ? Number(report.strip_thickness_mm ?? 0) >= 0.55 : null)}
      {row("status.bed", report ? Boolean(report.fits_220) : null)}
      <div className="stat"><span>{t("status.faces")}</span><b>{report?.triangles ? String(report.triangles) : "…"}</b></div>
    </div>
  );
}

const LAYER_ALGORITHMS = [
  ["none", "空层"],
  ["plain", "平编"],
  ["radial-star", "放射星纹"],
  ["ripple-wave", "涟漪流动"],
  ["cellular-growth", "笼目网纹"],
  ["rotating-diamond", "旋转菱纹"],
] as const;

function LayerFields({ layer, onChange }: { layer: WeaveLayer; onChange: (layer: WeaveLayer) => void }) {
  const setNumber = (key: keyof WeaveLayer, value: number) => onChange({ ...layer, [key]: value });
  const extra: Array<[keyof WeaveLayer, string, number, number, number]> = [];
  if (layer.algorithm.includes("radial")) {
    extra.push(["spoke_count", "放射数量", 8, 48, 1], ["ring_count", "环数", 2, 14, 1]);
  }
  if (layer.algorithm.includes("ripple")) {
    extra.push(["amplitude", "波幅 mm", 0, 10, 0.1], ["frequency", "波频", 0.2, 3, 0.05], ["bundle_count", "每组竹篾", 1, 4, 1], ["accent_every", "强调间隔", 0, 8, 1]);
  }
  if (layer.algorithm.includes("cellular")) {
    extra.push(["cell_aspect", "细胞纵横比", 0.6, 1.6, 0.02], ["randomness", "不规则度", 0, 0.08, 0.01]);
  }
  if (layer.algorithm.includes("diamond")) {
    extra.push(["pattern_angle", "菱纹角度", -30, 30, 1], ["edge_compression", "边缘压缩", 0.55, 1, 0.01]);
  }
  const rows: Array<[keyof WeaveLayer, string, number, number, number]> = [
    ["density", "密度", 0.35, 1.8, 0.05],
    ["strip_width", "竹篾宽度 mm", 1.2, 3.2, 0.05],
    ["base_z", "基础高度", 0, 1.4, 0.05],
    ["crossing_lift", "交点抬升", 0.1, 0.9, 0.02],
    ...extra,
  ];
  return (
    <div className="layer-fields">
      <label className="slider">
        <span>算法</span>
        <select value={layer.algorithm} onChange={(event) => onChange({ ...layer, algorithm: event.target.value })}>
          {LAYER_ALGORITHMS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      {rows.map(([key, label, min, max, step]) => (
        <label className="slider" key={key}>
          <span>{label}</span>
          <b>{Number(layer[key] ?? (key === "spoke_count" ? 22 : key === "ring_count" ? 6 : 0)).toFixed(step < 1 ? 2 : 0)}</b>
          <input type="range" min={min} max={max} step={step} value={Number(layer[key] ?? (key === "spoke_count" ? 22 : key === "ring_count" ? 6 : key === "bundle_count" ? 1 : 0))} onChange={(event) => setNumber(key, Number(event.target.value))} />
        </label>
      ))}
    </div>
  );
}
