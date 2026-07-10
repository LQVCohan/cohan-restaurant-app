import React, { useLayoutEffect, useEffect, useState, memo } from "react";
import { apolloClient } from "@/apollo/client";
import "@/styles/schedule-manager-experience.css";
import "@/styles/schedule-action-center.css";
import "@/styles/schedule-polish.css";
import "@/styles/schedule-sidebar-safe-performance.css";
import { installScheduleApolloPerformancePatch } from "@/utils/scheduleApolloPerformancePatch.js";
import { initScheduleHydrationPolish } from "@/utils/scheduleHydrationPolish.js";
import { initScheduleManagerDomPolish } from "@/utils/scheduleManagerDomPolish.js";
import { initScheduleManagerAdminPolish } from "@/utils/scheduleManagerAdminPolish.js";
import ScheduleManagement from "./ScheduleManagement";
import "@/styles/schedule-manager-workspace-final.css";
import "@/styles/schedule-manager-drawer-workspace.css";
import "@/styles/schedule-storage-alignment.css";
import "@/styles/schedule-admin-final-tuning.css";
import "@/styles/schedule-admin-ui-fixes.css";
import "@/styles/schedule-color-final-refinement.css";
import "@/styles/schedule-manager-visual-redesign.css";
import "@/styles/schedule-manager-final-alignment.css";
import "@/styles/schedule-availability-action-buttons.css";
import "@/styles/schedule-manager-sage-upgrade.css";

const ScheduleManagementPage = memo(function ScheduleManagementPage() {
  const [readinessFocus, setReadinessFocus] = useState("");
  useEffect(() => {
    const applyFocus = () => {
      const params = new URLSearchParams(window.location.search || "");
      const focus = params.get("focus");
      if (focus) setReadinessFocus(focus);
    };

    applyFocus();

    const handleNavigationQuery = (event) => {
      if (event?.detail?.page !== "schedules") return;
      applyFocus();
    };

    window.addEventListener("manager:navigation-query", handleNavigationQuery);
    return () =>
      window.removeEventListener("manager:navigation-query", handleNavigationQuery);
  }, []);

  useLayoutEffect(() => {
    const apolloCleanup = installScheduleApolloPerformancePatch(apolloClient);
    const hydrationCleanup = initScheduleHydrationPolish?.();
    const domPolishTimer = window.setTimeout(() => {
      const scheduleRoot =
        document.querySelector(".manager-page-shell--schedules") ||
        document.querySelector(".schedule-container");
      if (scheduleRoot) {
        // React owns the registration panel collapse state. Prevent legacy DOM
        // polish from clicking the control and racing the component state.
        scheduleRoot.dataset.optionalPanelsInitialCollapsed = "true";
      }
      window.__scheduleDomPolishCleanup = initScheduleManagerDomPolish?.();
      window.__scheduleAdminPolishCleanup = initScheduleManagerAdminPolish?.();
    }, 520);

    return () => {
      window.clearTimeout(domPolishTimer);
      hydrationCleanup?.();
      apolloCleanup?.();
      if (typeof window.__scheduleDomPolishCleanup === "function") {
        window.__scheduleDomPolishCleanup();
        window.__scheduleDomPolishCleanup = null;
      }
      if (typeof window.__scheduleAdminPolishCleanup === "function") {
        window.__scheduleAdminPolishCleanup();
        window.__scheduleAdminPolishCleanup = null;
      }
    };
  }, []);

  return (
    <>
      {readinessFocus && (
        <div className="schedule-readiness-focus-banner" role="status">
          Đang mở lịch làm việc để xử lý lỗi từ kiểm tra bảng lương: {readinessFocus}
        </div>
      )}
      <ScheduleManagement />
    </>
  );
});

export default ScheduleManagementPage;
