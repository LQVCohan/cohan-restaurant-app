import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import "./styles/schedule-manager-experience.css";
import "./styles/schedule-manager-hotfix.css";
import { initFrontendErrorTracking } from "./observability/errorTracking.js";

void initFrontendErrorTracking();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
