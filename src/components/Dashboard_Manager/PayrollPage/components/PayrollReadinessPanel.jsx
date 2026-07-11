import React from "react";
import "./PayrollReadinessPanel.scss";
import { getPayrollReadinessIssueAction } from "@/utils/payrollReadinessRouting";

const SECTION_ORDER = ["schedule", "attendance", "approvals", "payroll"];

const SECTION_CONFIG = {
  schedule: {
    label: "Lịch làm việc",
    subtitle: "Kiểm tra lịch đã công bố và xác nhận lịch.",
  },
  attendance: {
    label: "Chấm công",
    subtitle: "Kiểm tra dữ liệu vào/ra, vắng lịch và thiếu check-out.",
  },
  approvals: {
    label: "Duyệt công / tăng ca",
    subtitle: "Kiểm tra đơn sửa công, tăng ca và công ngoài lịch đang chờ duyệt.",
  },
  payroll: {
    label: "Lương",
    subtitle: "Kiểm tra dữ liệu bảng lương và cấu hình tính lương.",
  },
};

const SEVERITY_LABELS = {
  error: "Lỗi chặn",
  warning: "Cảnh báo",
  info: "Thông tin",
};

const SECTION_STATE_LABELS = {
  error: "Cần xử lý",
  warning: "Có cảnh báo",
  ready: "Đạt",
};

function getSectionState(section) {
  if (Number(section?.blockingCount || 0) > 0) return "error";
  if (Number(section?.warningCount || 0) > 0) return "warning";
  return "ready";
}

const PayrollReadinessIssue = ({ issue, onGoToIssue }) => {
  const severity = issue.severity || "info";
  const action = getPayrollReadinessIssueAction(issue);

  return (
    <div className={`payroll-readiness-issue payroll-readiness-issue--${severity}`}>
      <div className="payroll-readiness-issue__top">
        <span className={`payroll-readiness-issue__severity payroll-readiness-issue__severity--${severity}`}>
          {SEVERITY_LABELS[severity] || "Thông tin"}
        </span>
      </div>

      <p className="payroll-readiness-issue__message">{issue.message}</p>

      {(issue.employeeName || issue.employeeCode || issue.sourceType) && (
        <div className="payroll-readiness-issue__meta">
          {issue.employeeName && <span className="payroll-readiness-issue__chip">{issue.employeeName}</span>}
          {issue.employeeCode && <span className="payroll-readiness-issue__chip">{issue.employeeCode}</span>}
          {issue.sourceType && <span className="payroll-readiness-issue__chip">Nguồn: {issue.sourceType}</span>}
        </div>
      )}

      {issue.suggestedAction && <p className="payroll-readiness-issue__suggestion">{issue.suggestedAction}</p>}

      {onGoToIssue && (
        <button
          type="button"
          className="payroll-readiness-issue__action"
          aria-label={`Đi tới nơi xử lý: ${issue.message}`}
          onClick={() => onGoToIssue(issue)}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

const PayrollReadinessPanel = ({ readiness, loading = false, error = null, onRefresh, onGoToIssue }) => {
  if (loading) {
    return (
      <section className="payroll-readiness-panel" role="status" aria-live="polite">
        <div className="payroll-readiness-panel__state-card payroll-readiness-panel__state-card--loading">
          <p className="payroll-readiness-panel__state-text">Đang kiểm tra điều kiện chốt lương...</p>
          <div className="payroll-readiness-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="payroll-readiness-panel payroll-readiness-panel--error" role="alert" aria-live="assertive">
        <div className="payroll-readiness-panel__state-card payroll-readiness-panel__state-card--error">
          <div className="payroll-readiness-panel__header">
            <div>
              <h3 className="payroll-readiness-panel__title">Không thể tải kiểm tra trước khi chốt lương.</h3>
              <p className="payroll-readiness-panel__subtitle">Vui lòng thử lại trước khi chốt kỳ lương.</p>
            </div>
            {onRefresh && (
              <button type="button" className="payroll-readiness-panel__refresh" onClick={onRefresh}>
                Thử lại
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!readiness) {
    return (
      <section className="payroll-readiness-panel" aria-live="polite">
        <div className="payroll-readiness-panel__state-card">
          <p className="payroll-readiness-panel__state-text">Chưa có dữ liệu kiểm tra cho kỳ lương này.</p>
        </div>
      </section>
    );
  }

  const sections = readiness.sections || {};
  const ready = readiness.readyToFinalize === true;
  const blockingCount = Number(readiness.blockingCount || 0);
  const warningCount = Number(readiness.warningCount || 0);

  return (
    <section className={`payroll-readiness-panel ${ready ? "payroll-readiness-panel--ready" : "payroll-readiness-panel--blocked"}`}>
      <div className="payroll-readiness-panel__header">
        <div>
          <h3 className="payroll-readiness-panel__title">{ready ? "Sẵn sàng chốt lương" : "Chưa sẵn sàng chốt lương"}</h3>
          <p className="payroll-readiness-panel__subtitle">
            {ready
              ? "Các kiểm tra chính đã đạt. Vẫn nên rà soát cảnh báo trước khi chốt."
              : "Cần xử lý lỗi chặn trước khi chốt kỳ lương."}
          </p>
        </div>

        <div className="payroll-readiness-panel__header-actions">
          <span className={`payroll-readiness-panel__badge ${ready ? "payroll-readiness-panel__badge--ready" : "payroll-readiness-panel__badge--blocked"}`}>
            {ready ? "Đủ điều kiện" : `${blockingCount} lỗi chặn`}
          </span>
          {onRefresh && (
            <button
              type="button"
              className="payroll-readiness-panel__refresh"
              aria-label="Làm mới kiểm tra điều kiện chốt lương"
              onClick={onRefresh}
            >
              Làm mới
            </button>
          )}
        </div>
      </div>

      <div className="payroll-readiness-summary">
        <span className="payroll-readiness-summary__item payroll-readiness-summary__item--error">{blockingCount} lỗi chặn</span>
        {warningCount > 0 && (
          <span className="payroll-readiness-summary__item payroll-readiness-summary__item--warning">{warningCount} cảnh báo cần rà soát</span>
        )}
      </div>

      <div className="payroll-readiness-sections">
        {SECTION_ORDER.map((key) => {
          const section = sections[key] || { issues: [] };
          const state = getSectionState(section);
          const issues = Array.isArray(section.issues) ? section.issues : [];
          const sectionLabel = SECTION_CONFIG[key]?.label || key;

          return (
            <article
              key={key}
              className={`payroll-readiness-section payroll-readiness-section--${state}`}
              role="region"
              aria-label={`Mục kiểm tra ${sectionLabel}`}
            >
              <div className="payroll-readiness-section__header">
                <div>
                  <h4 className="payroll-readiness-section__title">{sectionLabel}</h4>
                  <p className="payroll-readiness-section__subtitle">{SECTION_CONFIG[key]?.subtitle}</p>
                </div>
                <span className={`payroll-readiness-section__status-badge payroll-readiness-section__status-badge--${state}`}>
                  {SECTION_STATE_LABELS[state]}
                </span>
              </div>

              <p className="payroll-readiness-section__count">
                {Number(section.blockingCount || 0)} lỗi chặn · {Number(section.warningCount || 0)} cảnh báo
              </p>

              {issues.length > 0 ? (
                <div
                  className="payroll-readiness-issues"
                  tabIndex={0}
                  aria-label={`${sectionLabel}: ${issues.length} vấn đề cần xử lý`}
                >
                  {issues.map((issue, index) => (
                    <PayrollReadinessIssue
                      key={`${key}-${issue.code || "issue"}-${issue.sourceId || index}`}
                      issue={issue}
                      onGoToIssue={onGoToIssue}
                    />
                  ))}
                </div>
              ) : (
                <p className="payroll-readiness-section__empty">Không có vấn đề cần xử lý.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default PayrollReadinessPanel;