import React from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./AuthGate";
import "./styles.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
const isCde = new URLSearchParams(window.location.search).get("cde") === "1";
const Workspace = React.lazy(() => (isCde ? import("./Cde") : import("./App")));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>
      <React.Suspense fallback={<p role="status">Đang mở workspace…</p>}>
        <Workspace />
      </React.Suspense>
    </AuthGate>
  </React.StrictMode>,
);
