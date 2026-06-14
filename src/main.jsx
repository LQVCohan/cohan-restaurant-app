import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/Customer/Food/FoodDetail.polish.css";
import "./styles/ManagerTypography.css";
import "./styles/ManagerTypographySystemOverride.css";
import "./components/common/AiChatbotWidgetInlineSuggestions.css";

import App from "./App.jsx";
import { initFrontendErrorTracking } from "./observability/errorTracking.js";
import { installAuthenticatedTable3DTransport } from "@/lib/installAuthenticatedTable3DTransport";

void initFrontendErrorTracking();
installAuthenticatedTable3DTransport();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
