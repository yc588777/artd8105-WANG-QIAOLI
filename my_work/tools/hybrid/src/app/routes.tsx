import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { GeneLab } from "../labs/gene/GeneLab";
import { FlockLab } from "../labs/flock/FlockLab";
import { CellLab } from "../labs/cell/CellLab";
import { GrowLab } from "../labs/grow/GrowLab";
import { DiffLab } from "../labs/diff/DiffLab";
import { HybridLab } from "../labs/hybrid/HybridLab";
import { AboutPage } from "../pages/AboutPage";
import { ArchivePage } from "../pages/ArchivePage";
import { HomePage } from "../pages/HomePage";
import { useAppStore } from "../store/appStore";
import { useEffect } from "react";

function Track({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const setLast = useAppStore((s) => s.setLastModule);
  useEffect(() => {
    const m = loc.pathname.split("/").filter(Boolean);
    if (!m.length) setLast("index");
    else if (m[0] === "lab" && m[1]) setLast(m[1] as "gene");
    else if (m[0] === "hybrid") setLast("hybrid");
    else if (m[0] === "archive") setLast("archive");
    else if (m[0] === "about") setLast("about");
  }, [loc.pathname, setLast]);
  return children;
}

export function AppRoutes() {
  return (
    <Track>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lab/gene" element={<GeneLab />} />
        <Route path="/lab/flock" element={<FlockLab />} />
        <Route path="/lab/cell" element={<CellLab />} />
        <Route path="/lab/grow" element={<GrowLab />} />
        <Route path="/lab/diff" element={<DiffLab />} />
        <Route path="/hybrid" element={<HybridLab />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Track>
  );
}
