import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  TrendingUp,
  MapPin,
  MoreHorizontal,
  Clock,
  Zap,
  Coffee,
  ArrowRightLeft,
  MessageSquare,
  LogOut,
  AlertCircle,
} from "lucide-react";
import "./StaffPerformance.scss";

const StaffPerformance = () => {
  const [filter, setFilter] = useState("all"); // 'all' | 'active' | 'break'
  const [activeMenuId, setActiveMenuId] = useState(null); // ID của nhân viên đang mở menu
  const menuRef = useRef(null);

  // Dữ liệu nhân viên giả lập
  const staffList = [
    {
      id: 1,
      name: "Nguyễn Văn A",
      role: "Captain",
      avatar: "https://i.pravatar.cc/150?u=1",
      zone: "Zone A (VIP)",
      status: "active", // active, break, overload
      orders: 12,
      efficiency: 95,
      avgTime: "4m",
      shift: "08:00 - 16:00",
    },
    {
      id: 2,
      name: "Trần Thị B",
      role: "Server",
      avatar: "https://i.pravatar.cc/150?u=5",
      zone: "Zone B (Sảnh)",
      status: "active",
      orders: 28,
      efficiency: 88,
      avgTime: "5m",
      shift: "10:00 - 18:00",
    },
    {
      id: 3,
      name: "Lê Hoàng C",
      role: "Runner",
      avatar: "https://i.pravatar.cc/150?u=8",
      zone: "Zone B (Sảnh)",
      status: "overload",
      orders: 45,
      efficiency: 60,
      avgTime: "12m",
      shift: "08:00 - 16:00",
    },
    {
      id: 4,
      name: "Phạm Thu D",
      role: "Server",
      avatar: "https://i.pravatar.cc/150?u=9",
      zone: "Zone C (Garden)",
      status: "break",
      orders: 15,
      efficiency: 92,
      avgTime: "6m",
      shift: "10:00 - 18:00",
    },
    {
      id: 5,
      name: "Hoàng Văn E",
      role: "Server",
      avatar: "https://i.pravatar.cc/150?u=11",
      zone: "Zone A (VIP)",
      status: "active",
      orders: 8,
      efficiency: 98,
      avgTime: "3m",
      shift: "14:00 - 22:00",
    },
  ];

  // Xử lý đóng menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Logic lọc danh sách
  const filteredStaff = staffList.filter((s) => {
    if (filter === "all") return true;
    if (filter === "active")
      return s.status === "active" || s.status === "overload";
    if (filter === "break") return s.status === "break";
    return true;
  });

  const getEfficiencyColor = (score, status) => {
    if (status === "overload") return "#ef4444";
    if (score >= 90) return "#10b981";
    if (score >= 70) return "#f59e0b";
    return "#ef4444";
  };

  const handleAction = (action, staffName) => {
    console.log(`Action: ${action} on ${staffName}`);
    setActiveMenuId(null); // Đóng menu sau khi chọn
  };

  return (
    <div className="widget-card staff-performance-widget">
      {/* --- HEADER --- */}
      <div className="widget-header">
        <div className="header-left">
          <h4>Hiệu Suất & Phân Bổ</h4>
          <span className="subtitle">Real-time Staff Tracking</span>
        </div>
        <div className="header-actions">
          <div className="stat-pill">
            <Users size={14} />{" "}
            <span>
              Tổng: <strong>12</strong>
            </span>
          </div>
          <div className="stat-pill active">
            <Zap size={14} />{" "}
            <span>
              Online: <strong>8</strong>
            </span>
          </div>
        </div>
      </div>

      {/* --- FILTER TABS --- */}
      <div className="filter-row">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Tất cả
        </button>
        <button
          className={filter === "active" ? "active" : ""}
          onClick={() => setFilter("active")}
        >
          Đang làm
        </button>
        <button
          className={filter === "break" ? "active" : ""}
          onClick={() => setFilter("break")}
        >
          Nghỉ ngơi
        </button>
      </div>

      {/* --- LIST TABLE HEADER --- */}
      <div className="list-header-row">
        <div className="col-info">Nhân sự</div>
        <div className="col-zone">Khu vực</div>
        <div className="col-kpi">Đơn/Tốc độ</div>
        <div className="col-eff">Hiệu suất</div>
        <div className="col-action"></div>
      </div>

      {/* --- SCROLLABLE LIST --- */}
      <div className="staff-scroll-area">
        {filteredStaff.map((staff) => (
          <div key={staff.id} className={`staff-item ${staff.status}`}>
            {/* 1. Info Column */}
            <div className="col-info">
              <div className="avatar-wrapper">
                <img src={staff.avatar} alt={staff.name} />
                <span className={`status-dot ${staff.status}`}></span>
              </div>
              <div className="text-info">
                <div className="name">{staff.name}</div>
                <div className="role">
                  {staff.role} • <Clock size={10} /> {staff.shift}
                </div>
              </div>
            </div>

            {/* 2. Zone Column */}
            <div className="col-zone">
              <div className="zone-badge">
                <MapPin size={10} /> {staff.zone}
              </div>
              {staff.status === "overload" && (
                <span className="warn-text">Quá tải</span>
              )}
            </div>

            {/* 3. KPI Column */}
            <div className="col-kpi">
              <div className="kpi-val">
                <strong>{staff.orders}</strong> <span className="sub">đơn</span>
              </div>
              <div className="kpi-sub">Avg: {staff.avgTime}</div>
            </div>

            {/* 4. Efficiency Column */}
            <div className="col-eff">
              <div className="eff-row">
                <span className="percent">{staff.efficiency}%</span>
                {staff.status === "break" && (
                  <Coffee size={12} className="icon-break" />
                )}
              </div>
              <div className="progress-bg">
                <div
                  className="progress-fill"
                  style={{
                    width: `${staff.efficiency}%`,
                    backgroundColor: getEfficiencyColor(
                      staff.efficiency,
                      staff.status
                    ),
                  }}
                ></div>
              </div>
            </div>

            {/* 5. Action Column (Dropdown) */}
            <div className="col-action">
              <button
                className={`btn-more ${
                  activeMenuId === staff.id ? "active" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle menu
                  setActiveMenuId(activeMenuId === staff.id ? null : staff.id);
                }}
              >
                <MoreHorizontal size={16} />
              </button>

              {/* Menu Dropdown */}
              {activeMenuId === staff.id && (
                <div
                  className="action-dropdown"
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="dropdown-item"
                    onClick={() => handleAction("move", staff.name)}
                  >
                    <ArrowRightLeft size={14} /> <span>Đổi khu vực</span>
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => handleAction("break", staff.name)}
                  >
                    <Coffee size={14} /> <span>Cho nghỉ (15p)</span>
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => handleAction("message", staff.name)}
                  >
                    <MessageSquare size={14} /> <span>Nhắn tin</span>
                  </div>
                  <div className="divider"></div>
                  <div
                    className="dropdown-item danger"
                    onClick={() => handleAction("checkout", staff.name)}
                  >
                    <LogOut size={14} /> <span>Clock Out</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- FOOTER AI INSIGHT --- */}
      <div className="ai-insight-footer">
        <div className="insight-icon">
          <TrendingUp size={16} />
        </div>
        <div className="insight-content">
          <strong>AI Suggestion:</strong> Khu vực <span>Zone B</span> đang quá
          tải ({">"}15m). Đề xuất điều chuyển <strong>Nguyễn Văn A</strong> từ
          Zone A sang hỗ trợ.
        </div>
        <button className="btn-apply">Áp dụng</button>
      </div>
    </div>
  );
};

export default StaffPerformance;
