import React, { memo, useEffect, useLayoutEffect, useState } from "react";
import {
  BriefcaseBusiness,
  ClipboardList,
  RefreshCw,
  TimerReset,
  X,
} from "lucide-react";
import { apolloClient } from "@/apollo/client";
import "@/styles/schedule-manager-experience.css";
import "@/styles/schedule-action-center.css";
import "@/styles/schedule-polish.css";
import "@/styles/schedule-sidebar-safe-performance.css";
import "@/styles/schedule-availability-feedback.css";
import "@/styles/schedule-observability-redesign.css";
import "@/styles/schedule-add-shift-observability.css";
import { installScheduleApolloPerformancePatch } from "@/utils/scheduleApolloPerformancePatch.js";
import { initScheduleManagerDomPolish } from "@/utils/scheduleManagerDomPolish.js";
import { initScheduleManagerAdminPolish } from "@/utils/scheduleManagerAdminPolish.js";
import { initScheduleObservabilityLayout } from "@/utils/scheduleObservabilityLayout.js";
import FullTimeScheduleWorkspace from "./FullTimeScheduleWorkspace";
import PartTimeScheduleWorkspace from "./PartTimeScheduleWorkspace";
import RotatingScheduleWorkspace from "./RotatingScheduleWorkspace";
import WorkspaceAvailabilityPanel from "./components/WorkspaceAvailabilityPanel";
import { SCHEDULE_EMPLOYMENT_SCOPES } from "./ScheduleEmploymentScope";
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
  if (raw.includes("WORKSPACE_MISMATCH")) {
    return "Nhân viên không thuộc đúng loại lịch của kỳ đăng ký này.";
  }
  return "Không thể cập nhật kỳ đăng ký lịch. Hãy kiểm tra lại trạng thái tuần và thử lại.";
}

const ScheduleManagementPage = memo(function ScheduleManagementPage() {
  const [readinessFocus, setReadinessFocus] = useState("");
  const [availabilityActionError, setAvailabilityActionError] = useState("");
  const [operationsOpen, setOperationsOpen] = useState(false);
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

  useEffect(() => {
    if (!operationsOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOperationsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [operationsOpen]);

  useEffect(() => {
    setOperationsOpen(false);
  }, [employmentView]);

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
      window.__scheduleObservabilityCleanup = initScheduleObservabilityLayout?.();
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
      if (typeof window.__scheduleObservabilityCleanup === "function") {
        window.__scheduleObservabilityCleanup();
        window.__scheduleObservabilityCleanup = null;
      }
    };
  }, [employmentView]);

  const workspace =
    employmentView === SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME ? (
      <div className="schedule-employment-view schedule-employment-view--full-time">
        <FullTimeScheduleWorkspace />
      </div>
    ) : employmentView === SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME ? (
      <div className="schedule-employment-view schedule-employment-view--part-time">
        <PartTimeScheduleWorkspace />
      </div>
    ) : (
      <div className="schedule-employment-view schedule-employment-view--rotating">
        <RotatingScheduleWorkspace />
      </div>
    );

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

      <div className="schedule-page-command-row">
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

        <button
          type="button"
          className="schedule-operations-trigger"
          aria-expanded={operationsOpen}
          aria-controls="schedule-operations-drawer"
          onClick={() => setOperationsOpen(true)}
        >
          <ClipboardList size={18} />
          Trung tâm xử lý
        </button>
      </div>

      <main className="schedule-workspace-primary">{workspace}</main>

      {operationsOpen ? (
        <div
          className="schedule-operations-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOperationsOpen(false);
          }}
        >
          <aside
            id="schedule-operations-drawer"
            className="schedule-operations-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-operations-title"
          >
            <header className="schedule-operations-drawer__header">
              <div>
                <h2 id="schedule-operations-title">Trung tâm xử lý và đăng ký lịch</h2>
                <p>
                  Các thao tác phụ được tách khỏi lịch tuần để khu vực xếp ca luôn dễ quan sát.
                </p>
              </div>
              <button
                type="button"
                className="schedule-operations-drawer__close"
                onClick={() => setOperationsOpen(false)}
                aria-label="Đóng trung tâm xử lý"
              >
                <X size={18} />
              </button>
            </header>
            <div className="schedule-operations-drawer__body">
              <WorkspaceAvailabilityPanel
                key={employmentView}
                workspaceType={employmentView}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
});

export default ScheduleManagementPage;
