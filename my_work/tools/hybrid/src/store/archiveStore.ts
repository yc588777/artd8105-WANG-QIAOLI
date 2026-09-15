import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArchiveEntry, LabId } from "../types";

type ArchiveState = {
  entries: ArchiveEntry[];
  add: (e: ArchiveEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useArchiveStore = create<ArchiveState>()(
  persist(
    (set) => ({
      entries: [],
      add: (e) => set((s) => ({ entries: [e, ...s.entries].slice(0, 80) })),
      remove: (id) => set((s) => ({ entries: s.entries.filter((x) => x.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    { name: "m05-archive" },
  ),
);

export function makeEntry(
  module: LabId,
  seed: number,
  params: unknown,
  thumbnail: string,
  title: string,
  challenge?: string,
): ArchiveEntry {
  return {
    id: `${module}-${seed}-${Date.now()}`,
    module,
    seed,
    createdAt: Date.now(),
    params,
    thumbnail,
    title,
    challenge,
  };
}
