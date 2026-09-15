import { ARTICULATION, type Phoneme } from "./codes";
import type { ScoreCard } from "./score";

export type TractFrame = {
  t: number;
  pitch: number;
  buzz: number;
  hiss: number;
  f1: number;
  b1: number;
  f2: number;
  b2: number;
  f3: number;
  b3: number;
  loud: number;
  tongueFront: number;
  tongueOpen: number;
  ph: Phoneme;
  index: number;
  dur: number;
  durScale: number;
};

export type TractDrive = {
  energy: number;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  t?: number;
};

const DT = 0.01;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** Nine tandem-resonator controls + derived tongue / loudness. */
export function cardsToFrames(cards: ScoreCard[]): TractFrame[] {
  const frames: TractFrame[] = [];
  let t = 0;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    const art = ARTICULATION[card.ph];
    const next = cards[i + 1];
    const nextArt = next ? ARTICULATION[next.ph] : art;
    const n = Math.max(1, Math.round(card.dur / DT));
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 1 : k / (n - 1);
      const blend = u * u * (3 - 2 * u);
      const burstWin = art.burst && k < Math.max(2, Math.round(0.018 / DT)) ? art.burst : 0;
      const f1 = lerp(art.f1, nextArt.f1, blend * 0.35);
      const f2 = lerp(art.f2, nextArt.f2, blend * 0.35);
      const f3 = lerp(art.f3, nextArt.f3, blend * 0.35);
      const buzz = Math.max(0, art.buzz * (1 - blend * 0.15));
      const hiss = Math.max(0, art.hiss + burstWin);
      const loud = buzz * 0.72 + hiss * 0.55;
      frames.push({
        t,
        pitch: card.pitch,
        buzz,
        hiss,
        f1,
        b1: lerp(art.b1, nextArt.b1, blend * 0.2),
        f2,
        b2: lerp(art.b2, nextArt.b2, blend * 0.2),
        f3,
        b3: lerp(art.b3, nextArt.b3, blend * 0.2),
        loud,
        tongueFront: clamp01((f2 - 700) / 1800),
        tongueOpen: clamp01((f1 - 250) / 550),
        ph: card.ph,
        index: i,
        dur: card.dur,
        durScale: 1,
      });
      t += DT;
    }
  }
  return frames;
}

export function frameAt(frames: TractFrame[], t: number): TractFrame | null {
  if (!frames.length) return null;
  const last = frames[frames.length - 1]!;
  const dur = last.t + DT;
  const u = ((t % dur) + dur) % dur;
  const i = Math.min(frames.length - 1, Math.max(0, Math.floor(u / DT)));
  return frames[i]!;
}

export const TRACT_DT = DT;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function tapeRate(drive: TractDrive) {
  const e = clamp01(drive.energy);
  if (e < 0.02) return 1;
  const sp = Math.hypot(drive.vx, drive.vy);
  return clamp(0.46 + e * 1.7 + sp * 2.9 + (0.5 - drive.cy) * 0.42, 0.34, 2.75);
}

/** Camera motion rewrites PITCH, formants, buzz/hiss and tongue. Idle drive leaves the card intact. */
export function modulateTract(frame: TractFrame, drive: TractDrive): TractFrame {
  const e = clamp01(drive.energy);
  const live = clamp01(e * 2.15 + Math.abs(drive.cx - 0.5) * 0.4 + Math.hypot(drive.vx, drive.vy) * 3.2);
  if (live < 0.02) return { ...frame, durScale: 1 };
  const t = drive.t ?? 0;
  const vibrato = 2 ** (Math.sin(t * 20) * e * 0.11);
  const pitchMul = 2 ** ((drive.cx - 0.5) * 1.42 + e * 0.82 + drive.vx * 1.55);
  const pitch = clamp(frame.pitch * pitchMul * vibrato, 55, 880);
  const f1 = clamp(frame.f1 + (drive.cy - 0.5) * 400 + e * 130 + drive.vy * 240, 150, 980);
  const f2 = clamp(frame.f2 + (drive.cx - 0.5) * 860 + drive.vx * 680 + e * 110, 460, 2950);
  const f3 = clamp(frame.f3 + e * 280 + Math.abs(drive.vy) * 420, 1700, 3900);
  const bw = 1 + e * 0.95 + Math.abs(drive.vx) * 1.4;
  const buzz = clamp01(frame.buzz * (0.48 + e * 1.15));
  const hiss = clamp01(frame.hiss * (0.32 + e * 1.7) + Math.hypot(drive.vx, drive.vy) * 0.35);
  const loud = clamp01(buzz * 0.7 + hiss * 0.52 + e * 0.28);
  const mix = (a: number, b: number) => lerp(a, b, live);
  const outF1 = mix(frame.f1, f1);
  const outF2 = mix(frame.f2, f2);
  return {
    ...frame,
    pitch: mix(frame.pitch, pitch),
    f1: outF1,
    f2: outF2,
    f3: mix(frame.f3, f3),
    b1: frame.b1 * mix(1, bw),
    b2: frame.b2 * mix(1, bw),
    b3: frame.b3 * mix(1, bw),
    buzz: mix(frame.buzz, buzz),
    hiss: mix(frame.hiss, hiss),
    loud: mix(frame.loud, loud),
    tongueFront: clamp01((outF2 - 700) / 1800),
    tongueOpen: clamp01((outF1 - 250) / 550),
    durScale: tapeRate(drive),
  };
}
