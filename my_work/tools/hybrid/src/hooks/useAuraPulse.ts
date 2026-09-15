import { useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { auraLevel, setAuraEngine } from "../utils/auraAudio";

export function useAuraPulse() {
  const sound = useAppStore((s) => s.sound);
  useEffect(() => {
    void setAuraEngine(sound);
  }, [sound]);
  useEffect(() => {
    return () => {
      void setAuraEngine(false);
    };
  }, []);

  return (now: number) => {
    const idle = 0.14 + 0.1 * Math.sin(now * 0.0022);
    if (!sound) return idle;
    return Math.max(idle * 0.35, auraLevel());
  };
}
