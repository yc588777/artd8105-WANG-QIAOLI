import { describe, expect, it } from "vitest";
import {
  genotypeProbs,
  jointGenotypeProb,
  makeOffspring,
  phenotypeProbs,
  sumProb,
  type Parent,
} from "../labs/gene/geneticsEngine";

const p0: Parent = {
  name: "A",
  alleles: { leaf: ["A", "a"], pigment: ["A", "A"], branch: ["a", "a"] },
};
const p1: Parent = {
  name: "B",
  alleles: { leaf: ["A", "a"], pigment: ["a", "a"], branch: ["A", "a"] },
};

describe("genetics", () => {
  it("single-trait genotype probabilities sum to 1", () => {
    expect(sumProb(genotypeProbs(p0.alleles.leaf, p1.alleles.leaf))).toBeCloseTo(1, 10);
    expect(sumProb(phenotypeProbs(p0.alleles.leaf, p1.alleles.leaf, "dominant"))).toBeCloseTo(1, 10);
  });

  it("joint genotype probabilities sum to 1", () => {
    expect(sumProb(jointGenotypeProb(p0, p1))).toBeCloseTo(1, 10);
  });

  it("offspring alleles stay in {A,a}", () => {
    const rnd = () => 0.3;
    const kid = makeOffspring(p0, p1, 0.5, rnd);
    for (const k of Object.values(kid.alleles)) {
      expect(["A", "a"]).toContain(k[0]);
      expect(["A", "a"]).toContain(k[1]);
    }
  });
});
