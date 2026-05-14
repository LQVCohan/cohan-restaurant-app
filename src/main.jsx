import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import "./styles/schedule-manager-experience.css";
import "./styles/schedule-action-center.css";
import "./styles/schedule-auto-modal-polish.css";
import "./styles/schedule-rules-modal-polish.css";
import "./styles/availability-snapshot-polish.css";
import "./styles/shift-detail-polish.css";
import { initFrontendErrorTracking } from "./observability/errorTracking.js";
import { initScheduleManagerDomPolish } from "./utils/scheduleManagerDomPolish.js";

void initFrontendErrorTracking();
initScheduleManagerDomPolish();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
