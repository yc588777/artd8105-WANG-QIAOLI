import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import "@fontsource/archivo-black/400.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/space-mono/400.css";
import "./styles/global.css";
import { App } from "./app/App";

const Router = import.meta.env.BASE_URL === "/" ? BrowserRouter : HashRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
