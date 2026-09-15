import type { ReactNode } from "react";
import { Pause, Play, RotateCcw, Shuffle, SkipForward } from "lucide-react";
import { useAppStore } from "../../store/appStore";

export function Transport({
  onReset,
  onStep,
  extra,
}: {
  onReset: () => void;
  onStep?: () => void;
  extra?: ReactNode;
}) {
  const running = useAppStore((s) => s.running);
  const setRunning = useAppStore((s) => s.setRunning);
  const seed = useAppStore((s) => s.seed);
  const setSeed = useAppStore((s) => s.setSeed);
  const randomizeSeed = useAppStore((s) => s.randomizeSeed);
  return (
    <>
      <div className="seg">
        <button type="button" onClick={() => setRunning(!running)} aria-label={running ? "pause" : "play"}>
          {running ? <Pause size={12} /> : <Play size={12} />} {running ? "PAUSE" : "PLAY"}
        </button>
        {onStep && (
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              onStep();
            }}
          >
            <SkipForward size={12} /> STEP
          </button>
        )}
        <button type="button" onClick={onReset}>
          <RotateCcw size={12} /> RESET
        </button>
        <button
          type="button"
          onClick={() => {
            randomizeSeed();
            onReset();
          }}
        >
          <Shuffle size={12} /> RANDOMIZE
        </button>
      </div>
      <label className="param" style={{ margin: 0, minWidth: 140 }}>
        <header>
          <span>SEED</span>
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 1)} />
        </header>
      </label>
      {extra}
    </>
  );
}
