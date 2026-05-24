import React from "react";
import { UsersRound, AlertTriangle, BadgeCheck, UserPlus2, BriefcaseBusiness } from "lucide-react";
import "./StaffSchedulingAssistantWidget.scss";

const compact = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));

const statusLabel = (status) => {
  if (status === "understaffed") return "Thiếu người";
  if (status === "overstaffed") return "Dư người";
  return "Cân bằng";
};

const StaffSchedulingAssistantWidget = ({ assistant, loading }) => {
  const summary = assistant?.summary || {};
  const shifts = assistant?.shifts || [];

  const topRisk = shifts.find((s) => s.shiftKey === summary?.highestRiskShift) || shifts[0] || null;
  const underShifts = shifts.filter((s) => s.status === "understaffed");

  return (
    <div className="widget-card staff-scheduling-assistant-widget">
      <div className="assistant-header">
        <div className="header-title">
          <div className="icon-wrap">
            <UsersRound size={18} />
          </div>
          <div>
            <h3>Staff Scheduling Assistant</h3>
            <p>Gợi ý headcount + role theo forecast</p>
          </div>
        </div>
        <span className={`mode-pill ${assistant?.meta?.fallbackUsed ? "fallback" : "forecast"}`}>
          {assistant?.meta?.fallbackUsed ? "Fallback" : "Forecast"}
        </span>
      </div>

      {loading ? <div className="state-message">Đang phân tích nhu cầu nhân sự theo ca...</div> : null}
      {!loading && !shifts.length ? (
        <div className="state-message warning">Chưa có dữ liệu đủ để gợi ý phân ca.</div>
      ) : null}

      {!loading && shifts.length ? (
        <>
          <div className="kpi-strip">
            <div className="mini-kpi">
              <span className="kpi-label">Ca thiếu người</span>
              <strong>{compact(summary?.underStaffedShifts)}</strong>
            </div>
            <div className="mini-kpi">
              <span className="kpi-label">Ca dư người</span>
              <strong>{compact(summary?.overStaffedShifts)}</strong>
            </div>
            <div className="mini-kpi">
              <span className="kpi-label">Nhóm ca phân tích</span>
              <strong>{compact(summary?.totalShiftGroups)}</strong>
            </div>
          </div>

          <div className="risk-panel">
            <div className="risk-head">
              <AlertTriangle size={16} />
              <span>Ca rủi ro cao nhất</span>
            </div>
            <strong>{topRisk?.shiftKey || "N/A"}</strong>
            <p>
              {topRisk
                ? `${statusLabel(topRisk.status)} • Đề xuất ${compact(topRisk.recommendedTotalStaff)} người • hiện tại ${compact(topRisk.currentAssignedStaff)}`
                : "Chưa có dữ liệu"}
            </p>
          </div>

          <div className="list-block">
            <h4>
              <BriefcaseBusiness size={16} /> Vai trò còn thiếu theo ca
            </h4>
            <ul>
              {underShifts.slice(0, 4).map((shift) => {
                const missingRoles = (shift.recommendedRoles || [])
                  .filter((r) => r.delta < 0)
                  .map((r) => `${r.role} (${Math.abs(r.delta)})`)
                  .join(", ");
                return (
                  <li key={shift.shiftKey}>
                    <div className="line-top">
                      <span className="shift-key">{shift.shiftKey}</span>
                      <span className="shift-delta">{shift.deltaStaff}</span>
                    </div>
                    <p>{missingRoles || "Thiếu nhẹ theo tổng headcount"}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="list-block">
            <h4>
              <UserPlus2 size={16} /> Gợi ý nhân sự lấp ca (best-effort)
            </h4>
            <ul>
              {(topRisk?.suggestedCandidates || []).slice(0, 4).map((candidate) => (
                <li key={`${candidate.staffId}-${candidate.role}`}>
                  <div className="line-top">
                    <span className="shift-key">{candidate.fullName}</span>
                    <span className="role-pill">{candidate.role}</span>
                  </div>
                  <p>{candidate.reason}</p>
                </li>
              ))}
              {!topRisk?.suggestedCandidates?.length ? (
                <li>
                  <div className="line-top">
                    <span className="shift-key">Không có ứng viên phù hợp ngay</span>
                    <BadgeCheck size={14} />
                  </div>
                  <p>Vui lòng kiểm tra ca chồng lấn hoặc mở rộng bộ lọc nhân sự.</p>
                </li>
              ) : null}
            </ul>
          </div>
          {(summary?.notes?.length || assistant?.meta?.fallbackUsed) ? (
            <div className="notes-block">
              <h4>Ghi chú phân tích</h4>
              {assistant?.meta?.fallbackUsed ? <span className="fallback-badge">Fallback đang được sử dụng</span> : null}
              <ul>
                {(summary?.notes || []).map((note, idx) => (
                  <li key={idx} className={note.toLowerCase().includes("performance") ? "warning-note" : ""}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

        </>
      ) : null}
    </div>
  );
};

export default StaffSchedulingAssistantWidget;
