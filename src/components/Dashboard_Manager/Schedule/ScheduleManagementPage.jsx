import React, { useEffect } from "react";
import "@/styles/schedule-manager-experience.css";
import "@/styles/schedule-action-center.css";
import "@/styles/schedule-auto-modal-polish.css";
import "@/styles/schedule-rules-modal-polish.css";
import "@/styles/availability-snapshot-polish.css";
import "@/styles/shift-detail-polish.css";
import "@/styles/add-shift-modal-fixes.css";
import "@/styles/schedule-polish.css";
import { initScheduleHydrationPolish } from "@/utils/scheduleHydrationPolish.js";
import { initScheduleManagerDomPolish } from "@/utils/scheduleManagerDomPolish.js";
import ScheduleManagement from "./ScheduleManagement";

const ScheduleManagementPage = () => {
  useEffect(() => {
    const hydrationCleanup = initScheduleHydrationPolish?.();
    const domPolishTimer = window.setTimeout(() => {
      window.__scheduleDomPolishCleanup = initScheduleManagerDomPolish?.();
    }, 760);

    return () => {
      window.clearTimeout(domPolishTimer);
      hydrationCleanup?.();
      if (typeof window.__scheduleDomPolishCleanup === "function") {
        window.__scheduleDomPolishCleanup();
        window.__scheduleDomPolishCleanup = null;
      }
    };
  }, []);

  return <ScheduleManagement />;
};

export default ScheduleManagementPage;
