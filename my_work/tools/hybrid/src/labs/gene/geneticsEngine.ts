export type Allele = "A" | "a";
export type Pair = [Allele, Allele];
export type Inheritance = "dominant" | "recessive" | "codominant";
export type TraitId = "leaf" | "pigment" | "branch";

export type TraitDef = {
  id: TraitId;
  zh: string;
  en: string;
  inheritance: Inheritance;
  dominant: { zh: string; en: string };
  recessive: { zh: string; en: string };
  mixed: { zh: string; en: string };
};

export type Parent = {
  name: string;
  alleles: Record<TraitId, Pair>;
};

export type GenotypeKey = `${Allele}${Allele}`;

export const TRAIT_ORDER: TraitId[] = ["leaf", "pigment", "branch"];

export const TRAITS: Record<TraitId, TraitDef> = {
  leaf: {
    id: "leaf",
    zh: "叶片形态",
    en: "Leaf form",
    inheritance: "dominant",
    dominant: { zh: "圆叶", en: "round" },
    recessive: { zh: "尖叶", en: "pointed" },
    mixed: { zh: "中间叶", en: "intermediate" },
  },
  pigment: {
    id: "pigment",
    zh: "色素沉积",
    en: "Pigment",
    inheritance: "dominant",
    dominant: { zh: "深色脉纹", en: "dark veins" },
    recessive: { zh: "浅色脉纹", en: "pale veins" },
    mixed: { zh: "嵌合脉纹", en: "mosaic veins" },
  },
  branch: {
    id: "branch",
    zh: "分枝密度",
    en: "Branching",
    inheritance: "dominant",
    dominant: { zh: "密枝", en: "dense" },
    recessive: { zh: "疏枝", en: "sparse" },
    mixed: { zh: "不对称枝", en: "asymmetric" },
  },
};

export function normalizePair(a: Allele, b: Allele): Pair {
  if (a === "A" && b === "A") return ["A", "A"];
  if (a === "a" && b === "a") return ["a", "a"];
  return ["A", "a"];
}

export function pairKey(p: Pair): GenotypeKey {
  const n = normalizePair(p[0], p[1]);
  return `${n[0]}${n[1]}`;
}

export function punnettCells(p1: Pair, p2: Pair): Pair[] {
  const out: Pair[] = [];
  for (const a of p1) for (const b of p2) out.push(normalizePair(a, b));
  return out;
}

export type Counted<T> = { value: T; p: number };

export function genotypeProbs(p1: Pair, p2: Pair): Counted<GenotypeKey>[] {
  const cells = punnettCells(p1, p2);
  const map = new Map<GenotypeKey, number>();
  for (const c of cells) {
    const k = pairKey(c);
    map.set(k, (map.get(k) ?? 0) + 0.25);
  }
  return [...map.entries()].map(([value, p]) => ({ value, p }));
}

export function phenotypeOf(pair: Pair, mode: Inheritance): "dominant" | "recessive" | "mixed" {
  const k = pairKey(pair);
  if (mode === "codominant" && k === "Aa") return "mixed";
  if (k.includes("A")) return "dominant";
  return "recessive";
}

export function phenotypeProbs(p1: Pair, p2: Pair, mode: Inheritance): Counted<string>[] {
  const cells = punnettCells(p1, p2);
  const map = new Map<string, number>();
  for (const c of cells) {
    const ph = phenotypeOf(c, mode);
    map.set(ph, (map.get(ph) ?? 0) + 0.25);
  }
  return [...map.entries()].map(([value, p]) => ({ value, p }));
}

export function sumProb(items: { p: number }[]) {
  return items.reduce((s, x) => s + x.p, 0);
}

export type Offspring = {
  alleles: Record<TraitId, Pair>;
  mutated: { trait: TraitId; from: Pair; to: Pair }[];
};

export function sampleAllele(pair: Pair, rnd: () => number): Allele {
  return rnd() < 0.5 ? pair[0] : pair[1];
}

export function maybeMutate(a: Allele, rate: number, rnd: () => number): Allele {
  if (rnd() >= rate) return a;
  return a === "A" ? "a" : "A";
}

export function crossParents(
  a: Parent,
  b: Parent,
  traits: Record<TraitId, TraitDef>,
  mutationRate: number,
  rnd: () => number,
): Offspring {
  const alleles = {} as Record<TraitId, Pair>;
  const mutated: Offspring["mutated"] = [];
  for (const id of TRAIT_ORDER) {
    const raw: Pair = [
      maybeMutate(sampleAllele(a.alleles[id], rnd), mutationRate, rnd),
      maybeMutate(sampleAllele(b.alleles[id], rnd), mutationRate, rnd),
    ];
    const to = normalizePair(raw[0], raw[1]);
    alleles[id] = to;
    const expected = normalizePair(sampleAllele(a.alleles[id], () => 0), sampleAllele(b.alleles[id], () => 0));
    if (pairKey(to) !== pairKey(normalizePair(a.alleles[id][0], b.alleles[id][0])) && mutationRate > 0) {
      const orig = normalizePair(
        maybeMutate(sampleAllele(a.alleles[id], () => 0.25), 0, rnd),
        maybeMutate(sampleAllele(b.alleles[id], () => 0.25), 0, rnd),
      );
      if (pairKey(to) !== pairKey(orig)) mutated.push({ trait: id, from: orig, to });
    }
    void expected;
    void traits;
  }
  return { alleles, mutated };
}

export function detectMutations(
  expected: Record<TraitId, Pair>,
  actual: Record<TraitId, Pair>,
): Offspring["mutated"] {
  const mutated: Offspring["mutated"] = [];
  for (const id of TRAIT_ORDER) {
    if (pairKey(expected[id]) !== pairKey(actual[id])) {
      mutated.push({ trait: id, from: expected[id], to: actual[id] });
    }
  }
  return mutated;
}

export function makeOffspring(
  a: Parent,
  b: Parent,
  mutationRate: number,
  rnd: () => number,
): Offspring {
  const alleles = {} as Record<TraitId, Pair>;
  const expected = {} as Record<TraitId, Pair>;
  for (const id of TRAIT_ORDER) {
    const ea = sampleAllele(a.alleles[id], rnd);
    const eb = sampleAllele(b.alleles[id], rnd);
    expected[id] = normalizePair(ea, eb);
    alleles[id] = normalizePair(maybeMutate(ea, mutationRate, rnd), maybeMutate(eb, mutationRate, rnd));
  }
  return { alleles, mutated: detectMutations(expected, alleles) };
}

export type GeneCode = {
  version: 1;
  seed: number;
  mutationRate: number;
  inheritance: Record<TraitId, Inheritance>;
  parents: [Parent, Parent];
};

export function encodeGeneCode(code: GeneCode) {
  const pack = (p: Parent) =>
    TRAIT_ORDER.map((id) => `${id[0]!.toUpperCase()}:${p.alleles[id].join("")}`).join("|");
  const inh = TRAIT_ORDER.map((id) => `${id[0]!.toUpperCase()}:${code.inheritance[id][0]}`).join("|");
  return `GEN-CODE v1 S${code.seed} M${code.mutationRate.toFixed(3)} I[${inh}] P0[${pack(code.parents[0])}] P1[${pack(code.parents[1])}]`;
}

export function parseGeneCode(text: string): GeneCode | null {
  const m = text.match(
    /GEN-CODE v1 S(\d+) M([\d.]+) I\[([^\]]+)\] P0\[([^\]]+)\] P1\[([^\]]+)\]/,
  );
  if (!m) return null;
  const inhMap: Record<string, Inheritance> = { d: "dominant", r: "recessive", c: "codominant" };
  const parseInh = (s: string) => {
    const rec = {} as Record<TraitId, Inheritance>;
    for (const part of s.split("|")) {
      const [k, v] = part.split(":");
      const id = TRAIT_ORDER.find((t) => t[0]!.toUpperCase() === k);
      if (id) rec[id] = inhMap[v ?? "d"] ?? "dominant";
    }
    return rec;
  };
  const parseParent = (name: string, s: string): Parent => {
    const alleles = {} as Record<TraitId, Pair>;
    for (const part of s.split("|")) {
      const [k, v] = part.split(":");
      const id = TRAIT_ORDER.find((t) => t[0]!.toUpperCase() === k);
      if (id && v && v.length >= 2) alleles[id] = normalizePair(v[0] as Allele, v[1] as Allele);
    }
    return { name, alleles };
  };
  return {
    version: 1,
    seed: Number(m[1]),
    mutationRate: Number(m[2]),
    inheritance: parseInh(m[3]!),
    parents: [parseParent("P0", m[4]!), parseParent("P1", m[5]!)],
  };
}

export function jointGenotypeProb(p0: Parent, p1: Parent): Counted<string>[] {
  const maps = TRAIT_ORDER.map((id) => genotypeProbs(p0.alleles[id], p1.alleles[id]));
  const out: Counted<string>[] = [];
  for (const a of maps[0]!)
    for (const b of maps[1]!)
      for (const c of maps[2]!) {
        out.push({ value: `${a.value}/${b.value}/${c.value}`, p: a.p * b.p * c.p });
      }
  return out.filter((x) => x.p > 0);
}

export type EditStep = "cut" | "repair" | "result";

export function editLocus(
  pair: Pair,
  target: Allele,
  offTarget: number,
  rnd: () => number,
): { pair: Pair; offTargetHit: boolean } {
  const hitOff = rnd() < offTarget;
  if (hitOff) {
    const flipped: Pair = normalizePair(pair[0] === "A" ? "a" : "A", pair[1]);
    return { pair: flipped, offTargetHit: true };
  }
  return { pair: normalizePair(target, target), offTargetHit: false };
}

export function offTargetRisk(sequenceHint: number, mismatch: number) {
  const raw = 0.04 + mismatch * 0.12 + (1 - sequenceHint) * 0.08;
  return Math.min(0.45, Math.max(0.02, raw));
}

export function mapGeneToWorld(code: GeneCode) {
  const score = (p: Pair) => (pairKey(p) === "AA" ? 1 : pairKey(p) === "Aa" ? 0.5 : 0);
  const leaf = (score(code.parents[0].alleles.leaf) + score(code.parents[1].alleles.leaf)) / 2;
  const pigment =
    (score(code.parents[0].alleles.pigment) + score(code.parents[1].alleles.pigment)) / 2;
  const branch = (score(code.parents[0].alleles.branch) + score(code.parents[1].alleles.branch)) / 2;
  return {
    maxSpeed: 80 + leaf * 120,
    caRule: Math.round(30 + pigment * 80),
    angle: 16 + branch * 28,
    feed: 0.02 + code.mutationRate * 0.04,
    kill: 0.05 + pigment * 0.02,
    sep: 0.8 + leaf,
    cohesion: 0.6 + branch,
  };
}
