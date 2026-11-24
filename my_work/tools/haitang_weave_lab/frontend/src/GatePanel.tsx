import { useEffect, useState } from "react";
import { fetchFix, type FixResult, type Issue, type WeaveParams } from "./api";
import { logEvent } from "./sessionLog";

function show(value: unknown) {
  return typeof value === "number" ? String(Math.round(value * 100) / 100) : String(value ?? "—");
}

export function GatePanel({
  params,
  report,
  refusal,
  quality,
  onApply,
  t,
}: {
  params: WeaveParams;
  report: Record<string, unknown> | null;
  refusal: { issues: Issue[]; quality: string } | null;
  quality: string;
  onApply: (layer: number, changes: { key: string; to: unknown }[]) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [fix, setFix] = useState<FixResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFix(null);
    setError("");
  }, [params]);

  const previewIssues = Array.isArray(report?.issues) ? (report?.issues as Issue[]) : [];
  const issues = refusal?.issues.length ? refusal.issues : previewIssues;
  if (!issues.length) return null;

  async function search() {
    setSearching(true);
    setError("");
    logEvent("fix_request", { issues });
    try {
      const result = await fetchFix(params, quality);
      setFix(result);
      logEvent("fix_result", { found: result.found, tried: result.tried, seconds: result.seconds, changes: result.changes ?? [] });
    } catch (err) {
      setError(String(err));
    } finally {
      setSearching(false);
    }
  }

  function apply() {
    if (!fix?.found || fix.layer == null || !fix.changes) return;
    logEvent("fix_apply", { changes: fix.changes });
    onApply(fix.layer, fix.changes);
  }

  function dismiss() {
    logEvent("fix_reject", { changes: fix?.changes ?? [] });
    setFix(null);
  }

  const changes = (fix?.changes ?? [])
    .map((item) => t("gate.change", { label: t(`fix.key.${item.key}`), from: show(item.from), to: show(item.to) }))
    .join(t("gate.and"));

  return (
    <div className="gate">
      <strong>{t("gate.title")}</strong>
      {refusal && <p className="gate-note">{t("gate.exportQuality")}</p>}
      <ul>
        {issues.map((item) => (
          <li key={item.code} className={`gate-issue ${item.code}`}>{t(`issue.${item.code}`, { n: item.count })}</li>
        ))}
      </ul>
      {!refusal && <p className="gate-note">{t("gate.legend")}</p>}
      {fix == null && (
        <button type="button" className="primary" disabled={searching} onClick={() => void search()}>
          {searching ? t("gate.searching") : t("gate.fix")}
        </button>
      )}
      {fix?.found && (
        <div className="gate-proposal">
          <p>{t("gate.proposal", { changes })}</p>
          <button type="button" className="primary" onClick={apply}>{t("gate.apply")}</button>
          <button type="button" className="ghost" onClick={dismiss}>{t("gate.dismiss")}</button>
        </div>
      )}
      {fix && !fix.found && fix.needed && <p className="gate-note">{t("gate.notFound", { n: fix.tried })}</p>}
      {fix && !fix.needed && <p className="gate-note">{t("gate.alreadyOk")}</p>}
      {error && <p className="warn">{error}</p>}
    </div>
  );
}
