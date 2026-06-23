import React from "react";
import { UsersRound, AlertTriangle, BadgeCheck, UserPlus2, BriefcaseBusiness } from "lucide-react";
import "./StaffSchedulingAssistantWidget.scss";

const compact = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));

const statusLabel = (status) => {
  if (status === "understaffed") return "Thiếu người";
  if (status === "overstaffed") return "Dư người";
  return "Cân bằng";
};
const viRole = (role) => ({ server: "phục vụ", cook: "bếp", cashier: "thu ngân", bartender: "pha chế" }[role] || role);
const shiftLabelMap = { morning: "ca sáng", afternoon: "ca chiều", evening: "ca tối" };
const formatShiftKey = (shiftKey = "") => {
  const [dateRaw, shiftRaw] = String(shiftKey).split("|");
  const shiftLabel = shiftLabelMap[shiftRaw] || "ca làm việc";
  if (!dateRaw) return shiftLabel;
  const [y, m, d] = dateRaw.split("-");
  const dateLabel = y && m && d ? `${d}/${m}` : dateRaw;
  return `${shiftLabel} ngày ${dateLabel}`;
};
const normalizeReason = (reason = "") =>
  String(reason)
    .replaceAll("+", ", ")
    .replaceAll("working", "đang làm việc")
    .replaceAll("matching department", "đúng bộ phận")
    .replaceAll("no overlap in current window", "không trùng ca hiện tại")
    .replaceAll("performance fallback", "chưa đủ dữ liệu hiệu suất")
    .replaceAll("recent performance", "hiệu suất gần đây")
    .replaceAll("part-time employee availability unknown", "chưa có lịch rảnh của nhân viên part-time")
    .replaceAll("availability", "lịch rảnh")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
const methodLabel = (method = "") => ({
  staff_scheduling_v1: "Dựa trên lịch làm và dự báo nhu cầu",
}[method] || "Dựa trên lịch làm và vai trò nhân sự");

const MetaStrip = ({ meta }) => meta ? (
  <div className="ai-meta-strip">
    {meta.fallbackUsed ? <span className="verify-badge">Cần kiểm tra lại</span> : null}
    <span>{methodLabel(meta.method)}</span>
    <span>{meta.basedOnForecast ? "Có dùng dự báo nhu cầu" : "Dựa trên lịch hiện tại"}</span>
    {meta.generatedAt ? <span>Cập nhật {new Date(meta.generatedAt).toLocaleString("vi-VN")}</span> : null}
  </div>
) : null;

const StaffSchedulingAssistantWidget = ({ assistant, loading, onNavigate }) => {
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
            <h3>Gợi ý phân ca thông minh</h3>
            <p>Đề xuất nhân sự theo nhu cầu từng ca</p>
          </div>
        </div>
        <button type="button" className="mode-pill forecast" onClick={() => onNavigate?.("schedules")}>
          Mở lịch làm
        </button>
      </div>
      <MetaStrip meta={assistant?.meta} />

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
            <strong>{topRisk ? formatShiftKey(topRisk.shiftKey) : "N/A"}</strong>
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
                const missingRolesList = (shift.recommendedRoles || [])
                  .filter((r) => r.delta < 0)
                  .map((r) => `${viRole(r.role)} (${Math.abs(r.delta)})`);
                const missingCount = Math.max(0, Number(shift.recommendedTotalStaff || 0) - Number(shift.currentAssignedStaff || 0));
                return (
                  <li key={shift.shiftKey}>
                    <div className="line-top">
                      <span className="shift-key">{formatShiftKey(shift.shiftKey)}</span>
                      <span className="shift-delta">{missingCount > 0 ? `Đang thiếu ${missingCount}` : "Thiếu nhẹ"}</span>
                    </div>
                    <p>{missingCount > 0 ? `Cần bổ sung ${missingCount} người cho ${formatShiftKey(shift.shiftKey)}: ${missingRolesList.join(", ") || "theo tổng nhân sự cần có"}.` : "Thiếu nhẹ theo tổng nhân sự cần có."}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="list-block">
            <h4>
              <UserPlus2 size={16} /> Gợi ý nhân sự lấp ca
            </h4>
            <h4 className="subheading">
              Nhân sự có thể xếp ca
            </h4>
            <ul>
              {(topRisk?.suggestedCandidates || []).slice(0, 4).map((candidate) => (
                <li key={`${candidate.staffId}-${candidate.role}`}>
                  <div className="line-top">
                    <span className="shift-key">{candidate.fullName}</span>
                    <span className="role-pill">{viRole(candidate.role)}</span>
                  </div>
                  <p>{normalizeReason(candidate.reason)}</p>
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
              {assistant?.meta?.fallbackUsed ? <span className="fallback-badge">Chưa đủ dữ liệu hiệu suất, hệ thống đang ưu tiên theo vai trò và lịch trống.</span> : null}
              <ul>
                {(summary?.notes || []).map((note, idx) => (
                  <li key={idx} className={note.toLowerCase().includes("performance") ? "warning-note" : ""}>{String(note || "").replace(/\bserver\b/gi, "phục vụ").replace(/\bcook\b/gi, "bếp").replace(/\bcashier\b/gi, "thu ngân").replace(/\bbartender\b/gi, "pha chế")}</li>
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
