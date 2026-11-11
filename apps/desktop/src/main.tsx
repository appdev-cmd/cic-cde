import React from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./AuthGate";
import PasswordRecovery, { readPasswordRecovery } from "./PasswordRecovery";
import "./styles.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
const page = new URLSearchParams(window.location.search).get("cde");
const isCde = page === "1";
const isLibrary = page === "knowledge";
const recovery = readPasswordRecovery();
const App = React.lazy(() => import("./App"));
const Cde = React.lazy(() => import("./Cde"));
const BimLibrary = React.lazy(() => import("./BimLibrary"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {recovery ? <PasswordRecovery link={recovery} /> : <AuthGate>
      {(controls) => (
        <React.Suspense fallback={<p role="status">Đang mở workspace…</p>}>
          {isCde || isLibrary ? (
            <>
              {(controls.project || controls.account) && (
                <header className="access-bar">
                  {controls.project}
                  {controls.account}
                </header>
              )}
              {isLibrary ? <BimLibrary /> : <Cde />}
            </>
          ) : (
            <App {...controls} />
          )}
        </React.Suspense>
      )}
    </AuthGate>}
  </React.StrictMode>,
);
