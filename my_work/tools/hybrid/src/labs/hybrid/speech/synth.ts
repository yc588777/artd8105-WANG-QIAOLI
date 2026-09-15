import { isVowel } from "./codes";
import type { TractFrame } from "./tract";

function makeNoise(ctx: AudioContext, seconds = 1.2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function formant(ctx: AudioContext, freq: number, q: number) {
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = 0;
  f.connect(g);
  return { f, g };
}

export class TandemSynth {
  ctx: AudioContext | null = null;
  private buzz: OscillatorNode | null = null;
  private buzzGain: GainNode | null = null;
  private hissGain: GainNode | null = null;
  private body: BiquadFilterNode | null = null;
  private bodyGain: GainNode | null = null;
  private f1: BiquadFilterNode | null = null;
  private f2: BiquadFilterNode | null = null;
  private f3: BiquadFilterNode | null = null;
  private f1g: GainNode | null = null;
  private f2g: GainNode | null = null;
  private f3g: GainNode | null = null;
  private bass: OscillatorNode | null = null;
  private fifth: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;
  private fifthGain: GainNode | null = null;
  private master: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  private timeBuf = new Uint8Array(1024);
  private started = false;
  private lastPh = "";

  unlock() {
    if (this.started && !this.f1g && this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.started = false;
      this.buzz = null;
      this.master = null;
    }
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  async ensure() {
    const ctx = this.unlock();
    if (ctx.state === "suspended") await ctx.resume();
    if (this.started && this.buzz && this.f1g && this.bass && this.master) return;

    const buzz = ctx.createOscillator();
    buzz.type = "sawtooth";
    buzz.frequency.value = 140;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0;

    const hiss = ctx.createBufferSource();
    hiss.buffer = makeNoise(ctx);
    hiss.loop = true;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0;

    const source = ctx.createGain();
    source.gain.value = 1;
    buzz.connect(buzzGain);
    hiss.connect(hissGain);
    buzzGain.connect(source);
    hissGain.connect(source);

    const body = ctx.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = 900;
    body.Q.value = 0.7;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0;
    source.connect(body);
    body.connect(bodyGain);

    const a1 = formant(ctx, 500, 6);
    const a2 = formant(ctx, 1500, 7);
    const a3 = formant(ctx, 2500, 6);
    source.connect(a1.f);
    source.connect(a2.f);
    source.connect(a3.f);

    const bass = ctx.createOscillator();
    bass.type = "triangle";
    bass.frequency.value = 70;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0;
    bass.connect(bassGain);

    const fifth = ctx.createOscillator();
    fifth.type = "sine";
    fifth.frequency.value = 210;
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = 0;
    fifth.connect(fifthGain);

    const mix = ctx.createGain();
    mix.gain.value = 1;
    bodyGain.connect(mix);
    a1.g.connect(mix);
    a2.g.connect(mix);
    a3.g.connect(mix);
    bassGain.connect(mix);
    fifthGain.connect(mix);

    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.14;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.45;

    mix.connect(master);
    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);

    buzz.start();
    hiss.start();
    bass.start();
    fifth.start();
    this.started = true;

    this.buzz = buzz;
    this.buzzGain = buzzGain;
    this.hissGain = hissGain;
    this.body = body;
    this.bodyGain = bodyGain;
    this.f1 = a1.f;
    this.f2 = a2.f;
    this.f3 = a3.f;
    this.f1g = a1.g;
    this.f2g = a2.g;
    this.f3g = a3.g;
    this.bass = bass;
    this.fifth = fifth;
    this.bassGain = bassGain;
    this.fifthGain = fifthGain;
    this.master = master;
    this.analyser = analyser;
  }

  click() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(master);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    o.stop(ctx.currentTime + 0.1);
  }

  apply(frame: TractFrame | null, mute = false) {
    if (!this.ctx || !this.buzz || !this.master) return;
    const t = this.ctx.currentTime;
    const tau = 0.01;
    if (!frame || mute) {
      this.buzzGain!.gain.setTargetAtTime(0, t, tau);
      this.hissGain!.gain.setTargetAtTime(0, t, tau);
      this.bodyGain!.gain.setTargetAtTime(0, t, tau);
      this.f1g!.gain.setTargetAtTime(0, t, tau);
      this.f2g!.gain.setTargetAtTime(0, t, tau);
      this.f3g!.gain.setTargetAtTime(0, t, tau);
      this.bassGain!.gain.setTargetAtTime(0, t, tau);
      this.fifthGain!.gain.setTargetAtTime(0, t, tau);
      return;
    }
    const pitch = Math.max(55, frame.pitch);
    const loud = 0.62 + frame.loud * 0.7;
    const vowel = isVowel(frame.ph);
    this.buzz.frequency.setTargetAtTime(pitch, t, tau);
    this.buzzGain!.gain.setTargetAtTime(Math.max(0.02, frame.buzz) * 0.3 * loud, t, tau);
    this.hissGain!.gain.setTargetAtTime((frame.hiss + (vowel ? 0.02 : 0.08)) * 0.18 * loud, t, tau);
    this.body!.frequency.setTargetAtTime(Math.max(260, frame.f1 * 1.18), t, 0.02);
    this.bodyGain!.gain.setTargetAtTime((vowel ? 0.24 : 0.09) * loud, t, tau);
    this.f1!.frequency.setTargetAtTime(frame.f1, t, tau);
    this.f2!.frequency.setTargetAtTime(frame.f2, t, tau);
    this.f3!.frequency.setTargetAtTime(frame.f3, t, tau);
    this.f1!.Q.setTargetAtTime(Math.max(2.2, Math.min(14, frame.f1 / Math.max(28, frame.b1))), t, tau);
    this.f2!.Q.setTargetAtTime(Math.max(2.2, Math.min(14, frame.f2 / Math.max(28, frame.b2))), t, tau);
    this.f3!.Q.setTargetAtTime(Math.max(2, Math.min(12, frame.f3 / Math.max(40, frame.b3))), t, tau);
    this.f1g!.gain.setTargetAtTime(0.58 * loud, t, tau);
    this.f2g!.gain.setTargetAtTime(0.44 * loud, t, tau);
    this.f3g!.gain.setTargetAtTime(0.24 * loud, t, tau);
    this.bass!.frequency.setTargetAtTime(pitch / 2, t, 0.03);
    this.fifth!.frequency.setTargetAtTime(pitch * 1.5, t, 0.03);
    const band = vowel ? 0.12 : 0.038;
    this.bassGain!.gain.setTargetAtTime(band * loud, t, 0.04);
    this.fifthGain!.gain.setTargetAtTime(band * 0.48 * loud, t, 0.04);
    this.master.gain.setTargetAtTime(0.95, t, 0.05);

    if (frame.ph !== this.lastPh && vowel) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = pitch * 2;
      g.gain.value = 0.05 * loud;
      o.connect(g);
      g.connect(this.master);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.stop(t + 0.14);
    }
    this.lastPh = frame.ph;
  }

  level() {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.timeBuf);
    let sum = 0;
    for (let i = 0; i < this.timeBuf.length; i++) {
      const v = (this.timeBuf[i]! - 128) / 128;
      sum += v * v;
    }
    return Math.min(1.6, Math.sqrt(sum / this.timeBuf.length) * 7);
  }

  waveform(into: Uint8Array) {
    if (!this.analyser) {
      into.fill(128);
      return;
    }
    this.analyser.getByteTimeDomainData(this.timeBuf);
    const n = Math.min(into.length, this.timeBuf.length);
    for (let i = 0; i < n; i++) into[i] = this.timeBuf[i]!;
  }
}
