export const MAX_SHOTS = 4;
export const HIRES_SCALE = 2;

export type ShotMeta = { id: string; selected: boolean };

export function canAddShot(count: number, max = MAX_SHOTS) {
  return count >= 0 && count < max;
}

export function nextShotId(now = Date.now(), salt = 0) {
  return `shot-${now}-${salt}`;
}

export function toggleShotSelected<T extends ShotMeta>(shots: T[], id: string): T[] {
  return shots.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s));
}

export function removeShot<T extends ShotMeta>(shots: T[], id: string): T[] {
  return shots.filter((s) => s.id !== id);
}

export function exportTargets<T extends ShotMeta>(shots: T[]): T[] {
  const picked = shots.filter((s) => s.selected);
  return picked.length ? picked : shots;
}

export function shotIndexLabel(shots: { id: string }[], id: string) {
  const i = shots.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i + 1;
}
