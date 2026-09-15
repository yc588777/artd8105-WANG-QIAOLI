import { formatKelly, type Phoneme } from "./codes";
import { textToPhonemes, tokenizeLyrics, type LyricToken } from "./g2p";
import { scoreDuration, scorePhonemes, type ScoreCard, type ScoreOpts } from "./score";
import { IDLE_MOTION, type MotionSample } from "./motion";
import { TandemSynth } from "./synth";
import { cardsToFrames, frameAt, modulateTract, tapeRate, type TractFrame } from "./tract";

export type CompiledLyrics = {
  text: string;
  tokens: LyricToken[];
  phonemes: Phoneme[];
  kelly: string;
  cards: ScoreCard[];
  frames: TractFrame[];
  duration: number;
};

export type SpeechSnapshot = {
  playing: boolean;
  index: number;
  ph: Phoneme;
  frame: TractFrame | null;
  step: 1 | 2 | 3 | 4 | 5;
  t: number;
  rate: number;
  dur: number;
};

export function compileLyrics(text: string, opts: ScoreOpts): CompiledLyrics {
  const trimmed = text.trim();
  const tokens = tokenizeLyrics(trimmed);
  const phonemes = textToPhonemes(trimmed);
  const cards = scorePhonemes(phonemes, opts);
  const frames = cardsToFrames(cards);
  return {
    text: trimmed,
    tokens,
    phonemes,
    kelly: formatKelly(phonemes),
    cards,
    frames,
    duration: scoreDuration(cards),
  };
}

export class SpeechEngine {
  synth = new TandemSynth();
  playing = false;
  clock = 0;
  compiled: CompiledLyrics | null = null;
  private wave = new Uint8Array(1024);

  load(compiled: CompiledLyrics) {
    this.compiled = compiled;
    if (this.clock > compiled.duration) this.clock = 0;
  }

  unlock() {
    this.synth.unlock();
  }

  async start() {
    this.unlock();
    this.playing = true;
    await this.synth.ensure();
    this.synth.click();
  }

  stop() {
    this.playing = false;
    this.synth.apply(null, true);
  }

  reset() {
    this.clock = 0;
    this.stop();
  }

  advance(dt: number, drive: MotionSample = IDLE_MOTION): SpeechSnapshot {
    const compiled = this.compiled;
    const idle: SpeechSnapshot = {
      playing: false,
      index: 0,
      ph: "SIL",
      frame: null,
      step: compiled?.phonemes.length ? 3 : compiled?.text ? 1 : 1,
      t: 0,
      rate: 1,
      dur: 0,
    };
    if (!compiled) return idle;
    if (!compiled.phonemes.length) return { ...idle, step: 1 };
    const rate = this.playing ? tapeRate(drive) : 1;
    if (this.playing) this.clock += dt * rate;
    const loop = Math.max(0.05, compiled.duration);
    if (this.clock > loop) this.clock %= loop;
    const base = frameAt(compiled.frames, this.clock);
    const frame = base ? modulateTract(base, { ...drive, t: this.clock }) : null;
    if (this.playing) this.synth.apply(frame, false);
    else this.synth.apply(null, true);
    let step: SpeechSnapshot["step"] = 3;
    if (this.playing) step = 5;
    else if (frame) step = 4;
    const cardDur = frame ? compiled.cards[frame.index]?.dur ?? frame.dur : 0;
    return {
      playing: this.playing,
      index: frame?.index ?? 0,
      ph: frame?.ph ?? "SIL",
      frame,
      step,
      t: this.clock,
      rate,
      dur: cardDur / Math.max(0.2, rate),
    };
  }

  level() {
    return this.playing ? this.synth.level() : 0;
  }

  waveform() {
    this.synth.waveform(this.wave);
    return this.wave;
  }
}

export const PIPE_STEPS = [
  { id: 1 as const, zh: "文本", en: "TEXT", hint: "输入歌词，例如 He saw the cat" },
  { id: 2 as const, zh: "音素", en: "PHONEME", hint: "拆成 H—EE—S—AW—DH—UH—K—AE—T" },
  { id: 3 as const, zh: "音高 / 时长", en: "PITCH / DUR", hint: "按序写入穿孔卡片，并指定音高与时长" },
  { id: 4 as const, zh: "声道参数", en: "TRACT", hint: "程序生成响度、舌位与三共振峰" },
  { id: 5 as const, zh: "磁带 → 声音", en: "TAPE", hint: "控制信号写成声音；演唱时对齐旋律与伴奏" },
];
