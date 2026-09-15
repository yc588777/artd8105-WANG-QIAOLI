import { useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppRoutes } from "./routes";
import { BootScreen } from "../components/Shell/BootScreen";
import { GrainOverlay } from "../components/Shell/GrainOverlay";
import { NavRail, StatusBar, SysLog } from "../components/Shell/Chrome";
import { useAppStore } from "../store/appStore";
import { useAuraPulse } from "../hooks/useAuraPulse";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { MODULES, NAV } from "../data/moduleContent";

export function App() {
  const loc = useLocation();
  const theme = useAppStore((s) => s.theme);
  const tour = useAppStore((s) => s.tour);
  const setTour = useAppStore((s) => s.setTour);
  const reduced = useReducedMotion();
  useAuraPulse();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = "zh-CN";
  }, [theme]);
  const module = useMemo(() => {
    const hit = NAV.find((n) => n.to === loc.pathname);
    return hit ? (MODULES[hit.id as keyof typeof MODULES]?.code ?? hit.label) : "M//05";
  }, [loc.pathname]);

  return (
    <div className="shell" data-theme={theme} lang="zh">
      <NavRail />
      <StatusBar module={module} />
      <main className="main">
        <p className="landscape-hint">横屏可获得完整实验体验</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2, ease: "linear" }}
            style={{ height: "100%" }}
          >
            <AppRoutes />
          </motion.div>
        </AnimatePresence>
        {tour && (
          <div className="boot" style={{ background: "rgba(8,9,10,0.88)" }}>
            <div>
              <p className="kicker">GUIDED TOUR</p>
              <p>1 OBSERVE 经典参数 · 2 ISOLATE 关闭单条规则 · 3 PERTURB 鼠标扰动</p>
              <p>4 EXPLAIN 阅读右侧解释 · 5 CREATE 导出 PNG / 存档</p>
              <button type="button" className="active" onClick={() => setTour(false)}>
                CLOSE
              </button>
            </div>
          </div>
        )}
      </main>
      <SysLog />
      <GrainOverlay />
      <BootScreen />
    </div>
  );
}
