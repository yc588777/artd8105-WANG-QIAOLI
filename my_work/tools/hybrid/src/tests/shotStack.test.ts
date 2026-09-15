import { describe, expect, it } from "vitest";
import { stampName } from "../utils/exportCanvas";
import {
  MAX_SHOTS,
  canAddShot,
  exportTargets,
  nextShotId,
  removeShot,
  shotIndexLabel,
  toggleShotSelected,
} from "../utils/shotStack";

describe("shot stack", () => {
  it("allows up to four captures", () => {
    expect(canAddShot(0)).toBe(true);
    expect(canAddShot(3)).toBe(true);
    expect(canAddShot(4)).toBe(false);
    expect(canAddShot(4, MAX_SHOTS)).toBe(false);
  });

  it("toggles selection and removes shots", () => {
    const a = { id: "a", selected: true };
    const b = { id: "b", selected: false };
    expect(toggleShotSelected([a, b], "b").map((s) => s.selected)).toEqual([true, true]);
    expect(removeShot([a, b], "a")).toEqual([b]);
  });

  it("exports selected shots, or all if none selected", () => {
    const shots = [
      { id: "a", selected: false },
      { id: "b", selected: true },
      { id: "c", selected: false },
    ];
    expect(exportTargets(shots).map((s) => s.id)).toEqual(["b"]);
    expect(exportTargets(shots.map((s) => ({ ...s, selected: false }))).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("labels shot order from 1", () => {
    const shots = [{ id: "a" }, { id: "b" }];
    expect(shotIndexLabel(shots, "b")).toBe(2);
    expect(shotIndexLabel(shots, "z")).toBe(0);
    expect(nextShotId(1, 2)).toBe("shot-1-2");
  });

  it("stamps hi-res filenames with shot tag", () => {
    const name = stampName("flock", 12, "png", "SHOT2x2");
    expect(name.startsWith("M05_FLOCK_0012_SHOT2x2_")).toBe(true);
    expect(name.endsWith(".png")).toBe(true);
  });
});
