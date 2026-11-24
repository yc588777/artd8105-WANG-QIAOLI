import { useEffect, useRef, useState } from "react";
import { downloadCraftDrawing, downloadEffectImage, downloadSessionDrawing, type WeaveParams } from "./api";
import { attachSession, flatten, logEvent, sessionClock } from "./sessionLog";

type Snapshot = {
  id: string;
  parent: string | null;
  label: string;
  created: string;
  params: WeaveParams;
  machine: { exportable?: boolean; reason?: string };
  plan_png: string | null;
};

type Session = {
  id: string;
  title: string;
  brief: string;
  consent_logging: boolean;
  started_epoch: number;
  system_version: string;
  snapshots: Snapshot[];
};

const SESSION_KEY = "haitang-session-v1";

function clockText(seconds: number) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function SessionBar({
  params,
  onRestore,
  t,
  lang,
}: {
  params: WeaveParams;
  onRestore: (params: WeaveParams) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  lang: string;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [form, setForm] = useState<{ title: string; brief: string; consent: boolean } | null>(null);
  const [label, setLabel] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState<"" | "draft" | "final" | "effect">("");
  const [clock, setClock] = useState(0);
  const [error, setError] = useState("");
  const lastParams = useRef<Record<string, unknown> | null>(null);
  const restoring = useRef(false);

  useEffect(() => {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return;
    fetch(`/api/sessions/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Session | null) => {
        if (!data) {
          localStorage.removeItem(SESSION_KEY);
          return;
        }
        setSession(data);
        setCurrent(data.snapshots.at(-1)?.id ?? null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    attachSession(session?.consent_logging ? session.id : null, session?.started_epoch ?? 0);
    if (!session) return;
    const timer = window.setInterval(() => setClock(sessionClock()), 1000);
    setClock(sessionClock());
    return () => window.clearInterval(timer);
  }, [session?.id, session?.consent_logging, session?.started_epoch]);

  useEffect(() => {
    const flat = flatten(params);
    const before = lastParams.current;
    lastParams.current = flat;
    if (!before || !session) return;
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const changes = Object.keys({ ...before, ...flat })
        .filter((key) => before[key] !== flat[key])
        .slice(0, 40)
        .map((key) => ({ key, from: before[key] ?? null, to: flat[key] ?? null }));
      if (changes.length) logEvent("param_change", { changes });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [params, session]);

  async function create() {
    if (!form) return;
    setError("");
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title || "設計會話", brief: form.brief, consent_logging: form.consent }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const data: Session = await res.json();
    localStorage.setItem(SESSION_KEY, data.id);
    setSession(data);
    setCurrent(null);
    setForm(null);
  }

  async function saveSnapshot() {
    if (!session) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${session.id}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, label, parent: current }),
      });
      if (!res.ok) throw new Error(await res.text());
      const snap: Snapshot = await res.json();
      setSession((prev) => (prev ? { ...prev, snapshots: [...prev.snapshots, snap] } : prev));
      setCurrent(snap.id);
      setLabel("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  function restore(snap: Snapshot) {
    restoring.current = true;
    onRestore(snap.params);
    setCurrent(snap.id);
    logEvent("snapshot_restore", { id: snap.id });
  }

  function savedVersion(): string | null {
    const snap = session?.snapshots.find((item) => item.id === current);
    if (!snap) return null;
    const key = (value: unknown) => JSON.stringify(Object.entries(flatten(value)).sort(([a], [b]) => a.localeCompare(b)));
    return key({ ...params, ...snap.params }) === key(params) ? snap.id : null;
  }

  async function exportDrawing() {
    setDrawing("draft");
    setError("");
    try {
      if (session) await downloadSessionDrawing(session.id, params, savedVersion(), false, lang);
      else await downloadCraftDrawing(params, t("brand.title"), lang);
      logEvent("craft_sheet", {});
    } catch (err) {
      setError(String(err));
    } finally {
      setDrawing("");
    }
  }

  async function exportEffect() {
    setDrawing("effect");
    setError("");
    try {
      await downloadEffectImage(params);
      logEvent("effect_image", {});
    } catch (err) {
      setError(String(err));
    } finally {
      setDrawing("");
    }
  }

  if (!session) {
    return (
      <section className="session-bar">
        {form ? (
          <div className="session-form">
            <input placeholder={t("session.title")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input placeholder={t("session.brief")} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
            <label className="session-consent">
              <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              {t("session.consent")}
            </label>
            <button type="button" className="primary" onClick={() => void create()}>{t("session.create")}</button>
            <button type="button" onClick={() => setForm(null)}>{t("session.cancel")}</button>
          </div>
        ) : (
          <div className="session-head">
            <span className="session-muted">{t("session.none")}</span>
            <span className="session-spacer" />
            <button type="button" disabled={!!drawing} onClick={() => void exportDrawing()}>
              {drawing === "draft" ? t("session.drawingBusy") : t("session.drawing")}
            </button>
            <button type="button" disabled={!!drawing} onClick={() => void exportEffect()}>
              {drawing === "effect" ? t("export.effectBusy") : t("export.effect")}
            </button>
            <button type="button" onClick={() => setForm({ title: "", brief: "", consent: true })}>{t("session.start")}</button>
          </div>
        )}
        {error && <p className="session-error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="session-bar">
      <div className="session-head">
        <strong>{session.title}</strong>
        {session.brief && <span className="session-muted">{session.brief}</span>}
        <span className={session.consent_logging ? "session-rec on" : "session-rec"}>
          {session.consent_logging ? t("session.recording") : t("session.notRecording")} · {clockText(clock)}
        </span>
        <span className="session-muted">{t("session.version", { v: session.system_version })}</span>
        <span className="session-spacer" />
        <input className="session-label" placeholder={t("session.label")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="button" className="primary" disabled={saving} onClick={() => void saveSnapshot()}>
          {saving ? t("session.saving") : t("session.save")}
        </button>
        <button type="button" disabled={!!drawing} onClick={() => void exportDrawing()}>
          {drawing === "draft" ? t("session.drawingBusy") : t("session.drawing")}
        </button>
        <button type="button" disabled={!!drawing} onClick={() => void exportEffect()}>
          {drawing === "effect" ? t("export.effectBusy") : t("export.effect")}
        </button>
        <a className="session-link" href={`/api/sessions/${session.id}/bundle`}>{t("session.bundle")}</a>
      </div>
      <div className="session-strip">
        {session.snapshots.length === 0 && <span className="session-muted">{t("session.empty")}</span>}
        {session.snapshots.map((snap) => (
          <button
            type="button"
            key={snap.id}
            title={`${t("session.restore")}${snap.parent ? ` · ← ${snap.parent}` : ""}${snap.machine?.reason ? `\n${snap.machine.reason}` : ""}`}
            className={`session-snap ${snap.id === current ? "current" : ""} ${snap.machine?.exportable ? "ok" : "blocked"}`}
            onClick={() => restore(snap)}
          >
            <span>{snap.label}</span>
            <small>{snap.machine?.exportable ? t("session.exportable") : t("session.blocked")}</small>
          </button>
        ))}
      </div>
      {error && <p className="session-error">{error}</p>}
    </section>
  );
}
