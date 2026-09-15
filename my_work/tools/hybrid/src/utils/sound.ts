let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function tick(enabled: boolean, kind: "click" | "scan" | "done" = "click") {
  if (!enabled) return;
  try {
    const ac = audio();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "square";
    o.frequency.value = kind === "done" ? 660 : kind === "scan" ? 420 : 180;
    g.gain.value = 0.03;
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (kind === "done" ? 0.18 : 0.05));
    o.stop(ac.currentTime + 0.2);
  } catch {
    /* ignore autoplay limits */
  }
}
