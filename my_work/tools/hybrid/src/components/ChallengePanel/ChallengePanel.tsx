import { CHALLENGES } from "../../data/challenges";
import type { LabId, Lang } from "../../types";

export function ChallengePanel({
  id,
  lang,
  done,
}: {
  id: LabId;
  lang: Lang;
  done: Record<string, boolean>;
}) {
  const list = CHALLENGES.filter((c) => c.module === id);
  const zh = lang === "zh";
  return (
    <div>
      <h3>CHALLENGE</h3>
      {list.map((c) => (
        <p key={c.id}>
          <span className={done[c.id] ? "lime" : "muted"}>{done[c.id] ? "■" : "□"}</span> {zh ? c.zh : c.en}
          <br />
          <span className="muted">{zh ? c.hintZh : c.hintEn}</span>
        </p>
      ))}
    </div>
  );
}
