import { describe, expect, it } from "vitest";
import { SeededRandom } from "../utils/seededRandom";
import {
  COUPLE_DEFS,
  activeCouples,
  allOnMix,
  applyShortcut,
  coupleReady,
  defaultMix,
  drivenParams,
  injectDensity,
  normalizeMix,
  pruneCouples,
  randomMix,
  toggleLayer,
  visualCount,
} from "../labs/hybrid/mixRecipe";

describe("hybrid mix recipe", () => {
  it("keeps at least one visual layer when toggling off", () => {
    const solo = toggleLayer(defaultMix(), "grow", false);
    const onlyDiff = toggleLayer(solo, "flock", false);
    expect(visualCount(onlyDiff.layers)).toBe(1);
    expect(onlyDiff.layers.diff).toBe(true);
    const refused = toggleLayer(onlyDiff, "diff", false);
    expect(refused.layers.diff).toBe(true);
    expect(visualCount(refused.layers)).toBe(1);
  });

  it("prunes couples whose layers are off", () => {
    const mix = applyShortcut("A", defaultMix());
    expect(mix.couples.trailsToDiff).toBe(true);
    const noFlock = toggleLayer(mix, "flock", false);
    expect(noFlock.layers.diff).toBe(true);
    expect(noFlock.couples.trailsToDiff).toBe(false);
    expect(noFlock.couples.diffSteerFlock).toBe(false);
  });

  it("random mix always has 2–4 visuals and a couple when any pair is ready", () => {
    for (let i = 0; i < 40; i++) {
      const mix = randomMix(new SeededRandom(1000 + i * 17));
      const n = visualCount(mix.layers);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
      const ready = COUPLE_DEFS.filter((c) => coupleReady(mix.layers, c));
      if (ready.length) expect(activeCouples(mix).length).toBeGreaterThan(0);
    }
  });

  it("shortcuts A/B/C light the expected layers", () => {
    expect(applyShortcut("A", defaultMix()).layers).toMatchObject({ flock: true, diff: true, grow: false });
    expect(applyShortcut("B", defaultMix()).layers).toMatchObject({ cell: true, grow: true, diff: true, flock: false });
    const all = applyShortcut("C", defaultMix());
    expect(visualCount(all.layers)).toBe(4);
    expect(all.layers.gene).toBe(true);
    expect(activeCouples(all).length).toBeGreaterThan(4);
    expect(visualCount(allOnMix(defaultMix()).layers)).toBe(4);
  });

  it("geneDrive blends mapped speed into flock", () => {
    const mix = normalizeMix({
      layers: { gene: true, flock: true, cell: false, grow: false, diff: false },
      couples: { geneDrive: true },
    });
    const driven = drivenParams(mix, {
      maxSpeed: 200,
      caRule: 90,
      angle: 40,
      feed: 0.06,
      kill: 0.07,
      sep: 1.8,
      cohesion: 1.5,
    });
    const idle = drivenParams({ ...mix, couples: { ...mix.couples, geneDrive: false } }, {
      maxSpeed: 200,
      caRule: 90,
      angle: 40,
      feed: 0.06,
      kill: 0.07,
      sep: 1.8,
      cohesion: 1.5,
    });
    expect(driven.flockSpeed).toBeGreaterThan(idle.flockSpeed);
  });

  it("injectDensity raises V where trails are dense", () => {
    const n = 8;
    const U = new Float32Array(n * n).fill(1);
    const V = new Float32Array(n * n);
    const grid = new Float32Array([0, 1, 0, 0]);
    injectDensity(U, V, n, grid, 2, 2, 0.5);
    expect(V[0]).toBe(0);
    expect(V[4]).toBeGreaterThan(0);
  });

  it("pruneCouples clears geneDrive without gene", () => {
    const couples = pruneCouples(defaultMix().layers, { ...defaultMix().couples, geneDrive: true });
    expect(couples.geneDrive).toBe(false);
  });

  it("fills aura size and glow when older mixes omit them", () => {
    const mix = normalizeMix({ params: { flockCount: 40 } });
    expect(mix.params.auraSize).toBe(16);
    expect(mix.params.auraGlow).toBe(1);
  });
});
