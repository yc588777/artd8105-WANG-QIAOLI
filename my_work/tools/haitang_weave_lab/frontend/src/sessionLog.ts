type Pending = { type: string; payload: Record<string, unknown>; session_clock: number };

let sessionId: string | null = null;
let startedAt = 0;
let queue: Pending[] = [];
let timer: number | null = null;

export function attachSession(id: string | null, startedEpochSeconds = 0) {
  if (sessionId && sessionId !== id) void flush();
  sessionId = id;
  startedAt = startedEpochSeconds * 1000;
}

export function sessionClock(): number {
  return startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0;
}

export function logEvent(type: string, payload: Record<string, unknown> = {}) {
  if (!sessionId) return;
  queue.push({ type, payload, session_clock: Math.round(sessionClock() * 100) / 100 });
  if (timer == null) timer = window.setTimeout(() => void flush(), 2500);
}

export async function flush() {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (!sessionId || !queue.length) return;
  const events = queue;
  queue = [];
  try {
    await fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
  } catch {
    queue = [...events, ...queue];
  }
}

window.addEventListener("beforeunload", () => {
  if (!sessionId || !queue.length) return;
  navigator.sendBeacon(`/api/sessions/${sessionId}/events`, new Blob([JSON.stringify({ events: queue })], { type: "application/json" }));
});

/** Flat key→value view of the parameters, so a change can be logged as key, from, to. */
export function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === "object" && "id" in (item as object))) {
      for (const item of value as Array<Record<string, unknown>>) flatten(item, `${prefix}${String(item.id)}.`, out);
    } else {
      out[prefix.replace(/\.$/, "")] = JSON.stringify(value);
    }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) flatten(item, `${prefix}${key}.`, out);
  } else {
    out[prefix.replace(/\.$/, "")] = value;
  }
  return out;
}
