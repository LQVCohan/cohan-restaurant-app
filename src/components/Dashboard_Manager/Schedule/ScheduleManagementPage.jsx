import React, { useEffect } from "react";
import "@/styles/schedule-manager-experience.css";
import "@/styles/schedule-action-center.css";
import "@/styles/schedule-auto-modal-polish.css";
import "@/styles/schedule-rules-modal-polish.css";
import "@/styles/availability-snapshot-polish.css";
import "@/styles/shift-detail-polish.css";
import "@/styles/add-shift-modal-fixes.css";
import "@/styles/schedule-polish.css";
import { initScheduleManagerDomPolish } from "@/utils/scheduleManagerDomPolish.js";
import ScheduleManagement from "./ScheduleManagement";

const ScheduleManagementPage = () => {
  useEffect(() => {
    const cleanup = initScheduleManagerDomPolish?.();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  return <ScheduleManagement />;
};

export default ScheduleManagementPage;
