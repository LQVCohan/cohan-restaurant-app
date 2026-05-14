import React from "react";
import "./PayrollReadinessPanel.scss";

const SECTION_ORDER = ["schedule", "attendance", "approvals", "payroll"];

const SECTION_LABELS = {
  schedule: "Lịch làm việc",
  attendance: "Chấm công",
  approvals: "Duyệt công / tăng ca",
  payroll: "Lương",
};

const SEVERITY_LABELS = {
  error: "Lỗi chặn",
  warning: "Cảnh báo",
  info: "Thông tin",
};

const SECTION_STATE_LABELS = {
  error: "❌ Cần xử lý",
  warning: "⚠️ Có cảnh báo",
  ready: "✅ Đạt",
};

function getSectionState(section) {
  if (Number(section?.blockingCount || 0) > 0) return "error";
  if (Number(section?.warningCount || 0) > 0) return "warning";
  return "ready";
}

const PayrollReadinessIssue = ({ issue, onGoToIssue }) => (
  <div className={`payroll-readiness-issue payroll-readiness-issue--${issue.severity || "info"}`}>
    <div className="payroll-readiness-issue__main">
      <strong>{SEVERITY_LABELS[issue.severity] || issue.severity || "Thông tin"}</strong>
      <span>{issue.message}</span>
    </div>

    {(issue.employeeName || issue.employeeCode || issue.sourceType) && (
      <div className="payroll-readiness-issue__meta">
        {issue.employeeName && <span>{issue.employeeName}</span>}
        {issue.employeeCode && <span>{issue.employeeCode}</span>}
        {issue.sourceType && <span>{issue.sourceType}</span>}
      </div>
    )}

    {issue.suggestedAction && (
      <p className="payroll-readiness-issue__suggestion">{issue.suggestedAction}</p>
    )}

    {onGoToIssue && (
      <button
        type="button"
        className="payroll-readiness-issue__action"
        onClick={() => onGoToIssue(issue)}
      >
        Xem nơi cần xử lý
      </button>
    )}
  </div>
);

const PayrollReadinessPanel = ({
  readiness,
  loading = false,
  error = null,
  onRefresh,
  onGoToIssue,
}) => {
  if (loading) {
    return (
      <section className="payroll-readiness-panel" aria-live="polite">
        Đang kiểm tra điều kiện chốt lương...
      </section>
    );
  }

  if (error) {
    return (
      <section className="payroll-readiness-panel payroll-readiness-panel--error" aria-live="polite">
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
      </section>
    );
  }

  if (!readiness) {
    return (
      <section className="payroll-readiness-panel" aria-live="polite">
        Chưa có dữ liệu kiểm tra.
      </section>
    );
  }

  const sections = readiness.sections || {};
  const ready = readiness.readyToFinalize === true;

  return (
    <section className={`payroll-readiness-panel ${ready ? "payroll-readiness-panel--ready" : "payroll-readiness-panel--blocked"}`}>
      <div className="payroll-readiness-panel__header">
        <div>
          <h3 className="payroll-readiness-panel__title">
            {ready ? "Sẵn sàng chốt lương" : "Chưa sẵn sàng chốt lương"}
          </h3>
          <p className="payroll-readiness-panel__subtitle">
            Kiểm tra trước khi chốt lương từ lịch, chấm công, duyệt công/tăng ca và bảng lương.
          </p>
        </div>
        {onRefresh && (
          <button type="button" className="payroll-readiness-panel__refresh" onClick={onRefresh}>
            Làm mới
          </button>
        )}
      </div>

      <div className="payroll-readiness-summary">
        <span className="payroll-readiness-summary__item payroll-readiness-summary__item--error">
          Lỗi chặn: {Number(readiness.blockingCount || 0)}
        </span>
        <span className="payroll-readiness-summary__item payroll-readiness-summary__item--warning">
          Cảnh báo: {Number(readiness.warningCount || 0)}
        </span>
      </div>

      <div className="payroll-readiness-sections">
        {SECTION_ORDER.map((key) => {
          const section = sections[key] || { issues: [] };
          const state = getSectionState(section);
          const issues = Array.isArray(section.issues) ? section.issues : [];
          return (
            <article key={key} className={`payroll-readiness-section payroll-readiness-section--${state}`}>
              <div className="payroll-readiness-section__header">
                <div>
                  <h4 className="payroll-readiness-section__title">{SECTION_LABELS[key] || key}</h4>
                  {section.status && <p className="payroll-readiness-section__raw-status">Trạng thái: {section.status}</p>}
                </div>
                <div className="payroll-readiness-section__status">
                  {SECTION_STATE_LABELS[state]} · {Number(section.blockingCount || 0)} lỗi · {Number(section.warningCount || 0)} cảnh báo
                </div>
              </div>

              {issues.length > 0 && (
                <div className="payroll-readiness-issues">
                  {issues.map((issue, index) => (
                    <PayrollReadinessIssue
                      key={`${key}-${issue.code || "issue"}-${issue.sourceId || index}`}
                      issue={issue}
                      onGoToIssue={onGoToIssue}
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default PayrollReadinessPanel;
