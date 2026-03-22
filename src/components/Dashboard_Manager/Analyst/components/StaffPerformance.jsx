import React, { useMemo, useState } from "react";
import { Users } from "lucide-react";
import "./StaffPerformance.scss";

const StaffPerformance = ({ staffList = [], loading }) => {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "all") return staffList;
    return staffList.filter((x) => x.status === filter);
  }, [staffList, filter]);

  return (
    <div className="widget-card staff-performance-widget">
      <div className="widget-header">
        <div className="header-left">
          <h4>Hiệu Suất & Phân Bổ</h4>
          <span className="subtitle">Theo dữ liệu đơn hàng thực</span>
        </div>
        <div className="header-actions">
          <div className="stat-pill">
            <Users size={14} /> <span>Tổng: <strong>{staffList.length}</strong></span>
          </div>
        </div>
      </div>
      <div className="filter-row">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tất cả</button>
        <button className={filter === "working" ? "active" : ""} onClick={() => setFilter("working")}>Đang làm</button>
        <button className={filter === "on_leave" ? "active" : ""} onClick={() => setFilter("on_leave")}>Nghỉ</button>
      </div>
      <div className="staff-scroll-area">
        {loading ? <div className="empty-state">Đang tải...</div> : null}
        {!loading &&
          filtered.map((staff) => (
            <div key={staff.staffId} className="staff-item">
              <div className="col-info">
                <div className="text-info">
                  <div className="name">{staff.fullName}</div>
                  <div className="role">{staff.role}</div>
                </div>
              </div>
              <div className="col-kpi">
                <div className="kpi-val">
                  <strong>{staff.ordersHandled}</strong> <span className="sub">đơn</span>
                </div>
              </div>
              <div className="col-eff">
                <div className="eff-row">
                  <span className="percent">{staff.efficiency}%</span>
                </div>
                <div className="progress-bg">
                  <div className="progress-fill" style={{ width: `${staff.efficiency}%` }}></div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default StaffPerformance;
