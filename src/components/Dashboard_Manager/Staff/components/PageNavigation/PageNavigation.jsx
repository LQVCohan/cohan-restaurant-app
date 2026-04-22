import React from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardCheck,
  Palmtree,
  CalendarRange,
  BarChart3,
  Bell,
} from "lucide-react";
import "./PageNavigation.scss";

const PageNavigation = ({ currentPage, onPageChange, badgeCounts = {} }) => {
  const ActiveBackground = motion.div;
  // Định nghĩa danh sách trang kèm Icon component
  const pages = [
    {
      id: "dashboard",
      label: "Tổng quan",
      icon: LayoutDashboard,
    },
    {
      id: "attendance",
      label: "Chấm công",
      icon: ClipboardCheck,
    },
    {
      id: "leave",
      label: "Nghỉ phép",
      icon: Palmtree,
      badgeKey: "leaveRequests", // Key để lấy số lượng badge
    },
    {
      id: "schedule",
      label: "Lịch làm",
      icon: CalendarRange,
    },
    {
      id: "reports",
      label: "Báo cáo",
      icon: BarChart3,
    },
  ];

  return (
    <div className="page-nav-container">
      <div className="nav-inner-wrapper">
        {pages.map((page) => {
          const Icon = page.icon;
          const isActive = currentPage === page.id;
          const count = page.badgeKey ? badgeCounts[page.badgeKey] : 0;

          return (
            <button
              key={page.id}
              type="button"
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => onPageChange(page.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="icon-wrapper">
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {/* Hiển thị chấm đỏ thông báo nếu có */}
                {count > 0 && (
                  <span className="badge-indicator">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span className="nav-label">{page.label}</span>

              {/* Hiệu ứng nền chuyển động (Active Background) */}
              {isActive && <ActiveBackground className="active-bg" layoutId="nav-bg" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PageNavigation;
