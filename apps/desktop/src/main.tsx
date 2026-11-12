import React from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./AuthGate";
import PasswordRecovery, { readPasswordRecovery } from "./PasswordRecovery";
import ProjectWorkspace from "./ProjectWorkspace";
import "./styles.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
const recovery = readPasswordRecovery();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {recovery ? <PasswordRecovery link={recovery} /> : <AuthGate>
      {(controls) => <ProjectWorkspace {...controls} />}
    </AuthGate>}
  </React.StrictMode>,
);
