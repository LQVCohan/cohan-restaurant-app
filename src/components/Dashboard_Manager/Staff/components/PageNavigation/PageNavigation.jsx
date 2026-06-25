import React from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardCheck,
  Palmtree,
  CalendarRange,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import "./PageNavigation.scss";

const PageNavigation = ({ currentPage, onPageChange, badgeCounts = {} }) => {
  const ActiveBackground = motion.div;

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
      badgeKey: "leaveRequests",
    },
    {
      id: "schedule",
      label: "Lịch làm",
      icon: CalendarRange,
    },
    {
      id: "performance",
      label: "Hiệu suất",
      icon: TrendingUp,
    },
    {
      id: "reports",
      label: "Báo cáo",
      icon: BarChart3,
    },
  ];

  const handlePageChange = (pageId) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("staff:page-change", {
          detail: { page: pageId, source: "staff-page-navigation" },
        }),
      );
    }
    onPageChange(pageId);
  };

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
              onClick={() => handlePageChange(page.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="icon-wrapper">
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {count > 0 && (
                  <span className="badge-indicator">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              <span className="nav-label">{page.label}</span>

              {isActive && <ActiveBackground className="active-bg" layoutId="staff-nav-active" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PageNavigation;
