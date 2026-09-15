import { describe, expect, it } from "vitest";
import { finiteBoids, FlockWorld } from "../labs/flock/boidsEngine";
import { FLOCK_DEFAULT } from "../labs/flock/flockPresets";

describe("boids", () => {
  it("keeps finite vectors", () => {
    const w = new FlockWorld(42);
    w.resize(400, 300);
    w.seed(40);
    for (let i = 0; i < 30; i++) w.step(1 / 60, FLOCK_DEFAULT, null);
    expect(finiteBoids(w)).toBe(true);
    expect(w.metrics.polarity).toBeGreaterThanOrEqual(0);
  });
});
