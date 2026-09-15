import { NavLink, useLocation } from "react-router-dom";
import { NAV } from "../../data/moduleContent";
import { useAppStore } from "../../store/appStore";
import { setAuraEngine } from "../../utils/auraAudio";

export function NavRail() {
  const loc = useLocation();
  return (
    <nav className="nav-rail" aria-label="modules">
      {NAV.map((n) => (
        <NavLink key={n.label} to={n.to} className={() => (loc.pathname === n.to ? "on" : "")} end={n.to === "/"}>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function StatusBar({ module }: { module: string }) {
  const fps = useAppStore((s) => s.fps);
  const running = useAppStore((s) => s.running);
  const seed = useAppStore((s) => s.seed);
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const sound = useAppStore((s) => s.sound);
  const setLang = useAppStore((s) => s.setLang);
  const setTheme = useAppStore((s) => s.setTheme);
  const setSound = useAppStore((s) => s.setSound);
  const setRunning = useAppStore((s) => s.setRunning);
  return (
    <header className="status-bar">
      <div className="row">
        <span className={running ? "lamp" : "lamp off"} />
        <span>{module}</span>
        <span>{running ? "RUNNING" : "PAUSED"}</span>
        <span>{fps.toFixed(0)} FPS</span>
        <span>SEED {String(seed).padStart(4, "0")}</span>
      </div>
      <div className="row">
        <button type="button" className={lang === "zh" ? "active" : ""} onClick={() => setLang("zh")}>
          中文
        </button>
        <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
          EN
        </button>
        <button
          type="button"
          className={sound ? "active" : ""}
          onClick={() => {
            const next = !sound;
            setSound(next);
            void setAuraEngine(next);
          }}
        >
          {sound ? "AUDIO SYNC" : "AUDIO"}
        </button>
        <button type="button" onClick={() => setTheme(theme === "lab" ? "archive" : "lab")}>
          {theme === "lab" ? "LAB" : "ARCHIVE MODE"}
        </button>
        <button type="button" onClick={() => setRunning(!running)}>
          {running ? "PAUSE" : "PLAY"}
        </button>
      </div>
    </header>
  );
}

export function SysLog() {
  const log = useAppStore((s) => s.log);
  return <div className="sys-log">{log}</div>;
}
