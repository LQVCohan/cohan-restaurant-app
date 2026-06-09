import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/Customer/Food/FoodDetail.polish.css";
import "./components/Dashboard_Manager/Order/orderKitchenPolish.css";
import "./components/Dashboard_Manager/Order/orderKitchenStatusFilter.css";
import "./components/Dashboard_Manager/Order/orderManagementCompactLayout.css";
import "./components/Dashboard_Manager/Order/orderKitchenPolish.js";
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
