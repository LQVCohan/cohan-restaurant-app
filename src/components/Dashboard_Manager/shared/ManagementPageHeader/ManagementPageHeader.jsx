import React, { useEffect, useMemo, useState } from "react";
import "./ManagementPageHeader.scss";

const MANAGER_RESTAURANT_STORAGE_KEY = "manager.selectedRestaurantId";
const MANAGER_SCOPE_EVENT = "manager:scope-selection";

const formatValue = (value) =>
  typeof value === "number" ? value.toLocaleString("vi-VN") : value ?? "--";

const renderActionIcon = (icon) => icon || null;
const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

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
  restaurantPlaceholder = "Chọn chi nhánh",
  restaurantDisabled = false,
  quickActions = [],
  secondaryActions = [],
  primaryAction,
  beforeControls,
  customFilters,
  afterControls,
  customControls,
  footerLeft,
  footerRight,
  customFooterLeft,
  customFooterRight,
  loading = false,
  isCollapsed = false,
  onToggle,
  showTimeWidget = true,
  className = "",
  density = "hero",
  statsPlacement = "right",
}) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!onRestaurantChange || typeof window === "undefined") return undefined;

    const applyManagerRestaurant = (value) => {
      const nextRestaurantId = String(value || "");
      if (!nextRestaurantId || nextRestaurantId === String(selectedRestaurant || "")) {
        return;
      }
      const isAvailable = restaurantList.some(
        (restaurant) => getRestaurantId(restaurant) === nextRestaurantId,
      );
      if (isAvailable) onRestaurantChange(nextRestaurantId);
    };

    applyManagerRestaurant(
      window.localStorage.getItem(MANAGER_RESTAURANT_STORAGE_KEY),
    );

    const handleManagerScopeSelection = (event) => {
      if (event?.detail?.key !== MANAGER_RESTAURANT_STORAGE_KEY) return;
      applyManagerRestaurant(event.detail.value);
    };

    window.addEventListener(MANAGER_SCOPE_EVENT, handleManagerScopeSelection);
    return () =>
      window.removeEventListener(MANAGER_SCOPE_EVENT, handleManagerScopeSelection);
  }, [onRestaurantChange, restaurantList, selectedRestaurant]);

  const publishRestaurantSelection = (value) => {
    const nextRestaurantId = String(value || "");
    if (typeof window === "undefined") {
      onRestaurantChange?.(nextRestaurantId);
      return;
    }

    if (nextRestaurantId) {
      window.localStorage.setItem(
        MANAGER_RESTAURANT_STORAGE_KEY,
        nextRestaurantId,
      );
    } else {
      window.localStorage.removeItem(MANAGER_RESTAURANT_STORAGE_KEY);
    }
    window.dispatchEvent(
      new CustomEvent(MANAGER_SCOPE_EVENT, {
        detail: {
          key: MANAGER_RESTAURANT_STORAGE_KEY,
          value: nextRestaurantId,
          source: "management-page-header",
        },
      }),
    );
  };

  const shiftInfo = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12)
      return { label: "Ca Sáng", icon: "🌅", greet: "Chào buổi sáng" };
    if (hour >= 12 && hour < 18)
      return { label: "Ca Chiều", icon: "☀️", greet: "Chào buổi chiều" };
    return { label: "Ca Tối", icon: "🌙", greet: "Buổi tối tốt lành" };
  }, [currentTime]);

  const renderAction = (action, kind = "secondary") => {
    if (!action?.onClick) return null;
    const cls =
      kind === "primary" || action.variant === "primary"
        ? "mph-btn mph-btn--primary"
        : "mph-btn mph-btn--secondary";
    return (
      <button
        key={action.label}
        type="button"
        onClick={action.onClick}
        className={cls}
        disabled={action.disabled || action.loading}
        title={action.title || action.label}
        aria-label={action.ariaLabel || action.label}
      >
        {renderActionIcon(action.icon)}
        <span>{action.loading ? "Đang xử lý..." : action.label}</span>
      </button>
    );
  };

  return (
    <section
      className={`management-page-header density-${density} stats-${statsPlacement} ${isCollapsed ? "is-collapsed" : ""} ${className}`.trim()}
    >
      {onToggle && (
        <button
          className="mph-toggle"
          onClick={onToggle}
          title="Thu gọn/Mở rộng"
          type="button"
        >
          <span>{isCollapsed ? "▼" : "▲"}</span>
        </button>
      )}

      <div className="mph-left">
        {eyebrow && <div className="mph-eyebrow">{eyebrow}</div>}
        <h1 className="mph-title">
          {icon && <span className="mph-title__icon">{icon}</span>}
          <span>{title}</span>
        </h1>
        {!isCollapsed && (
          <>
            <p className="mph-greeting">{greeting || shiftInfo.greet}</p>
            {subtitle && <p className="mph-subtitle">{subtitle}</p>}
          </>
        )}

        {!isCollapsed && showTimeWidget && (
          <div className="mph-time-widget">
            <div className="mph-time-widget__main">
              {currentTime.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="mph-time-widget__sub">
              {currentTime.toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
              })}
            </div>
            <div className="mph-time-widget__shift">
              {shiftInfo.icon} {shiftInfo.label}
            </div>
          </div>
        )}
      </div>

      <div className="mph-right">
        {!isCollapsed && statsPlacement !== "none" && stats.length > 0 && (
          <div className="mph-stats-grid">
            {stats.slice(0, 4).map((item) => (
              <div
                key={item.id || item.label}
                className={`mph-stat-card tone-${item.tone || "default"}`}
              >
                <div className="mph-stat-card__icon">{item.icon || "•"}</div>
                <div className="mph-stat-card__body">
                  <span className="mph-stat-card__label">{item.label}</span>
                  <div className="mph-stat-card__value-wrap">
                    <strong className="mph-stat-card__value">
                      {loading ? "--" : formatValue(item.value)}
                    </strong>
                    {item.suffix && (
                      <span className="mph-stat-card__suffix">{item.suffix}</span>
                    )}
                    {item.trend && (
                      <span className="mph-stat-card__trend">{item.trend}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mph-controls-row">
          {beforeControls}

          {onSearchChange && (
            <label className="mph-search" aria-label="search">
              <span>🔍</span>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
          )}

          {onRestaurantChange && (
            <select
              className="mph-select"
              value={selectedRestaurant || ""}
              onChange={(e) => publishRestaurantSelection(e.target.value)}
              disabled={restaurantDisabled}
            >
              {!restaurantList.length && (
                <option value="">{restaurantPlaceholder}</option>
              )}
              {restaurantList.map((restaurant) => {
                const restaurantId = getRestaurantId(restaurant);
                return (
                  <option key={restaurantId} value={restaurantId}>
                    {restaurant.name}
                  </option>
                );
              })}
            </select>
          )}

          {customFilters}

          {!isCollapsed &&
            quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="mph-icon-btn"
                onClick={action.onClick}
                title={action.title || action.label}
                aria-label={action.ariaLabel || action.label}
                disabled={action.disabled || action.loading}
              >
                {renderActionIcon(action.icon)}
              </button>
            ))}

          {secondaryActions.map((action) => renderAction(action))}
          {renderAction(primaryAction, "primary")}
          {afterControls}
          {customControls}
        </div>

        {!isCollapsed &&
          (footerLeft || footerRight || customFooterLeft || customFooterRight) && (
            <div className="mph-footer-row">
              <div>{customFooterLeft || footerLeft}</div>
              <div>{customFooterRight || footerRight}</div>
            </div>
          )}
      </div>
    </section>
  );
};

export default ManagementPageHeader;
