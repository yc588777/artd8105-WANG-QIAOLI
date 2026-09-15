import { describe, expect, it } from "vitest";
import { fieldIsFinite, seedSpot, stepGrayScottCPU } from "../labs/diff/reactionDiffusion";

describe("reaction-diffusion", () => {
  it("CPU Gray–Scott stays finite", () => {
    const n = 32;
    const U = new Float32Array(n * n);
    const V = new Float32Array(n * n);
    const Un = new Float32Array(n * n);
    const Vn = new Float32Array(n * n);
    seedSpot(U, V, n, () => 0.5);
    for (let i = 0; i < 20; i++) {
      stepGrayScottCPU(U, V, Un, Vn, n, { Du: 0.16, Dv: 0.08, F: 0.035, K: 0.065, dt: 1 });
      U.set(Un);
      V.set(Vn);
    }
    expect(fieldIsFinite(U)).toBe(true);
    expect(fieldIsFinite(V)).toBe(true);
  });
});
