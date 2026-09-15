import { formatKelly, isPhoneme, normalizePhoneme, type Phoneme } from "./codes";
import { charPinyin, splitPinyin } from "./pinyin";

const LEXICON: Record<string, Phoneme[]> = {
  a: ["UH"],
  i: ["AY"],
  am: ["AE", "M"],
  an: ["AE", "N"],
  and: ["AE", "N", "D"],
  answer: ["AE", "N", "S", "ER"],
  bell: ["B", "E", "L"],
  cat: ["K", "AE", "T"],
  computer: ["K", "UH", "M", "P", "Y", "UU", "T", "ER"],
  daisy: ["D", "AY", "Z", "EE"],
  do: ["D", "UU"],
  give: ["G", "I", "V"],
  he: ["H", "EE"],
  hello: ["H", "E", "L", "O"],
  is: ["I", "Z"],
  love: ["L", "UH", "V"],
  me: ["M", "EE"],
  of: ["UH", "V"],
  saw: ["S", "AW"],
  see: ["S", "EE"],
  sing: ["S", "I", "NG"],
  song: ["S", "AW", "NG"],
  speech: ["S", "P", "EE", "SH"],
  the: ["DH", "UH"],
  this: ["DH", "I", "S"],
  that: ["DH", "AE", "T"],
  to: ["T", "UU"],
  you: ["Y", "UU"],
  your: ["Y", "AW", "R"],
  world: ["W", "ER", "L", "D"],
  was: ["W", "UH", "Z"],
  with: ["W", "I", "DH"],
  for: ["F", "AW", "R"],
  on: ["AW", "N"],
  in: ["I", "N"],
  it: ["I", "T"],
  my: ["M", "AY"],
  we: ["W", "EE"],
  she: ["SH", "EE"],
  they: ["DH", "AY"],
  are: ["AH", "R"],
  be: ["B", "EE"],
  been: ["B", "I", "N"],
  have: ["H", "AE", "V"],
  has: ["H", "AE", "Z"],
  from: ["F", "R", "UH", "M"],
  not: ["N", "AH", "T"],
  but: ["B", "UH", "T"],
  all: ["AW", "L"],
  can: ["K", "AE", "N"],
  her: ["H", "ER"],
  him: ["H", "I", "M"],
  his: ["H", "I", "Z"],
  if: ["I", "F"],
  or: ["AW", "R"],
  as: ["AE", "Z"],
  at: ["AE", "T"],
  by: ["B", "AY"],
  one: ["W", "UH", "N"],
  two: ["T", "UU"],
  three: ["TH", "R", "EE"],
  four: ["F", "AW", "R"],
  five: ["F", "AY", "V"],
  six: ["S", "I", "K", "S"],
  seven: ["S", "E", "V", "UH", "N"],
  eight: ["AY", "T"],
  nine: ["N", "AY", "N"],
  zero: ["Z", "EE", "R", "O"],
  yes: ["Y", "E", "S"],
  no: ["N", "O"],
  please: ["P", "L", "EE", "Z"],
  thank: ["TH", "AE", "NG", "K"],
  thanks: ["TH", "AE", "NG", "K", "S"],
  good: ["G", "OO", "D"],
  night: ["N", "AY", "T"],
  day: ["D", "AY"],
  time: ["T", "AY", "M"],
  light: ["L", "AY", "T"],
  sea: ["S", "EE"],
  spark: ["S", "P", "AH", "R", "K"],
  glow: ["G", "L", "O"],
  blue: ["B", "L", "UU"],
  tear: ["T", "EE", "R"],
  tears: ["T", "EE", "R", "Z"],
  ocean: ["O", "SH", "UH", "N"],
  water: ["W", "AW", "T", "ER"],
  fire: ["F", "AY", "ER"],
  wind: ["W", "I", "N", "D"],
  moon: ["M", "UU", "N"],
  sun: ["S", "UH", "N"],
  star: ["S", "T", "AH", "R"],
  stars: ["S", "T", "AH", "R", "Z"],
  music: ["M", "Y", "UU", "Z", "I", "K"],
  voice: ["V", "AY", "S"],
  sound: ["S", "AW", "N", "D"],
  machine: ["M", "UH", "SH", "EE", "N"],
  talking: ["T", "AW", "K", "I", "NG"],
  hal: ["H", "AE", "L"],
  dave: ["D", "AY", "V"],
  im: ["AY", "M"],
  dont: ["D", "O", "N", "T"],
  cant: ["K", "AE", "N", "T"],
  its: ["I", "T", "S"],
  thats: ["DH", "AE", "T", "S"],
};

const INITIAL_MAP: Record<string, Phoneme[]> = {
  b: ["B"],
  p: ["P"],
  m: ["M"],
  f: ["F"],
  d: ["D"],
  t: ["T"],
  n: ["N"],
  l: ["L"],
  g: ["G"],
  k: ["K"],
  h: ["H"],
  j: ["Y"],
  q: ["SH"],
  x: ["SH"],
  zh: ["ZH"],
  ch: ["SH"],
  sh: ["SH"],
  r: ["R"],
  z: ["Z"],
  c: ["S"],
  s: ["S"],
  y: ["Y"],
  w: ["W"],
};

const FINAL_MAP: Record<string, Phoneme[]> = {
  a: ["AH"],
  o: ["AW"],
  e: ["UH"],
  i: ["EE"],
  u: ["UU"],
  v: ["EE"],
  ai: ["AY"],
  ei: ["AY"],
  ao: ["AW"],
  ou: ["O"],
  an: ["AE", "N"],
  en: ["UH", "N"],
  ang: ["AH", "NG"],
  eng: ["UH", "NG"],
  ong: ["UU", "NG"],
  er: ["ER"],
  ia: ["EE", "AH"],
  iao: ["EE", "AW"],
  ian: ["EE", "AE", "N"],
  iang: ["EE", "AH", "NG"],
  ie: ["EE", "E"],
  iu: ["EE", "O"],
  in: ["EE", "N"],
  ing: ["EE", "NG"],
  iong: ["EE", "UU", "NG"],
  ua: ["UU", "AH"],
  uo: ["UU", "AW"],
  uai: ["UU", "AY"],
  ui: ["UU", "AY"],
  uan: ["UU", "AE", "N"],
  un: ["UU", "N"],
  uang: ["UU", "AH", "NG"],
  ueng: ["UU", "UH", "NG"],
  ue: ["EE", "E"],
  van: ["EE", "AE", "N"],
  ve: ["EE", "E"],
  vn: ["EE", "N"],
};

const CJK = /[\u3400-\u9fff]/;
const LATIN = /[a-zA-Z]/;

function pushAll(out: Phoneme[], items: Phoneme[] | undefined) {
  if (items) out.push(...items);
}

function pinyinToPhonemes(py: string): Phoneme[] {
  const { initial, final } = splitPinyin(py);
  const out: Phoneme[] = [];
  pushAll(out, INITIAL_MAP[initial]);
  pushAll(out, FINAL_MAP[final] ?? ["UH"]);
  return out.length ? out : ["UH"];
}

function cjkChar(ch: string): Phoneme[] {
  const py = charPinyin(ch);
  if (py) return pinyinToPhonemes(py);
  return ["UH"];
}

const DIGRAPHS: [RegExp, string][] = [
  [/tch/g, "CH"],
  [/ch/g, "CH"],
  [/sh/g, "SH"],
  [/th/g, "TH"],
  [/ng/g, "NG"],
  [/qu/g, "KW"],
  [/ck/g, "K"],
  [/ph/g, "F"],
  [/wh/g, "W"],
  [/kn/g, "N"],
  [/wr/g, "R"],
  [/ght/g, "T"],
  [/igh/g, "AY"],
  [/ee/g, "EE"],
  [/ea/g, "EE"],
  [/ai/g, "AY"],
  [/ay/g, "AY"],
  [/oa/g, "O"],
  [/oo/g, "UU"],
  [/au/g, "AW"],
  [/aw/g, "AW"],
  [/oi/g, "OY"],
  [/oy/g, "OY"],
  [/ou/g, "AW"],
  [/ow/g, "O"],
  [/er/g, "ER"],
  [/ir/g, "ER"],
  [/ur/g, "ER"],
  [/ar/g, "AHR"],
  [/or/g, "AWR"],
];

const TOKEN_PH: Record<string, Phoneme[]> = {
  EE: ["EE"],
  AY: ["AY"],
  AW: ["AW"],
  UU: ["UU"],
  OO: ["OO"],
  UH: ["UH"],
  AH: ["AH"],
  AE: ["AE"],
  ER: ["ER"],
  SH: ["SH"],
  ZH: ["ZH"],
  TH: ["TH"],
  DH: ["DH"],
  NG: ["NG"],
  CH: ["T", "SH"],
  KW: ["K", "W"],
  OY: ["AW", "EE"],
  AHR: ["AH", "R"],
  AWR: ["AW", "R"],
  P: ["P"],
  B: ["B"],
  T: ["T"],
  D: ["D"],
  K: ["K"],
  G: ["G"],
  M: ["M"],
  N: ["N"],
  F: ["F"],
  V: ["V"],
  S: ["S"],
  Z: ["Z"],
  H: ["H"],
  W: ["W"],
  R: ["R"],
  L: ["L"],
  Y: ["Y"],
  I: ["I"],
  E: ["E"],
  O: ["O"],
  J: ["D", "ZH"],
  X: ["K", "S"],
  C: ["K"],
  Q: ["K"],
};

function naiveWord(word: string): Phoneme[] {
  let w = word.toLowerCase();
  if (w.endsWith("'s")) w = w.slice(0, -2);
  w = w.replace(/'/g, "");
  if (!w) return [];
  const silentE = w.length > 2 && w.endsWith("e") && /[aeiou]/i.test(w[w.length - 3]!) && /[^aeiou]/i.test(w[w.length - 2]!);
  if (silentE) w = w.slice(0, -1);
  for (const [re, rep] of DIGRAPHS) w = w.replace(re, ` ${rep} `);
  w = w.replace(/[aeiou]/g, (v, i, src) => {
    if (silentE) {
      const map: Record<string, string> = { a: "AY", e: "EE", i: "AY", o: "O", u: "UU" };
      return ` ${map[v] ?? "UH"} `;
    }
    const next = src[i + 1];
    if (v === "a") return next === " " || next === undefined ? " UH " : " AE ";
    if (v === "e") return " E ";
    if (v === "i") return " I ";
    if (v === "o") return " AH ";
    return " UH ";
  });
  const out: Phoneme[] = [];
  for (const tok of w.split(/[^A-Z]+/).filter(Boolean)) {
    const mapped = TOKEN_PH[tok] ?? TOKEN_PH[tok[0]!] ?? [];
    out.push(...mapped);
  }
  return out.length ? out : ["UH"];
}

export function parseKellyStream(text: string): Phoneme[] | null {
  const parts = text
    .split(/[\s,;:|/·•—–−-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const phonemes: Phoneme[] = [];
  for (const p of parts) {
    const n = normalizePhoneme(p);
    if (!n) return null;
    phonemes.push(n);
  }
  return phonemes.every((p) => isPhoneme(p)) ? phonemes : null;
}

export type LyricToken = { raw: string; phonemes: Phoneme[]; kind: "en" | "zh" | "kelly" | "pause" };

export function tokenizeLyrics(text: string): LyricToken[] {
  const src = text.replace(/\s+/g, " ").trim();
  if (!src) return [];
  const tokens: LyricToken[] = [];
  let buf = "";
  const flushLatin = () => {
    const w = buf.trim();
    buf = "";
    if (!w) return;
    const key = w.toLowerCase().replace(/'/g, "");
    tokens.push({ raw: w, phonemes: LEXICON[key] ?? naiveWord(w), kind: "en" });
  };
  for (const ch of src) {
    if (ch === "," || ch === "." || ch === "!" || ch === "?" || ch === ";" || ch === "，" || ch === "。" || ch === "、") {
      flushLatin();
      tokens.push({ raw: ch, phonemes: ["SIL"], kind: "pause" });
      continue;
    }
    if (CJK.test(ch)) {
      flushLatin();
      tokens.push({ raw: ch, phonemes: cjkChar(ch), kind: "zh" });
      continue;
    }
    if (LATIN.test(ch) || ch === "'") {
      buf += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      flushLatin();
      continue;
    }
  }
  flushLatin();
  return tokens;
}

export function textToPhonemes(text: string): Phoneme[] {
  const kelly = parseKellyStream(text);
  if (kelly) return kelly;
  const tokens = tokenizeLyrics(text);
  const out: Phoneme[] = [];
  for (const t of tokens) out.push(...t.phonemes);
  while (out.length && out[0] === "SIL") out.shift();
  while (out.length && out[out.length - 1] === "SIL") out.pop();
  return out;
}

export function lyricsToKelly(text: string) {
  return formatKelly(textToPhonemes(text));
}
