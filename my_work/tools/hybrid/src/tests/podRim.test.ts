import { describe, expect, it } from "vitest";
import {
  bottomInnerPath,
  cssCornerRadii,
  topInnerLength,
  topInnerPath,
  topInnerPoints,
  trimGentle,
} from "../render/podRim";

const gene = {
  kind: "pct" as const,
  h: [0.46, 0.54, 0.42, 0.58] as [number, number, number, number],
  v: [0.52, 0.36, 0.64, 0.48] as [number, number, number, number],
};

describe("podRim", () => {
  it("scales overlapping CSS radii by one factor", () => {
    const spec = {
      kind: "pct" as const,
      h: [0.8, 0.8, 0.8, 0.8] as [number, number, number, number],
      v: [0.8, 0.8, 0.8, 0.8] as [number, number, number, number],
    };
    const { rx, ry } = cssCornerRadii(100, 80, spec);
    expect(rx[0]! + rx[1]!).toBeLessThanOrEqual(100 + 1e-6);
    expect(ry[0]! + ry[3]!).toBeLessThanOrEqual(80 + 1e-6);
    expect(rx[0]).toBeCloseTo(rx[1]!, 5);
  });

  it("builds inset top path with clockwise short arcs", () => {
    const top = topInnerPath(400, 300, gene, 10);
    expect(top.startsWith("M")).toBe(true);
    expect(top).toMatch(/A[\d.]+ [\d.]+ 0 0 1/);
    expect(top).not.toMatch(/A[\d.]+ [\d.]+ 0 0 0/);
  });

  it("builds bottom path with counter-clockwise short arcs so type stays upright", () => {
    const bot = bottomInnerPath(400, 300, gene, 10);
    expect(bot.startsWith("M")).toBe(true);
    expect(bot).toMatch(/A[\d.]+ [\d.]+ 0 0 0/);
    expect(bot).not.toMatch(/A[\d.]+ [\d.]+ 0 0 1/);
  });

  it("builds rounded-rect paths for pixel radii", () => {
    const top = topInnerPath(240, 160, { kind: "px", r: 8 }, 6);
    expect(top.startsWith("M")).toBe(true);
    expect(top).toContain("L");
    expect(top).toMatch(/A/);
  });

  it("inner top path is long enough to carry a title", () => {
    expect(topInnerLength(400, 300, gene, 10)).toBeGreaterThan(280);
  });

  it("trims the inner CSS arc away from the vertical waist", () => {
    const raw = topInnerPoints(400, 300, gene, 10);
    const trim = trimGentle(raw, "top", 0.72);
    expect(trim[0]!.y).toBeLessThan(raw[0]!.y - 20);
    expect(Math.min(...trim.map((p) => p.y))).toBeCloseTo(Math.min(...raw.map((p) => p.y)), 0);
  });
});
