import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { UiProvider } from "@tools/ui";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <UiProvider>
      <App />
    </UiProvider>
  </StrictMode>,
);
