import type { ReactNode, RefObject } from "react";
import { copyJson, downloadCanvasPng, downloadJson } from "../../utils/exportCanvas";
import { MAX_SHOTS } from "../../utils/shotStack";
import { tick } from "../../utils/sound";
import { useShotStack } from "../../hooks/useShotStack";
import { useAppStore } from "../../store/appStore";
import { makeEntry, useArchiveStore } from "../../store/archiveStore";
import type { LabId } from "../../types";

export function ExportDialog({
  module,
  canvasRef,
  params,
  extra,
}: {
  module: LabId;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  params: unknown;
  extra?: ReactNode;
}) {
  const seed = useAppStore((s) => s.seed);
  const sound = useAppStore((s) => s.sound);
  const add = useArchiveStore((s) => s.add);
  const log = useAppStore((s) => s.setLog);
  const { shots, capture, toggle, remove, clear, exportSelected } = useShotStack(canvasRef, module);

  return (
    <>
      <h3>EXPORT</h3>
      <div className="seg">
        <button
          type="button"
          onClick={async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            await downloadCanvasPng(canvas, module, seed);
            tick(sound, "done");
            log(`EXPORT PNG // ${module.toUpperCase()} // SEED ${seed}`);
          }}
        >
          PNG
        </button>
        <button
          type="button"
          onClick={() => {
            downloadJson({ module, seed, params, t: Date.now() }, module, seed);
          }}
        >
          JSON
        </button>
        <button type="button" onClick={() => copyJson({ module, seed, params })}>
          COPY JSON
        </button>
        <button
          type="button"
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            add(
              makeEntry(
                module,
                seed,
                params,
                canvas.toDataURL("image/png"),
                `${module.toUpperCase()} / ${seed}`,
              ),
            );
            tick(sound, "done");
            log(`ARCHIVE WRITE // ${module.toUpperCase()}`);
          }}
        >
          SAVE ARCHIVE
        </button>
        {extra}
      </div>
      <h3>截图 {shots.length}/{MAX_SHOTS}</h3>
      <p className="muted">空格截取当前画面，最多 4 张。点选预览后导出 2× 高清 PNG。</p>
      <div className="shot-grid">
        {Array.from({ length: MAX_SHOTS }, (_, i) => {
          const shot = shots[i];
          if (!shot) {
            return (
              <div key={`empty-${i}`} className="shot-slot empty">
                <span>{i + 1}</span>
              </div>
            );
          }
          return (
            <button
              key={shot.id}
              type="button"
              className={shot.selected ? "shot-slot selected" : "shot-slot"}
              onClick={() => toggle(shot.id)}
              aria-pressed={shot.selected}
              aria-label={`截图 ${i + 1}${shot.selected ? " 已选" : ""}`}
            >
              <img src={shot.thumb} alt="" />
              <span className="shot-idx">{i + 1}</span>
              <span
                className="shot-del"
                role="button"
                tabIndex={0}
                aria-label={`删除截图 ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(shot.id);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  remove(shot.id);
                }}
              >
                ×
              </span>
            </button>
          );
        })}
      </div>
      <div className="seg">
        <button type="button" onClick={() => capture()}>
          SPACE / 截取
        </button>
        <button type="button" disabled={!shots.length} onClick={() => void exportSelected()}>
          导出所选高清
        </button>
        <button type="button" disabled={!shots.length} onClick={clear}>
          清空
        </button>
      </div>
    </>
  );
}
