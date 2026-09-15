import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArchiveStore } from "../store/archiveStore";
import { useAppStore } from "../store/appStore";

export function ArchivePage() {
  const entries = useArchiveStore((s) => s.entries);
  const remove = useArchiveStore((s) => s.remove);
  const clear = useArchiveStore((s) => s.clear);
  const setSeed = useAppStore((s) => s.setSeed);
  const nav = useNavigate();
  const [ask, setAsk] = useState(false);

  return (
    <div className="page">
      <p className="kicker">ARCHIVE</p>
      <h1>实验档案</h1>
      <p className="muted">按编号排列。可重新加载参数，或删除条目。</p>
      <div className="seg">
        <button type="button" onClick={() => setAsk(true)}>
          CLEAR ALL
        </button>
      </div>
      {ask && (
        <p>
          确认清空全部档案？
          <button type="button" className="active" onClick={() => { clear(); setAsk(false); }}>
            CONFIRM
          </button>
          <button type="button" onClick={() => setAsk(false)}>
            CANCEL
          </button>
        </p>
      )}
      <div className="archive-list">
        {entries.length === 0 && <div className="archive-row">NO RECORDS</div>}
        {entries.map((e, i) => (
          <article key={e.id} className="archive-row">
            <img src={e.thumbnail} alt="" />
            <div>
              <h3>
                {String(entries.length - i).padStart(3, "0")} // {e.module.toUpperCase()} // SEED {e.seed}
              </h3>
              <p>
                {new Date(e.createdAt).toLocaleString()} {e.challenge ?? ""}
              </p>
            </div>
            <div className="seg">
              <button
                type="button"
                onClick={() => {
                  setSeed(e.seed);
                  const map: Record<string, string> = {
                    gene: "/lab/gene",
                    flock: "/lab/flock",
                    cell: "/lab/cell",
                    grow: "/lab/grow",
                    diff: "/lab/diff",
                    hybrid: "/hybrid",
                  };
                  nav(map[e.module] ?? "/");
                }}
              >
                RELOAD
              </button>
              <button type="button" onClick={() => remove(e.id)}>
                DELETE
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
