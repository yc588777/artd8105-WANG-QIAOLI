import { describe, expect, it } from "vitest";
import { expandLSystem } from "../labs/grow/lsystemEngine";

describe("l-system", () => {
  it("algae rules follow Fibonacci lengths", () => {
    const lens = [0, 1, 2, 3, 4, 5, 6].map((n) => expandLSystem("A", { A: "AB", B: "A" }, n).str.length);
    expect(lens).toEqual([1, 2, 3, 5, 8, 13, 21]);
  });

  it("known tree rewrite at iter 1", () => {
    expect(expandLSystem("F", { F: "F[+F]F[-F]F" }, 1).str).toBe("F[+F]F[-F]F");
  });
});
