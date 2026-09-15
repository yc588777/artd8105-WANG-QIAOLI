import { useState } from "react";
import { GLOSSARY } from "../../data/glossary";
import { useAppStore } from "../../store/appStore";

export function Term({ id, children }: { id: string; children: string }) {
  const [on, setOn] = useState(false);
  const lang = useAppStore((s) => s.lang);
  const t = GLOSSARY.find((g) => g.id === id);
  if (!t) return <>{children}</>;
  const def = lang === "zh" ? t.defZh : t.defEn;
  const clipped = def.length > 120 ? `${def.slice(0, 117)}…` : def;
  return (
    <span className="term-pop">
      <button type="button" className="term" onClick={() => setOn((v) => !v)}>
        {children}
      </button>
      {on && <div className="bubble">{clipped}</div>}
    </span>
  );
}
