import React, { useEffect, useMemo, useState } from "react";
import "./ManagementPageHeader.scss";

const fmt = (v) => (typeof v === "number" ? v.toLocaleString("vi-VN") : (v ?? "--"));

const ManagementPageHeader = ({
  eyebrow,
  title,
  greeting,
  subtitle,
  icon,
  stats = [],
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  selectedRestaurant,
  onRestaurantChange,
  restaurantList = [],
  quickActions = [],
  secondaryActions = [],
  primaryAction,
  footerLeft,
  footerRight,
  loading = false,
  isCollapsed = false,
  onToggle,
  showTimeWidget = true,
  className = "",
}) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 60000); return () => clearInterval(t); }, []);
  const shiftInfo = useMemo(() => {
    const h = currentTime.getHours();
    if (h >= 5 && h < 12) return { label: "Ca Sáng", icon: "🌅", greeting: "Chào buổi sáng" };
    if (h >= 12 && h < 18) return { label: "Ca Chiều", icon: "☀️", greeting: "Chào buổi chiều" };
    return { label: "Ca Tối", icon: "🌙", greeting: "Buổi tối tốt lành" };
  }, [currentTime]);

  return (
    <div className={`management-page-header ${isCollapsed ? "is-collapsed" : ""} ${className}`.trim()}>
      {onToggle && <button className="mph-toggle" onClick={onToggle} title="Thu gọn/Mở rộng"><span>{isCollapsed ? "▼" : "▲"}</span></button>}
      <div className="mph-left">
        {eyebrow && <div className="mph-eyebrow">{eyebrow}</div>}
        <h1 className="mph-title">{icon ? <span>{icon}</span> : null}{title}</h1>
        {!isCollapsed && <><p className="mph-greeting">{greeting || shiftInfo.greeting}</p><p className="mph-subtitle">{subtitle}</p></>}
        {!isCollapsed && showTimeWidget && <div className="mph-time"><strong>{currentTime.toLocaleTimeString("vi-VN", {hour:"2-digit",minute:"2-digit"})}</strong><span>{currentTime.toLocaleDateString("vi-VN", {weekday:"long",day:"2-digit",month:"2-digit"})}</span><em>{shiftInfo.icon} {shiftInfo.label}</em></div>}
      </div>
      <div className="mph-right">
        {!isCollapsed && !!stats.length && <div className="mph-stats">{stats.slice(0,4).map((s)=> <div key={s.id||s.label} className="mph-stat"><div>{s.icon||"•"}</div><div><span>{s.label}</span><strong>{loading?"--":fmt(s.value)}{s.suffix?` ${s.suffix}`:""}</strong></div></div>)}</div>}
        <div className="mph-controls">
          {onSearchChange && <div className="mph-search"><span>🔍</span><input value={searchValue} onChange={(e)=>onSearchChange(e.target.value)} placeholder={searchPlaceholder} /></div>}
          {onRestaurantChange && <select value={selectedRestaurant || ""} onChange={(e)=>onRestaurantChange(e.target.value)}>{!restaurantList.length && <option value="">Không có chi nhánh</option>}{restaurantList.map((r)=><option key={r.id||r._id} value={r.id||r._id}>{r.name}</option>)}</select>}
          {!isCollapsed && quickActions.map((a)=><button key={a.label} onClick={a.onClick} title={a.label} aria-label={a.label} className="mph-icon-btn">{a.icon}</button>)}
          {secondaryActions.map((a)=><button key={a.label} onClick={a.onClick} className="mph-btn mph-btn--secondary">{a.icon} {a.label}</button>)}
          {primaryAction?.onClick && <button onClick={primaryAction.onClick} className="mph-btn mph-btn--primary">{primaryAction.icon} {primaryAction.label}</button>}
        </div>
        {!isCollapsed && (footerLeft || footerRight) && <div className="mph-footer"><div>{footerLeft}</div><div>{footerRight}</div></div>}
      </div>
    </div>
  );
};

export default ManagementPageHeader;
