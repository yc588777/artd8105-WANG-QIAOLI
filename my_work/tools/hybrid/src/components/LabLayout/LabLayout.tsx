import type { ReactNode } from "react";
import type { LabId, LabMode, Lang } from "../../types";
import { ChallengePanel } from "../ChallengePanel/ChallengePanel";
import { LearnPanel } from "../LearnPanel/LearnPanel";

export function LabLayout({
  id,
  lang,
  mode,
  onMode,
  explain,
  step,
  onStep,
  done,
  canvas,
  inspector,
  timeline,
  summary,
}: {
  id: LabId;
  lang: Lang;
  mode: LabMode;
  onMode: (m: LabMode) => void;
  explain: string;
  step: number;
  onStep: (n: number) => void;
  done: Record<string, boolean>;
  canvas: ReactNode;
  inspector: ReactNode;
  timeline: ReactNode;
  summary: string;
}) {
  return (
    <div className="lab">
      <aside className="learn">
        <LearnPanel id={id} lang={lang} mode={mode} explain={explain} step={step} onStep={onStep} />
        <ChallengePanel id={id} lang={lang} done={done} />
      </aside>
      <section className="stage">
        <div className="stage-modes">
          {(["learn", "experiment", "analyze"] as LabMode[]).map((m) => (
            <button key={m} type="button" className={mode === m ? "active" : ""} onClick={() => onMode(m)}>
              {m}
            </button>
          ))}
          <span className="muted" style={{ marginLeft: "auto" }}>
            {summary}
          </span>
        </div>
        <div className="canvas-frame">
          {canvas}
          <div className="view-hint">WHEEL ZOOM · ALT / 中键 PAN · SPACE SHOT · INFINITE PLANE</div>
          <div className="crosshair" aria-hidden>
            <span className="tl" />
            <span className="tr" />
            <span className="bl" />
            <span className="br" />
          </div>
        </div>
      </section>
      <aside className="inspect">{inspector}</aside>
      <footer className="timeline">{timeline}</footer>
    </div>
  );
}
