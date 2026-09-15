import type { GeneCode, Parent, TraitId } from "./geneticsEngine";

const baseParents = (a: Record<TraitId, Parent["alleles"][TraitId]>, b: Record<TraitId, Parent["alleles"][TraitId]>): [Parent, Parent] => [
  { name: "P0", alleles: a },
  { name: "P1", alleles: b },
];

export const GENE_PRESETS: { id: string; zh: string; en: string; code: Omit<GeneCode, "seed"> }[] = [
  {
    id: "mendel",
    zh: "孟德尔遗传",
    en: "Mendelian",
    code: {
      version: 1,
      mutationRate: 0,
      inheritance: { leaf: "dominant", pigment: "dominant", branch: "dominant" },
      parents: baseParents(
        { leaf: ["A", "A"], pigment: ["A", "a"], branch: ["a", "a"] },
        { leaf: ["a", "a"], pigment: ["A", "a"], branch: ["A", "a"] },
      ),
    },
  },
  {
    id: "codominant",
    zh: "共显性",
    en: "Codominance",
    code: {
      version: 1,
      mutationRate: 0,
      inheritance: { leaf: "codominant", pigment: "codominant", branch: "codominant" },
      parents: baseParents(
        { leaf: ["A", "A"], pigment: ["A", "a"], branch: ["A", "a"] },
        { leaf: ["a", "a"], pigment: ["A", "a"], branch: ["a", "a"] },
      ),
    },
  },
  {
    id: "mutator",
    zh: "高突变率",
    en: "High mutation",
    code: {
      version: 1,
      mutationRate: 0.18,
      inheritance: { leaf: "dominant", pigment: "dominant", branch: "dominant" },
      parents: baseParents(
        { leaf: ["A", "a"], pigment: ["A", "a"], branch: ["A", "a"] },
        { leaf: ["A", "a"], pigment: ["A", "a"], branch: ["A", "a"] },
      ),
    },
  },
];

export const DEFAULT_GENE = GENE_PRESETS[0]!.code;
