let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let master: GainNode | null = null;
let seq: number | null = null;
let step = 0;
let bpm = 135;
const timeBuf = new Uint8Array(1024);

function audio() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.03) {
  const ac = audio();
  if (!master) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(master);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.stop(ac.currentTime + dur + 0.02);
}

function tickSeq() {
  const s = step % 8;
  if (s === 0) beep(523, 0.08, "sine", 0.025);
  if (s === 1) beep(130, 0.12, "sawtooth", 0.012);
  if (s === 2) beep(55, 0.14, "sine", 0.04);
  if (s === 3) beep(2400, 0.04, "square", 0.008);
  if (s === 4) beep(659, 0.08, "sine", 0.022);
  if (s === 5) beep(55, 0.12, "sine", 0.035);
  if (s === 6) beep(98, 0.12, "sawtooth", 0.01);
  if (s === 7) beep(1800, 0.04, "square", 0.007);
  step++;
}

export async function setAuraEngine(on: boolean) {
  try {
    const ac = audio();
    if (on) {
      if (ac.state === "suspended") await ac.resume();
      if (!analyser) {
        analyser = ac.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.8;
        master = ac.createGain();
        master.gain.value = 0.7;
        master.connect(analyser);
        analyser.connect(ac.destination);
      }
      if (seq == null) {
        step = 0;
        tickSeq();
        seq = window.setInterval(tickSeq, (60 / bpm) * 1000);
      }
    } else if (seq != null) {
      window.clearInterval(seq);
      seq = null;
    }
  } catch {
    /* autoplay / unsupported */
  }
}

export function setAuraTempo(next: number) {
  bpm = Math.max(80, Math.min(210, next));
  if (seq != null) {
    window.clearInterval(seq);
    seq = window.setInterval(tickSeq, (60 / bpm) * 1000);
  }
}

export function auraLevel() {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(timeBuf);
  let sum = 0;
  for (let i = 0; i < timeBuf.length; i++) {
    const v = (timeBuf[i]! - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / timeBuf.length);
  return Math.max(0, Math.min(1.5, rms * 6));
}
