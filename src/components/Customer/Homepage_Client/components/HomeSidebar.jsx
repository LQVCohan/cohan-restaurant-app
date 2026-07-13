import React from "react";
import { NavLink } from "react-router-dom";
import {
  BadgePercent,
  Bot,
  Compass,
  Heart,
  History,
  Sparkles,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";

const navigationItems = [
  { to: "/", label: "Khám phá", icon: Compass, end: true },
  { to: "/restaurants", label: "Nhà hàng", icon: Store },
  { to: "/cus-menu", label: "Món ăn", icon: UtensilsCrossed },
  { to: "/coupons", label: "Ưu đãi", icon: BadgePercent },
  { to: "/for-you", label: "Dành cho bạn", icon: Sparkles },
  { to: "/favorites", label: "Yêu thích", icon: Heart },
  { to: "/orders", label: "Lịch sử đặt món", icon: History },
];

export default function HomeSidebar() {
  const handleOpenAiChef = () => {
    openAiMenuAssistant({
      message: "Hôm nay tôi nên ăn món gì?",
      autoSend: false,
      pageContext: { source: "home-sidebar" },
    });
  };

  return (
    <aside className="home-dashboard-sidebar" aria-label="Điều hướng khám phá">
      <div className="home-dashboard-sidebar__brand">
        <span className="home-dashboard-sidebar__brand-mark" aria-hidden="true">
          <UtensilsCrossed />
        </span>
        <span className="home-dashboard-sidebar__brand-copy">
          <strong>Cohan</strong>
          <small>Restaurant Platform</small>
        </span>
      </div>

      <nav className="home-dashboard-sidebar__nav">
        {navigationItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `home-dashboard-sidebar__link${isActive ? " is-active" : ""}`
            }
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="home-dashboard-sidebar__assistant">
        <span className="home-dashboard-sidebar__assistant-icon" aria-hidden="true">
          <Bot />
        </span>
        <div>
          <span className="home-dashboard-sidebar__assistant-label">AI CHEF</span>
          <h2>Cần gợi ý món ngon?</h2>
          <p>AI Chef giúp bạn chọn món hợp khẩu vị và ngân sách.</p>
        </div>
        <button type="button" onClick={handleOpenAiChef}>
          Chat với AI Chef
          <Sparkles aria-hidden="true" />
        </button>
      </div>

      <p className="home-dashboard-sidebar__footer">Khám phá món ngon theo cách của bạn.</p>
    </aside>
  );
}
