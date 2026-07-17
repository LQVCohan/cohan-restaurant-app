import React, { memo, useEffect, useLayoutEffect, useState } from "react";
import { BriefcaseBusiness, RefreshCw, TimerReset } from "lucide-react";
import { apolloClient } from "@/apollo/client";
import "@/styles/schedule-manager-experience.css";
import "@/styles/schedule-action-center.css";
import "@/styles/schedule-polish.css";
import "@/styles/schedule-sidebar-safe-performance.css";
import "@/styles/schedule-availability-feedback.css";
import { installScheduleApolloPerformancePatch } from "@/utils/scheduleApolloPerformancePatch.js";
import { initScheduleManagerDomPolish } from "@/utils/scheduleManagerDomPolish.js";
import { initScheduleManagerAdminPolish } from "@/utils/scheduleManagerAdminPolish.js";
import ScheduleManagement from "./ScheduleManagement";
import PartTimeScheduleWorkspace from "./PartTimeScheduleWorkspace";
import RotatingScheduleWorkspace from "./RotatingScheduleWorkspace";
import {
  ScheduleEmploymentScopeProvider,
  SCHEDULE_EMPLOYMENT_SCOPES,
} from "./ScheduleEmploymentScope";
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
import "./ScheduleEmploymentTabs.scss";

function getAvailabilityActionErrorMessage(reason) {
  const raw = String(reason?.message || reason || "");
  if (!raw.includes("AVAILABILITY_WINDOW")) return "";
  if (raw.includes("SCHEDULE_ALREADY_PUBLISHED")) {
    return "Không thể mở đăng ký vì lịch của tuần này đã được công bố, khóa hoặc chốt.";
  }
  if (raw.includes("PERIOD_ENDED")) {
    return "Tuần đăng ký đã kết thúc. Hãy chuyển sang tuần kế tiếp.";
  }
  if (raw.includes("INVALID_OPEN_TRANSITION")) {
    return "Kỳ đăng ký này không còn ở trạng thái cho phép mở lại.";
  }
  if (raw.includes("INVALID_CLOSE_TRANSITION")) {
    return "Chỉ có thể đóng một kỳ đăng ký đang mở.";
  }
  if (raw.includes("STATE_CHANGED")) {
    return "Trạng thái kỳ đăng ký vừa được người khác thay đổi. Hãy tải lại dữ liệu.";
  }
  if (raw.includes("NOT_FOUND")) {
    return "Không tìm thấy kỳ đăng ký. Hãy tải lại trang và thử lại.";
  }
  return "Không thể cập nhật kỳ đăng ký lịch. Hãy kiểm tra lại trạng thái tuần và thử lại.";
}

const ScheduleManagementPage = memo(function ScheduleManagementPage() {
  const [readinessFocus, setReadinessFocus] = useState("");
  const [availabilityActionError, setAvailabilityActionError] = useState("");
  const [employmentView, setEmploymentView] = useState(
    SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME,
  );

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

  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      const message = getAvailabilityActionErrorMessage(event.reason);
      if (!message) return;
      event.preventDefault();
      setAvailabilityActionError(message);
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () =>
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  useLayoutEffect(() => {
    const apolloCleanup = installScheduleApolloPerformancePatch(apolloClient);
    const domPolishTimer = window.setTimeout(() => {
      const scheduleRoot =
        document.querySelector(".manager-page-shell--schedules") ||
        document.querySelector(".schedule-container");
      if (scheduleRoot) {
        scheduleRoot.dataset.optionalPanelsInitialCollapsed = "true";
      }
      window.__scheduleDomPolishCleanup = initScheduleManagerDomPolish?.();
      window.__scheduleAdminPolishCleanup = initScheduleManagerAdminPolish?.();
    }, 520);

    return () => {
      window.clearTimeout(domPolishTimer);
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
  }, [employmentView]);

  return (
    <>
      {readinessFocus ? (
        <div className="schedule-readiness-focus-banner" role="status">
          Đang mở lịch làm việc để xử lý lỗi từ kiểm tra bảng lương: {readinessFocus}
        </div>
      ) : null}
      {availabilityActionError ? (
        <div className="schedule-availability-action-error" role="alert">
          <div>
            <strong>Không thể cập nhật đăng ký lịch</strong>
            <span>{availabilityActionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setAvailabilityActionError("")}
            aria-label="Đóng thông báo lỗi đăng ký lịch"
          >
            ×
          </button>
        </div>
      ) : null}

      <nav className="schedule-employment-tabs" aria-label="Chọn loại lịch nhân sự">
        <button
          type="button"
          className={employmentView === SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME ? "active" : ""}
          aria-pressed={employmentView === SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME}
          onClick={() => setEmploymentView(SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME)}
        >
          <BriefcaseBusiness size={18} />
          <span>
            <strong>Lịch toàn thời gian</strong>
            <small>Ca cố định và nhân sự theo ngày làm việc</small>
          </span>
        </button>
        <button
          type="button"
          className={employmentView === SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME ? "active" : ""}
          aria-pressed={employmentView === SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME}
          onClick={() => setEmploymentView(SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME)}
        >
          <TimerReset size={18} />
          <span>
            <strong>Lịch bán thời gian</strong>
            <small>Block 4 giờ, tự nối giờ và kiểm tra availability</small>
          </span>
        </button>
        <button
          type="button"
          className={employmentView === SCHEDULE_EMPLOYMENT_SCOPES.ROTATING ? "active" : ""}
          aria-pressed={employmentView === SCHEDULE_EMPLOYMENT_SCOPES.ROTATING}
          onClick={() => setEmploymentView(SCHEDULE_EMPLOYMENT_SCOPES.ROTATING)}
        >
          <RefreshCw size={18} />
          <span>
            <strong>Lịch xoay ca</strong>
            <small>Workspace riêng cho nhân sự được cấu hình ROTATING</small>
          </span>
        </button>
      </nav>

      {employmentView === SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME ? (
        <div className="schedule-employment-view schedule-employment-view--full-time">
          <ScheduleEmploymentScopeProvider scope={SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME}>
            <ScheduleManagement />
          </ScheduleEmploymentScopeProvider>
        </div>
      ) : employmentView === SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME ? (
        <div className="schedule-employment-view schedule-employment-view--part-time">
          <PartTimeScheduleWorkspace />
        </div>
      ) : (
        <div className="schedule-employment-view schedule-employment-view--rotating">
          <RotatingScheduleWorkspace />
        </div>
      )}
    </>
  );
});

export default ScheduleManagementPage;
