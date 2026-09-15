import { useEffect, useState } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAppStore } from "../../store/appStore";

const CODES = ["GENE.01", "FLOCK.02", "CELL.03", "GROW.04", "DIFF.05"];

export function BootScreen() {
  const reduced = useReducedMotion();
  const done = useAppStore((s) => s.bootDone);
  const setDone = useAppStore((s) => s.setBootDone);
  const [text, setText] = useState(reduced ? CODES.join("  ") : "");

  useEffect(() => {
    if (done) return;
    if (reduced) {
      setDone(true);
      return;
    }
    const full = CODES.join("  ");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setText(full.slice(0, i));
      if (i >= full.length) window.clearInterval(id);
    }, 28);
    const t = window.setTimeout(() => setDone(true), 1500);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(t);
    };
  }, [done, reduced, setDone]);

  if (done) return null;
  return (
    <div className="boot">
      <div className="scan" />
      <div>
        MORPHOSYSTEM // 05
        <small>{text}</small>
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button type="button" onClick={() => setDone(true)}>
            SKIP
          </button>
        </div>
      </div>
    </div>
  );
}
