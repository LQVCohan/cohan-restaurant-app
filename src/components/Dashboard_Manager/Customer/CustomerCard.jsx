// src/components/CustomerManagement/CustomerCard.jsx
import React, { useMemo, useState } from "react";
import {
  Phone,
  Mail,
  ChevronRight,
  Star,
  Zap,
  Award,
  UserCheck,
  Copy,
  Check,
} from "lucide-react";
import "./CustomerCard.scss";
import "./CustomerToneSystem.scss";
import CustomerAvatarMedia from "./CustomerAvatarMedia";
import { getRankDisplayConfig } from "./customerRankUtils";

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
      0,
    );
  }
  return Number(entry?.amount) || 0;
};

const copyText = async (text) => {
  const value = String(text || "").trim();
  if (!value || !navigator?.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(value);
  return true;
};

const STATUS_CONFIG = {
  online: "online",
  ordering: "ordering",
  away: "away",
  offline: "offline",
};

const STATUS_LABELS = {
  online: "Đang hoạt động",
  ordering: "Đang gọi món",
  away: "Tạm vắng",
  offline: "Không hoạt động",
};

const CustomerCard = ({ customer, onClick }) => {
  const [copiedField, setCopiedField] = useState("");

  const cleanName = useMemo(
    () => (customer?.name || "Khách hàng").replace("🟡", "").trim(),
    [customer?.name],
  );

  const customerCode = customer?.id
    ? `#${String(customer.id).padStart(4, "0")}`
    : "Chưa có mã khách";
  const statusKey = STATUS_CONFIG[customer?.status] || "offline";
  const statusLabel = STATUS_LABELS[statusKey] || STATUS_LABELS.offline;

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
    const recentCount = sortedRecentOrders.length;
    const recentTotal = sortedRecentOrders.reduce(
      (sum, entry) => sum + getEntryAmount(entry),
      0,
    );
    const storedCount = Number(customer?.totalOrders);
    const storedTotal = Number(customer?.totalSpending);
    const count =
      Number.isFinite(storedCount) && storedCount >= 0
        ? storedCount
        : recentCount;
    const total =
      Number.isFinite(storedTotal) && storedTotal >= 0
        ? storedTotal
        : recentTotal;
    const avg = count > 0 ? total / count : 0;
    return { count, total, avg };
  }, [sortedRecentOrders]);

  const nearestOrder = sortedRecentOrders[0];
  const favoriteItems = Array.isArray(customer?.favoriteItems)
    ? customer.favoriteItems
    : [];

  const handleOpen = () => onClick?.(customer);

  const handleCardKeyDown = (event) => {
    if (event.target.closest?.("button")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  };

  const handleCopyField = async (event, key, value) => {
    event.stopPropagation();
    const copied = await copyText(value);
    if (!copied) return;
    setCopiedField(key);
    window.setTimeout(
      () => setCopiedField((current) => (current === key ? "" : current)),
      1300,
    );
  };

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
      <span
        className={`cc-badge ${rankConfig.variant === "custom" ? "regular" : rankConfig.variant}`}
      >
        {iconMap[rankConfig.iconKey] || iconMap.zap} {rankConfig.label}
      </span>
    );
  };

  return (
    <div
      className="customer-card"
      onClick={handleOpen}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Mở hồ sơ khách hàng ${cleanName}`}
    >
      <div className="cc-header">
        <div className="cc-avatar-wrapper">
          <div className="cc-avatar">
            <CustomerAvatarMedia
              customer={customer}
              name={cleanName}
              iconSize={24}
            />
          </div>
          <span
            className={`cc-status-dot ${statusKey}`}
            title={statusLabel}
            aria-label={statusLabel}
            role="status"
          />
        </div>
        <div className="cc-info">
          <div className="cc-name-row">
            <h3>{cleanName}</h3>
            <button
              type="button"
              className={`cc-copy-mini ${copiedField === "id" ? "is-copied" : ""}`}
              onClick={(event) => handleCopyField(event, "id", customer?.id)}
              disabled={!customer?.id}
              aria-label={`Sao chép mã khách hàng ${customerCode}`}
              title="Sao chép mã khách hàng"
            >
              {copiedField === "id" ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <div className="cc-customer-id">{customerCode}</div>
          <div className="cc-badges">
            {renderCustomerType()}
            {customer?.isGuest && (
              <span className="cc-badge guest">Vãng lai</span>
            )}
            <span
              className={`cc-badge ${
                customer?.verificationStatus === "verified" ||
                customer?.verificationStatus === "email_verified" ||
                customer?.verificationStatus === "phone_verified"
                  ? "regular"
                  : "guest"
              }`}
            >
              {customer?.verificationLabel ||
                (customer?.verificationStatus === "verified"
                  ? "Đã xác minh"
                  : "Chưa xác minh")}
            </span>
          </div>
        </div>
      </div>

      <div className="cc-stats-grid">
        <div className="cc-stat-box gold">
          <div className="val">{customer?.loyaltyPoints || 0}</div>
          <div className="lbl">Điểm</div>
        </div>
        <div className="cc-stat-box blue">
          <div className="val">{stats.count}</div>
          <div className="lbl">Tổng đơn</div>
        </div>
        <div className="cc-stat-box purple">
          <div className="val">{formatMoney(stats.avg).replace("₫", "")}</div>
          <div className="lbl">TB mỗi đơn</div>
        </div>
      </div>

      <div className="cc-body">
        <div className="cc-contact-list">
          <div className={`cc-row ${customer?.email ? "has-copy" : ""}`}>
            <Mail aria-hidden="true" />
            <span title={customer?.email || "Chưa có email"}>
              {customer?.email || "Chưa có email"}
            </span>
            {customer?.email && (
              <button
                type="button"
                className={`cc-copy-btn ${copiedField === "email" ? "is-copied" : ""}`}
                onClick={(event) =>
                  handleCopyField(event, "email", customer.email)
                }
                aria-label={`Sao chép email của ${cleanName}`}
                title="Sao chép email"
              >
                {copiedField === "email" ? (
                  <Check size={13} />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            )}
          </div>
          <div className={`cc-row ${customer?.phone ? "has-copy" : ""}`}>
            <Phone aria-hidden="true" />
            <span title={customer?.phone || "Chưa có số điện thoại"}>
              {customer?.phone || "Chưa có số điện thoại"}
            </span>
            {customer?.phone && (
              <button
                type="button"
                className={`cc-copy-btn ${copiedField === "phone" ? "is-copied" : ""}`}
                onClick={(event) =>
                  handleCopyField(event, "phone", customer.phone)
                }
                aria-label={`Sao chép số điện thoại của ${cleanName}`}
                title="Sao chép số điện thoại"
              >
                {copiedField === "phone" ? (
                  <Check size={13} />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            )}
          </div>
        </div>

        {favoriteItems.length > 0 ? (
          <div className="cc-favs" aria-label="Món thường gọi">
            {favoriteItems.slice(0, 3).map((item, i) => (
              <span key={i}>{item}</span>
            ))}
            {favoriteItems.length > 3 && (
              <span>+{favoriteItems.length - 3}</span>
            )}
          </div>
        ) : (
          <div className="cc-favs cc-empty-favs">Chưa có món yêu thích</div>
        )}
      </div>

      <div className="cc-footer">
        {nearestOrder ? (
          <div className="cc-last-order">
            <span className="lo-label">Đơn gần nhất</span>
            <span className="lo-date">
              {formatDate(nearestOrder?.raw?.createdAt || nearestOrder?.date)}
            </span>
          </div>
        ) : (
          <div className="cc-last-order">
            <span className="lo-label">Ngày tham gia</span>
            <span className="lo-date">{formatDate(customer?.joinDate)}</span>
          </div>
        )}

        <div className="cc-actions">
          <button
            className="btn-view"
            type="button"
            title="Mở hồ sơ khách hàng"
            onClick={(event) => {
              event.stopPropagation();
              handleOpen();
            }}
            aria-label={`Mở hồ sơ khách hàng ${cleanName}`}
          >
            Xem hồ sơ
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard;
