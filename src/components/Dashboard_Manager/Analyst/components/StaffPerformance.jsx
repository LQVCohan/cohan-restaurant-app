import React, { useMemo, useState } from "react";
import { ArrowRight, BarChart2, Users } from "lucide-react";
import "./StaffPerformance.scss";

const FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "working", label: "Đang làm" },
  { value: "on_leave", label: "Nghỉ" },
];

const STATUS_LABELS = {
  working: "Đang làm",
  on_leave: "Nghỉ",
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();
const clampEfficiency = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const goStaff = () =>
  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: { page: "staff", source: "manager-analytics" },
    }),
  );

const StaffPerformance = ({ staffList = [], loading }) => {
  const [filter, setFilter] = useState("all");
  const safeStaffList = Array.isArray(staffList) ? staffList : [];
  const hasRealPerformanceData = safeStaffList.some(
    (staff) =>
      Number(staff?.efficiency || 0) > 0 || Number(staff?.ordersHandled || 0) > 0,
  );
  const filtered = useMemo(() => {
    if (filter === "all") return safeStaffList;
    return safeStaffList.filter(
      (staff) => normalizeStatus(staff?.status) === filter,
    );
  }, [safeStaffList, filter]);

  return (
    <div className="widget-card staff-performance-widget">
      <div className="widget-header">
        <div className="header-left">
          <h4>Hiệu suất nhân viên</h4>
          <span className="subtitle">Số đơn đã xử lý và mức hiệu quả trong kỳ</span>
        </div>
        <div className="stat-pill" aria-label={`${safeStaffList.length} nhân viên`}>
          <Users size={14} />
          <strong>{safeStaffList.length}</strong>
          <span>nhân viên</span>
        </div>
      </div>

      {!loading && hasRealPerformanceData ? (
        <div className="filter-row" aria-label="Lọc hiệu suất nhân viên">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? "active" : ""}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="staff-scroll-area">
        {loading ? (
          <div className="empty-state neutral staff-loading" role="status">
            Đang tải hiệu suất nhân viên...
          </div>
        ) : null}

        {!loading && !hasRealPerformanceData ? (
          <div className="empty-state neutral analytics-action-empty">
            <BarChart2 size={18} />
            <strong>Chưa có dữ liệu hiệu suất</strong>
            <p>Chỉ số sẽ xuất hiện sau khi nhân viên xử lý đơn trong kỳ đã chọn.</p>
            <button type="button" className="widget-cta" onClick={goStaff}>
              Xem nhân viên <ArrowRight size={14} />
            </button>
          </div>
        ) : null}

        {!loading && hasRealPerformanceData && filtered.length === 0 ? (
          <div className="empty-state neutral filtered-empty" role="status">
            Không có nhân viên phù hợp với bộ lọc này.
          </div>
        ) : null}

        {!loading &&
          hasRealPerformanceData &&
          filtered.map((staff, index) => {
            const efficiency = clampEfficiency(staff?.efficiency);
            const status = normalizeStatus(staff?.status);

            return (
              <article
                key={staff?.staffId || `${staff?.fullName || "staff"}-${index}`}
                className="staff-item"
              >
                <div className="col-info">
                  <div className="staff-avatar" aria-hidden="true">
                    {(staff?.fullName || "NV").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="text-info">
                    <div className="name">{staff?.fullName || "Nhân viên"}</div>
                    <div className="role">
                      {staff?.role || "Chưa cập nhật vai trò"}
                      {STATUS_LABELS[status] ? (
                        <span className={`status-badge status-badge--${status}`}>
                          {STATUS_LABELS[status]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="col-kpi">
                  <strong>{Number(staff?.ordersHandled || 0)}</strong>
                  <span>đơn</span>
                </div>

                <div className="col-eff">
                  <div className="eff-row">
                    <span>Hiệu quả</span>
                    <strong>{Math.round(efficiency)}%</strong>
                  </div>
                  <div
                    className="progress-bg"
                    role="progressbar"
                    aria-label={`Hiệu suất của ${staff?.fullName || "nhân viên"}`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={Math.round(efficiency)}
                  >
                    <div
                      className="progress-fill"
                      style={{ width: `${efficiency}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
};

export default StaffPerformance;
