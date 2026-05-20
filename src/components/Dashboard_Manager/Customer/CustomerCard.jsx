// src/components/CustomerManagement/CustomerCard.jsx
import React, { useMemo } from "react";
import {
  User,
  Phone,
  Mail,
  ChevronRight,
  Star,
  Zap,
  Award,
  UserCheck,
} from "lucide-react";
import "./CustomerCard.scss";
import { getRankDisplayConfig } from "./customerRankUtils";

/* --- Helpers Functions (Giữ nguyên) --- */
const normalizeEpochToMs = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.floor(v)).length === 10 ? v * 1000 : v;
  }
  if (typeof v === "string") {
    if (/^\d+$/.test(v.trim())) {
      const n = Number(v.trim());
      return String(n).length === 10 ? n * 1000 : n;
    }
    const p = Date.parse(v);
    return Number.isFinite(p) ? p : null;
  }
  return null;
};

const formatMoney = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0);

const formatDate = (date) => {
  const ms = normalizeEpochToMs(date);
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString("vi-VN") : "—";
};

const getEntryAmount = (entry) => {
  if (entry?.raw?.totals?.grandTotal != null)
    return Number(entry.raw.totals.grandTotal);
  if (Array.isArray(entry?.raw?.items) && entry.raw.items.length) {
    return entry.raw.items.reduce(
      (sum, it) =>
        sum +
        (Number(it?.price || 0) + Number(it?.modifiersPrice || 0)) *
          Number(it?.quantity || 1),
      0
    );
  }
  return Number(entry?.amount) || 0;
};

const STATUS_CONFIG = {
  online: "online",
  ordering: "ordering",
  away: "away",
  offline: "offline",
};

const CustomerCard = ({ customer, onClick }) => {

  // --- Logic ---
  const cleanName = useMemo(
    () => (customer?.name || "Khách hàng").replace("🟡", "").trim(),
    [customer?.name]
  );

  const sortedRecentOrders = useMemo(() => {
    const list = Array.isArray(customer?.recentOrders)
      ? customer.recentOrders
      : [];
    return [...list].sort((a, b) => {
      const ams =
        normalizeEpochToMs(a?.raw?.createdAt ?? a?.createdAt ?? a?.date) ?? 0;
      const bms =
        normalizeEpochToMs(b?.raw?.createdAt ?? b?.createdAt ?? b?.date) ?? 0;
      return bms - ams;
    });
  }, [customer?.recentOrders]);

  const stats = useMemo(() => {
    const count = sortedRecentOrders.length;
    const total = sortedRecentOrders.reduce(
      (sum, entry) => sum + getEntryAmount(entry),
      0
    );
    const avg = count > 0 ? total / count : 0;
    return { count, total, avg };
  }, [sortedRecentOrders]);

  const nearestOrder = sortedRecentOrders[0];
  const favoriteItems = Array.isArray(customer?.favoriteItems)
    ? customer.favoriteItems
    : [];

  // --- Handlers ---
  const renderCustomerType = () => {
    const rankConfig = getRankDisplayConfig(
      customer?.customerType || customer?.rankName,
      customer?.rankSettings || [],
    );
    const iconMap = {
      star: <Star size={10} fill="currentColor" />,
      award: <Award size={10} />,
      zap: <Zap size={10} fill="currentColor" />,
      userCheck: <UserCheck size={10} />,
    };

    return (
      <span className={`cc-badge ${rankConfig.variant === "custom" ? "regular" : rankConfig.variant}`}>
        {iconMap[rankConfig.iconKey] || iconMap.zap} {rankConfig.label}
      </span>
    );
  };

  return (
    <>
      <div className="customer-card" onClick={() => onClick?.(customer)}>
        {/* 1. Header: Avatar & Name */}
        <div className="cc-header">
          <div className="cc-avatar-wrapper">
          <div className="cc-avatar">
              {customer?.avatar ? (
                typeof customer.avatar === "string" &&
                customer.avatar.startsWith("http") ? (
                  <img src={customer.avatar} alt="" />
                ) : (
                  <span>{customer.avatar}</span>
                )
              ) : (
                <User size={24} />
              )}
            </div>
            <div
              className={`cc-status-dot ${
                STATUS_CONFIG[customer?.status] || "offline"
              }`}
            />
          </div>
          <div className="cc-info">
            <h3>{cleanName}</h3>
            <div className="cc-badges">
              {renderCustomerType()}
              {customer?.isGuest && (
                <span className="cc-badge guest">Vãng lai</span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Stats Grid (Colored Blocks) */}
        <div className="cc-stats-grid">
          <div className="cc-stat-box gold">
            <div className="val">{customer?.loyaltyPoints || 0}</div>
            <div className="lbl">Điểm</div>
          </div>
          <div className="cc-stat-box blue">
            <div className="val">{stats.count}</div>
            <div className="lbl">Đơn</div>
          </div>
          <div className="cc-stat-box purple">
            <div className="val">{formatMoney(stats.avg).replace("₫", "")}</div>
            <div className="lbl">TB/Đơn</div>
          </div>
        </div>

        {/* 3. Body: Contact & Favorites */}
        <div className="cc-body">
          <div className="cc-row">
            <Mail /> <span>{customer?.email || "Chưa có email"}</span>
          </div>
          <div className="cc-row">
            <Phone /> <span>{customer?.phone || "Chưa có SĐT"}</span>
          </div>

          {/* Favorite Items Chips */}
          {favoriteItems.length > 0 ? (
            <div className="cc-favs">
              {favoriteItems.slice(0, 3).map((item, i) => (
                <span key={i}>{item}</span>
              ))}
              {favoriteItems.length > 3 && (
                <span>+{favoriteItems.length - 3}</span>
              )}
            </div>
          ) : (
            <div className="cc-favs opacity-50 italic text-[10px]">
              Chưa có món yêu thích
            </div>
          )}
        </div>

        {/* 4. Footer: Last Order & Action */}
        <div className="cc-footer">
          {nearestOrder ? (
            <div className="cc-last-order">
              <span className="lo-label">Đơn mới nhất</span>
              <span className="lo-date">
                {formatDate(nearestOrder?.raw?.createdAt || nearestOrder?.date)}
              </span>
            </div>
          ) : (
            <div className="cc-last-order">
              <span className="lo-label">Tham gia</span>
              <span className="lo-date">{formatDate(customer?.joinDate)}</span>
            </div>
          )}

          <div className="cc-actions">
            <button className="btn-view" title="Xem chi tiết">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerCard;
