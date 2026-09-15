import { describe, expect, it } from "vitest";
import { nextElementaryRow } from "../labs/cell/elementaryCA";
import { BLINKER, placePattern, stepLife } from "../labs/cell/gameOfLife";

describe("cellular automata", () => {
  it("blinker oscillates with period 2", () => {
    const cols = 5,
      rows = 5;
    const g = new Uint8Array(cols * rows);
    const n = new Uint8Array(cols * rows);
    placePattern(g, cols, rows, 1, 2, BLINKER);
    stepLife(g, n, cols, rows, [3], [2, 3], true);
    expect(n[1 * cols + 2]).toBe(1);
    expect(n[2 * cols + 2]).toBe(1);
    expect(n[3 * cols + 2]).toBe(1);
    const g2 = new Uint8Array(n);
    const n2 = new Uint8Array(cols * rows);
    stepLife(g2, n2, cols, rows, [3], [2, 3], true);
    expect(n2[2 * cols + 1]).toBe(1);
    expect(n2[2 * cols + 2]).toBe(1);
    expect(n2[2 * cols + 3]).toBe(1);
  });

  it("rule 90 from a single 1 is XOR of neighbors", () => {
    const prev = new Uint8Array(7);
    prev[3] = 1;
    const next = nextElementaryRow(prev, 90, true);
    expect([...next]).toEqual([0, 0, 1, 0, 1, 0, 0]);
  });
});
