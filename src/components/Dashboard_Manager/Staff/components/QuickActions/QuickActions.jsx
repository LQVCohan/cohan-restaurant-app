import React from "react";
import {
  Zap,
  ClipboardCheck,
  CalendarClock,
  Wallet,
  Palmtree,
  ChevronRight,
} from "lucide-react";
import "./QuickActions.scss";

const QuickActions = ({ onPageChange }) => {
  const actions = [
    {
      id: "attendance",
      icon: ClipboardCheck,
      label: "Điểm danh",
      desc: "Check-in/out ngay",
      color: "#3b82f6", // Blue
      bgColor: "#eff6ff",
      onClick: () => onPageChange("attendance"),
    },
    {
      id: "schedule",
      icon: CalendarClock,
      label: "Lịch làm việc",
      desc: "Xem ca & đăng ký",
      color: "#f59e0b", // Amber
      bgColor: "#fffbeb",
      onClick: () => onPageChange("schedule"),
    },
    {
      id: "payroll",
      icon: Wallet,
      label: "Tính lương",
      desc: "Ước tính thu nhập",
      color: "#10b981", // Emerald
      bgColor: "#ecfdf5",
      onClick: () => alert("💰 Tính năng đang phát triển..."),
    },
    {
      id: "leave",
      icon: Palmtree,
      label: "Nghỉ phép",
      desc: "Tạo đơn nghỉ",
      color: "#8b5cf6", // Violet
      bgColor: "#f5f3ff",
      onClick: () => onPageChange("leave"),
    },
  ];

  return (
    <section className="quick-actions-card fade-in">
      <div className="card-header">
        <div className="header-title">
          <Zap size={20} className="header-icon" />
          <h3>Thao Tác Nhanh</h3>
        </div>
      </div>

      <div className="actions-grid">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              className="action-item"
              onClick={action.onClick}
              style={{ "--hover-border": action.color }} // CSS variable for dynamic hover
            >
              {/* Icon Box */}
              <div
                className="icon-box"
                style={{ color: action.color, backgroundColor: action.bgColor }}
              >
                <Icon size={24} strokeWidth={2} />
              </div>

              {/* Text Content */}
              <div className="text-content">
                <span className="action-label">{action.label}</span>
                <span className="action-desc">{action.desc}</span>
              </div>

              {/* Arrow Indicator (Optional for interactivity hint) */}
              <div className="arrow-icon">
                <ChevronRight size={16} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default QuickActions;
