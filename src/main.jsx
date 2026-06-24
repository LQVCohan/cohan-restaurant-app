import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/Customer/Food/FoodDetail.polish.css";
import "./styles/ManagerTypography.css";
import "./styles/ManagerTypographySystemOverride.css";
import "./styles/PayrollStorageTheme.css";
import "./styles/PayrollManagerPresentation.css";
import "./styles/PayrollManagerFinalPolish.css";
import "./styles/PromotionManagerOperationsUX.css";
import "./styles/PromotionModalViewportFix.css";
import "./styles/TableManagerSageUX.css";
import "./styles/TableManagerModalRepair.css";
import "./styles/Table3DModalResponsive.css";
import "./styles/Table3DModalHeaderCompact.css";
import "./styles/Table3DModalWorkflow.css";
import "./styles/TableARNestedModals.css";
import "./styles/Table3DToolbarMobileFix.css";
import "./styles/TableCameraPreviewRepair.css";
import "./styles/Table3DMainModalRepair.css";
import "./components/common/AiChatbotWidgetInlineSuggestions.css";

import App from "./App.jsx";
import "./styles/RbacPayrollTheme.css";
import "./styles/RbacCompactLayout.css";
import "./styles/HrSageTheme.css";
import "./styles/HrControlsTheme.css";
import "./styles/HrBoardCardsTheme.css";
import "./styles/HrSubpagesPolish.css";
import "./styles/OrderManagerColorPolish.css";
import "./styles/OrderManagerModalTheme.css";
import "./styles/OrderSettingsModalBeauty.css";
import "./components/Dashboard_Manager/Table/TableManagementPolish.scss";
import "./components/Dashboard_Manager/Table/TableManagementFinalQC.scss";
import "./components/Dashboard_Manager/Table/TableManagementScorePolish.scss";
import "./components/Dashboard_Manager/Table/TableWorkflowModalPremium.scss";
import "./components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagementPolish.scss";
import "./components/Dashboard_Manager/RestaurantInfo/RestaurantInfoToneSync.scss";
import "./components/Dashboard_Manager/RestaurantInfo/RestaurantInfoLayoutFix.scss";
import "./components/Customer/RestaurantDetail/RestaurantPreviewFrameFix.scss";
import { installRestaurantInfoCopyTuning } from "./components/Dashboard_Manager/RestaurantInfo/RestaurantInfoCopyTuning.js";
import { installTableWorkflowCopyTuning } from "./components/Dashboard_Manager/Table/TableWorkflowCopyTuning.js";
import { initFrontendErrorTracking } from "./observability/errorTracking.js";
import { installAuthenticatedTable3DTransport } from "@/lib/installAuthenticatedTable3DTransport";
import { installRbacVietnameseLabels } from "@/utils/rbacVietnameseLabels";

void initFrontendErrorTracking();
installAuthenticatedTable3DTransport();
installRbacVietnameseLabels();
installRestaurantInfoCopyTuning();
installTableWorkflowCopyTuning();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);