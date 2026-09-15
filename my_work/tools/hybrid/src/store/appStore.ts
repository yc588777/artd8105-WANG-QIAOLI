import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang, ModuleId, Theme } from "../types";

type AppState = {
  lang: Lang;
  theme: Theme;
  sound: boolean;
  seed: number;
  fps: number;
  running: boolean;
  log: string;
  bootDone: boolean;
  tour: boolean;
  lastModule: ModuleId;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  setSound: (v: boolean) => void;
  setSeed: (n: number) => void;
  randomizeSeed: () => void;
  setFps: (n: number) => void;
  setRunning: (v: boolean) => void;
  setLog: (s: string) => void;
  setBootDone: (v: boolean) => void;
  setTour: (v: boolean) => void;
  setLastModule: (m: ModuleId) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lang: "zh",
      theme: "lab",
      sound: false,
      seed: 882,
      fps: 0,
      running: true,
      log: "SYSTEM READY // MORPHOSYSTEM 05",
      bootDone: false,
      tour: false,
      lastModule: "gene",
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setSound: (sound) => set({ sound }),
      setSeed: (seed) => set({ seed: seed >>> 0 || 1 }),
      randomizeSeed: () => set({ seed: (Math.floor(Math.random() * 9999) + 1) }),
      setFps: (fps) => set({ fps }),
      setRunning: (running) => set({ running }),
      setLog: (log) => set({ log }),
      setBootDone: (bootDone) => set({ bootDone }),
      setTour: (tour) => set({ tour }),
      setLastModule: (lastModule) => set({ lastModule }),
    }),
    {
      name: "m05-app",
      partialize: (s) => ({
        lang: s.lang,
        theme: s.theme,
        sound: s.sound,
        seed: s.seed,
        lastModule: s.lastModule,
        bootDone: s.bootDone,
      }),
    },
  ),
);
