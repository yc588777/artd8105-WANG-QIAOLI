import type { CompiledLyrics, SpeechSnapshot } from "./engine";
import { PIPE_STEPS } from "./engine";
import type { MotionSample } from "./motion";
import type { Phoneme } from "./codes";

function tapeIndex(all: Phoneme[], index: number) {
  let seen = -1;
  let last = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i] === "SIL") continue;
    seen += 1;
    last = seen;
    if (i === index) return seen;
  }
  return last;
}

export function drawSpeechOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  compiled: CompiledLyrics,
  snap: SpeechSnapshot,
  wave: Uint8Array,
  motion: MotionSample,
) {
  const sounding = compiled.phonemes.filter((p) => p !== "SIL");
  const mapIndex = tapeIndex(compiled.phonemes, snap.index);

  ctx.save();
  ctx.fillStyle = "rgba(5,5,8,0.55)";
  ctx.fillRect(0, h - 72, w, 56);

  ctx.beginPath();
  ctx.strokeStyle = snap.playing ? "rgba(0,240,255,0.7)" : "rgba(0,240,255,0.28)";
  ctx.lineWidth = 1;
  const y0 = h - 64;
  const span = Math.min(w, wave.length);
  for (let i = 0; i < span; i++) {
    const x = (i / span) * w;
    const v = (wave[i]! - 128) / 128;
    const y = y0 + v * 8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.font = "11px IBM Plex Mono";
  ctx.textBaseline = "middle";
  const start = Math.max(0, mapIndex - 8);
  const shown = sounding.slice(start, start + 18);
  let x = 12;
  const y = h - 38;
  for (let i = 0; i < shown.length; i++) {
    const ph = shown[i]!;
    const on = start + i === mapIndex;
    ctx.fillStyle = on ? "#FFC800" : "rgba(0,240,255,0.7)";
    const label = on ? `[${ph}]` : ph;
    ctx.fillText(label, x, y);
    x += ctx.measureText(label).width + 10;
  }

  ctx.font = "9px IBM Plex Mono";
  let sx = 12;
  for (const step of PIPE_STEPS) {
    const live = snap.playing && snap.step === step.id;
    const done = Boolean(compiled.text) && step.id <= (snap.playing ? 5 : compiled.phonemes.length ? 4 : 1);
    ctx.fillStyle = live ? "#00F0FF" : done ? "rgba(0,240,255,0.55)" : "rgba(141,146,149,0.45)";
    const label = `${step.id} ${step.en}`;
    ctx.fillText(label, sx, 78);
    sx += ctx.measureText(label).width + 14;
  }

  if (snap.frame) {
    const f = snap.frame;
    ctx.fillStyle = snap.playing ? "rgba(0,240,255,0.8)" : "rgba(141,146,149,0.7)";
    ctx.font = "10px IBM Plex Mono";
    ctx.fillText(
      `PITCH ${f.pitch.toFixed(0)}  DUR ${(snap.dur * 1000).toFixed(0)}ms  RATE ${snap.rate.toFixed(2)}  F1 ${f.f1.toFixed(0)}  F2 ${f.f2.toFixed(0)}  TRACT ${f.buzz.toFixed(2)}/${f.hiss.toFixed(2)}`,
      12,
      96,
    );
  }

  if (motion.energy > 0.04) {
    const mx = motion.cx * w;
    const my = motion.cy * h;
    const r = 10 + motion.energy * 28;
    ctx.strokeStyle = `rgba(0,240,255,${0.25 + motion.energy * 0.45})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 8, my);
    ctx.lineTo(mx + 8, my);
    ctx.moveTo(mx, my - 8);
    ctx.lineTo(mx, my + 8);
    ctx.stroke();
  }
  ctx.restore();
}
