import { ARTICULATION, isVowel, type Phoneme } from "./codes";

/** Daisy Bell–adjacent pentatonic loop (Hz), used when singing. */
export const DAISY_HZ = [262, 294, 330, 262, 330, 349, 392, 392, 349, 330, 294, 262, 247, 262];

export type ScoreOpts = {
  sing: boolean;
  rate: number;
  pitch: number;
};

export type ScoreCard = {
  ph: Phoneme;
  pitch: number;
  dur: number;
  vowel: boolean;
};

export function scorePhonemes(phonemes: Phoneme[], opts: ScoreOpts): ScoreCard[] {
  const rate = Math.max(0.45, Math.min(2.2, opts.rate));
  const base = Math.max(70, Math.min(320, opts.pitch));
  let vowelN = 0;
  const cards: ScoreCard[] = [];
  for (let i = 0; i < phonemes.length; i++) {
    const ph = phonemes[i]!;
    const art = ARTICULATION[ph];
    const vowel = isVowel(ph);
    let pitch = base;
    if (opts.sing && vowel) {
      pitch = DAISY_HZ[vowelN % DAISY_HZ.length]!;
      vowelN += 1;
    } else if (opts.sing) {
      const nextV = phonemes.slice(i + 1).find(isVowel);
      const prev = [...cards].reverse().find((c) => c.vowel);
      pitch = nextV ? DAISY_HZ[vowelN % DAISY_HZ.length]! : (prev?.pitch ?? base);
    }
    let dur = art.dur / rate;
    if (opts.sing && vowel) dur *= 1.55;
    if (opts.sing && !vowel && ph !== "SIL") dur *= 0.82;
    cards.push({ ph, pitch, dur, vowel });
  }
  if (!cards.length) cards.push({ ph: "SIL", pitch: base, dur: 0.2, vowel: false });
  return cards;
}

export function scoreDuration(cards: ScoreCard[]) {
  return cards.reduce((s, c) => s + c.dur, 0);
}
