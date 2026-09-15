/** Kelly–Gerstman punched-card phonetic alphabet (Bell Labs, 1961–63). */

export const CONSONANTS = [
  "P",
  "B",
  "T",
  "D",
  "K",
  "G",
  "M",
  "N",
  "NG",
  "F",
  "V",
  "S",
  "Z",
  "SH",
  "ZH",
  "H",
  "W",
  "R",
  "L",
  "Y",
  "TH",
  "DH",
] as const;

export const VOWELS = ["EE", "I", "AY", "E", "AE", "AH", "AW", "O", "OO", "UU", "UH", "ER"] as const;

export type Consonant = (typeof CONSONANTS)[number];
export type Vowel = (typeof VOWELS)[number];
export type Phoneme = Consonant | Vowel | "SIL";

export type Articulation = {
  f1: number;
  f2: number;
  f3: number;
  b1: number;
  b2: number;
  b3: number;
  buzz: number;
  hiss: number;
  dur: number;
  burst?: number;
};

const V = (f1: number, f2: number, f3: number, dur: number, buzz = 1): Articulation => ({
  f1,
  f2,
  f3,
  b1: 90,
  b2: 110,
  b3: 140,
  buzz,
  hiss: 0.02,
  dur,
});

const C = (
  f1: number,
  f2: number,
  f3: number,
  buzz: number,
  hiss: number,
  dur: number,
  extra: Partial<Articulation> = {},
): Articulation => ({
  f1,
  f2,
  f3,
  b1: extra.b1 ?? 140,
  b2: extra.b2 ?? 180,
  b3: extra.b3 ?? 220,
  buzz,
  hiss,
  dur,
  burst: extra.burst,
});

export const ARTICULATION: Record<Phoneme, Articulation> = {
  EE: V(270, 2290, 3010, 0.2),
  I: V(390, 1990, 2550, 0.14),
  AY: V(530, 1850, 2500, 0.22),
  E: V(530, 1840, 2480, 0.15),
  AE: V(660, 1720, 2410, 0.2),
  AH: V(730, 1090, 2440, 0.18),
  AW: V(570, 840, 2410, 0.22),
  O: V(490, 910, 2460, 0.2),
  OO: V(440, 1020, 2240, 0.14),
  UU: V(300, 870, 2240, 0.18),
  UH: V(640, 1190, 2390, 0.16),
  ER: V(490, 1350, 1690, 0.2),
  P: C(400, 1100, 2300, 0, 0.08, 0.07, { burst: 0.55 }),
  B: C(400, 1100, 2300, 0.35, 0.05, 0.07, { burst: 0.28 }),
  T: C(350, 1800, 2640, 0, 0.1, 0.06, { burst: 0.62 }),
  D: C(350, 1700, 2500, 0.35, 0.06, 0.07, { burst: 0.3 }),
  K: C(300, 1800, 2500, 0, 0.1, 0.07, { burst: 0.58 }),
  G: C(300, 1600, 2300, 0.35, 0.06, 0.08, { burst: 0.28 }),
  M: C(300, 1100, 2200, 0.85, 0.04, 0.11, { b1: 60, b2: 90 }),
  N: C(300, 1400, 2400, 0.85, 0.04, 0.1, { b1: 60, b2: 90 }),
  NG: C(300, 1200, 2200, 0.85, 0.04, 0.12, { b1: 60, b2: 80 }),
  F: C(340, 1400, 2500, 0.05, 0.72, 0.12, { b2: 280, b3: 320 }),
  V: C(340, 1400, 2500, 0.45, 0.42, 0.11, { b2: 240 }),
  S: C(400, 1800, 2600, 0.04, 0.92, 0.13, { b2: 320, b3: 380 }),
  Z: C(400, 1700, 2500, 0.5, 0.55, 0.12, { b2: 280 }),
  SH: C(350, 1800, 2200, 0.05, 0.88, 0.14, { b2: 300, b3: 340 }),
  ZH: C(350, 1700, 2100, 0.5, 0.5, 0.12, { b2: 260 }),
  H: C(500, 1750, 2550, 0.08, 0.42, 0.08, { b1: 200, b2: 260 }),
  W: C(300, 700, 2200, 0.7, 0.04, 0.09),
  R: C(400, 1100, 1600, 0.8, 0.05, 0.1),
  L: C(400, 1100, 2600, 0.8, 0.04, 0.1),
  Y: C(280, 2100, 2800, 0.7, 0.04, 0.08),
  TH: C(350, 1600, 2400, 0.08, 0.7, 0.11, { b2: 260 }),
  DH: C(350, 1400, 2300, 0.42, 0.38, 0.09, { b2: 220 }),
  SIL: C(500, 1500, 2500, 0, 0, 0.12),
};

export const PHONEME_SET = new Set<string>([...CONSONANTS, ...VOWELS, "SIL"]);

export function isVowel(ph: Phoneme): ph is Vowel {
  return (VOWELS as readonly string[]).includes(ph);
}

export function isPhoneme(token: string): token is Phoneme {
  return PHONEME_SET.has(token);
}

export function normalizePhoneme(raw: string): Phoneme | null {
  const t = raw.trim().toUpperCase().replace(/\./g, "");
  if (!t) return null;
  if (t === "SIL" || t === "PAUSE" || t === "_" || t === "SP") return "SIL";
  if (isPhoneme(t)) return t;
  return null;
}

export function formatKelly(phonemes: Phoneme[]) {
  return phonemes.filter((p) => p !== "SIL").join("—") || "—";
}
