import { create } from "zustand";
import { persist } from "zustand/middleware";

type Labs = Record<string, unknown>;

type State = {
  labs: Labs;
  setLab: (id: string, value: unknown) => void;
};

export const useLabPersist = create<State>()(
  persist(
    (set) => ({
      labs: {},
      setLab: (id, value) => set((s) => ({ labs: { ...s.labs, [id]: value } })),
    }),
    { name: "m05-lab-params" },
  ),
);

export function loadLab<T>(id: string, fallback: T): T {
  const v = useLabPersist.getState().labs[id];
  return v ? ({ ...fallback, ...(v as object) } as T) : fallback;
}
