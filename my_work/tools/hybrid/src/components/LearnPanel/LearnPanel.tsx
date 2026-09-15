import { MODULES } from "../../data/moduleContent";
import type { LabId, LabMode, Lang } from "../../types";
import { Term } from "../Glossary/Term";

const TERMS: Record<LabId, { id: string; zh: string }[]> = {
  gene: [
    { id: "allele", zh: "等位基因" },
    { id: "genotype", zh: "基因型" },
    { id: "phenotype", zh: "表现型" },
    { id: "punnett", zh: "潘尼特方格" },
  ],
  flock: [
    { id: "separation", zh: "分离" },
    { id: "alignment", zh: "对齐" },
    { id: "cohesion", zh: "凝聚" },
  ],
  cell: [
    { id: "neighbourhood", zh: "邻域" },
    { id: "glider", zh: "滑翔机" },
  ],
  grow: [
    { id: "axiom", zh: "公理" },
    { id: "turtle", zh: "海龟绘图" },
  ],
  diff: [
    { id: "turing", zh: "图灵失稳" },
    { id: "grayscott", zh: "Gray–Scott" },
  ],
  hybrid: [
    { id: "phoneme", zh: "音素" },
    { id: "formant", zh: "共振峰" },
  ],
};

export function LearnPanel({
  id,
  lang,
  mode,
  explain,
  step,
  onStep,
}: {
  id: LabId;
  lang: Lang;
  mode: LabMode;
  explain: string;
  step: number;
  onStep: (n: number) => void;
}) {
  const m = MODULES[id];
  const terms = TERMS[id];
  const zh = lang === "zh";
  return (
    <div>
      <p className="kicker">{m.code}</p>
      <h2>{zh ? m.zh : m.en}</h2>
      <p>{zh ? m.thesisZh : m.thesisEn}</p>
      <h3>RULES</h3>
      <ul>
        {(zh ? m.rulesZh : m.rulesEn).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {terms.length > 0 && (
        <>
          <h3>GLOSSARY</h3>
          <p>
            {terms.map((t, i) => (
              <span key={t.id}>
                {i > 0 ? " · " : ""}
                <Term id={t.id}>{t.zh}</Term>
              </span>
            ))}
          </p>
        </>
      )}
      <h3>PATH</h3>
      <div className="seg">
        {m.steps.map((s, i) => (
          <button key={s.id} type="button" className={step === i ? "active" : ""} onClick={() => onStep(i)}>
            {s.id}
          </button>
        ))}
      </div>
      {m.steps[step] && <p>{zh ? m.steps[step].bodyZh : m.steps[step].bodyEn}</p>}
      <h3>EXPLAIN</h3>
      <p>{explain}</p>
      {mode === "learn" && <p className="muted">LEARN 模式隐藏部分进阶参数。</p>}
    </div>
  );
}
