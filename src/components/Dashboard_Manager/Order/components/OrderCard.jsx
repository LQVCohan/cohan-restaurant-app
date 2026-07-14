import React, { useMemo, useState } from "react";
import {
  Clock,
  User,
  ChefHat,
  CheckCircle,
  X,
  Check,
  MoreHorizontal,
  AlertTriangle,
  StickyNote,
} from "lucide-react";
import "./OrderCard.scss";

/* --- HELPERS --- */
const mergeDuplicateItems = (items = []) => {
  const merged = new Map();
  for (const it of items) {
    const key = `${it.dishId}_${it.method || ""}_${
      it.unit || ""
    }_${JSON.stringify(it.modifiers || [])}`;

    if (!merged.has(key)) {
      merged.set(key, { ...it, quantity: Number(it.quantity || 0) });
    } else {
      const prev = merged.get(key);
      prev.quantity += Number(it.quantity || 0);
      merged.set(key, prev);
    }
  }
  return [...merged.values()];
};

const formatCurrency = (v) =>
  (Number(v) || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  });

const PRIORITY_LABELS = {
  HIGH: "Ưu tiên cao",
  MEDIUM: "Ưu tiên vừa",
  LOW: "Ưu tiên thấp",
};
const ORDER_STATUS_LABELS = {
  draft: "Chờ thanh toán",
  pending: "Chờ xử lý",
  confirmed: "Đã nhận",
  preparing: "Đang chế biến",
  ready: "Sẵn sàng phục vụ",
  served: "Đã phục vụ",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  failed: "Thất bại",
};

const DEFAULT_TIME_THRESHOLDS = {
  warn: 10,
  danger: 20,
  critical: 30,
};

const DEFAULT_TIME_COLORS = {
  ok: "#16a34a",
  warn: "#eab308",
  danger: "#f97316",
  critical: "#b91c1c",
};

const TIME_STATUS_COLOR_KEYS = {
  ok: "ok",
  warning: "warn",
  danger: "danger",
  critical: "critical",
};

const getOrderStatusLabel = (status) => {
  const key = String(status || "").toLowerCase();
  return ORDER_STATUS_LABELS[key] || status || "Không rõ";
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const getBatchTitle = (order) => {
  if (order?.orderType !== "dine_in" || !order?.tableCode) return null;
  if (order?.batchDisplayIndex) return `Đợt ${order.batchDisplayIndex}`;
  return null;
};

const minutesSince = (createdAt) => {
  if (!createdAt) return 0;
  const d = new Date(createdAt);
  return isNaN(d.getTime())
    ? 0
    : Math.floor((Date.now() - d.getTime()) / 60000);
};

const toPositiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const normalizeTimeThresholds = (settings) => {
  const warn = toPositiveNumber(settings?.warn, DEFAULT_TIME_THRESHOLDS.warn);
  const dangerRaw = toPositiveNumber(
    settings?.danger,
    DEFAULT_TIME_THRESHOLDS.danger,
  );
  const danger = dangerRaw > warn ? dangerRaw : warn + 5;
  const criticalRaw = toPositiveNumber(
    settings?.critical,
    DEFAULT_TIME_THRESHOLDS.critical,
  );
  const critical = criticalRaw > danger ? criticalRaw : danger + 5;

  return { warn, danger, critical };
};

const sanitizeColor = (value, fallback) => {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  return fallback;
};

const normalizeTimeColors = (colors) => ({
  ok: sanitizeColor(colors?.ok, DEFAULT_TIME_COLORS.ok),
  warn: sanitizeColor(colors?.warn, DEFAULT_TIME_COLORS.warn),
  danger: sanitizeColor(colors?.danger, DEFAULT_TIME_COLORS.danger),
  critical: sanitizeColor(colors?.critical, DEFAULT_TIME_COLORS.critical),
});

const withAlpha = (hex, alphaHex = "22") =>
  /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alphaHex}` : hex;

const getTimeStatus = (minutes, thresholds) => {
  if (minutes >= thresholds.critical) return "critical";
  if (minutes >= thresholds.danger) return "danger";
  if (minutes >= thresholds.warn) return "warning";
  return "ok";
};

const getTimeStatusColor = (status, colors) => {
  const key = TIME_STATUS_COLOR_KEYS[status] || "ok";
  return colors[key] || DEFAULT_TIME_COLORS[key] || DEFAULT_TIME_COLORS.ok;
};

const isClosedOrderStatus = (status) =>
  ["cancelled", "failed", "served", "completed"].includes(
    normalizeStatus(status),
  );

/* --- SUB-COMPONENT: TIME BADGE --- */
const TimeBadge = ({ minutes, thresholds, colors }) => {
  const statusClass = getTimeStatus(minutes, thresholds);
  const statusColor = getTimeStatusColor(statusClass, colors);
  const isStrongStatus = ["danger", "critical"].includes(statusClass);
  const visualClass = statusClass === "ok" ? "fresh" : statusClass;

  return (
    <div
      className={`oc-time-badge ${visualClass} oc-time-badge--custom`}
      style={{
        "--oc-time-color": statusColor,
        "--oc-time-bg": withAlpha(statusColor, "18"),
        "--oc-time-border": withAlpha(statusColor, "55"),
        "--oc-time-solid": statusColor,
        "--oc-time-contrast": isStrongStatus ? "#fffdf8" : statusColor,
      }}
      title={`Ngưỡng: cảnh báo ${thresholds.warn}p, nguy hiểm ${thresholds.danger}p, khẩn cấp ${thresholds.critical}p`}
    >
      <Clock size={12} strokeWidth={2.5} />
      <span>{minutes > 0 ? `${minutes}p` : "Mới"}</span>
    </div>
  );
};

/* --- MAIN COMPONENT --- */
const OrderCard = ({
  order,
  onUpdateStatus,
  onViewOrder,
  isFocusMode = false,
  onViewItem,
  onRejectOrder,
  isRemoteStaffPending = false,
  onMessageCustomer,
  timeThresholds,
  timeColors,
}) => {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const normalizedThresholds = useMemo(
    () => normalizeTimeThresholds(timeThresholds),
    [timeThresholds],
  );
  const normalizedColors = useMemo(
    () => normalizeTimeColors(timeColors),
    [timeColors],
  );

  const {
    mergedItems,
    progress,
    ageMinutes,
    statusColorClass,
    timeStatus,
  } = useMemo(() => {
    const items = mergeDuplicateItems(order?.items || []);
    const age = minutesSince(order?.createdAt);

    const totalItems = items.reduce((sum, it) => sum + it.quantity, 0);
    const doneItems = items.reduce(
      (sum, it) =>
        ["ready", "served"].includes(it.status) ? sum + it.quantity : sum,
      0,
    );
    const prog = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;
    const currentTimeStatus = getTimeStatus(age, normalizedThresholds);

    let colorClass = "normal";
    if (order?.currentStatus === "cancelled" || order?.currentStatus === "failed") {
      colorClass = "cancelled";
    } else if (
      order?.currentStatus === "served" ||
      order?.currentStatus === "completed"
    ) {
      colorClass = "completed";
    } else if (currentTimeStatus === "critical") {
      colorClass = "critical";
    } else if (currentTimeStatus === "danger") {
      colorClass = "danger";
    } else if (currentTimeStatus === "warning") {
      colorClass = "warning";
    }

    return {
      mergedItems: items,
      progress: prog,
      ageMinutes: age,
      statusColorClass: colorClass,
      timeStatus: currentTimeStatus,
    };
  }, [order, normalizedThresholds]);

  const MAX_ITEMS = isFocusMode ? 20 : 4;
  const visibleItems = mergedItems.slice(0, MAX_ITEMS);
  const remainCount = Math.max(0, mergedItems.length - MAX_ITEMS);
  const customerName =
    order?.customerInfo?.name ||
    order?.shipping?.fullName ||
    order?.user?.fullName ||
    "Khách lẻ";
  const hasNote = !!order?.note;
  const hasPendingVoidRequest = (order?.items || []).some((it) =>
    (it?.voidRequests || []).some((r) => r?.status === "pending"),
  );
  const hasPendingReturnRequest = (order?.items || []).some((it) =>
    (it?.returnRequests || []).some((r) => r?.status === "pending"),
  );
  const isPaymentRequested =
    order?.payment?.status === "payment_requested" ||
    !!order?.payment?.requestedAt;
  const orderLocationLabel =
    order?.orderType === "delivery"
      ? "Giao hàng"
      : order?.orderType === "takeaway"
        ? "Mang về"
        : order?.tableCode || "Tại bàn";

  const statusLabel = getOrderStatusLabel(order?.currentStatus);
  const batchTitle = getBatchTitle(order);
  const progressStep = Math.max(0, Math.min(100, Math.round(progress / 10) * 10));
  const orderDisplayCode = order?.orderCode || order?.id || "Chưa có mã";
  const alertColor = getTimeStatusColor(timeStatus, normalizedColors);
  const shouldUseTimeAlertColor = !isClosedOrderStatus(order?.currentStatus);

  const handleCardKeyDown = (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      onViewOrder?.(order);
    }
  };

  const handleAction = async (e, status) => {
    e.stopPropagation();
    if (isActionLoading || !onUpdateStatus) return;

    setIsActionLoading(true);
    try {
      await onUpdateStatus(order?.actionOrderId || order?.id, status);
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderActions = () => {
    const status = normalizeStatus(order?.currentStatus);
    if (isActionLoading) {
      return (
        <div className="oc-loading-bar">
          <div className="bar"></div>
        </div>
      );
    }

    switch (status) {
      case "pending":
        if (isRemoteStaffPending) {
          return (
            <div className="oc-actions-grid">
              <button
                type="button"
                className="oc-btn secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOrder?.(order);
                }}
              >
                Xem chi tiết khách
              </button>
              <button
                type="button"
                className="oc-btn secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOrder?.(order);
                }}
              >
                Xem ghi chú/món
              </button>
              <button
                type="button"
                className="oc-btn secondary cancel"
                onClick={(e) => {
                  e.stopPropagation();
                  onRejectOrder?.(order?.actionOrderId || order?.id);
                }}
              >
                Từ chối đơn
              </button>
              <button
                type="button"
                className="oc-btn primary"
                onClick={(e) => handleAction(e, "confirmed")}
              >
                <Check size={16} /> Xác nhận đơn
              </button>
              <button
                type="button"
                className="oc-btn secondary"
                disabled={!order?.clientMeta?.chatThreadId}
                onClick={(e) => {
                  e.stopPropagation();
                  onMessageCustomer?.(order);
                }}
              >
                Nhắn khách
              </button>
            </div>
          );
        }
        return (
          <div className="oc-actions-grid">
            <button
              type="button"
              className="oc-btn secondary cancel"
              onClick={(e) => handleAction(e, "cancelled")}
            >
              Hủy
            </button>
            <button
              type="button"
              className="oc-btn primary"
              onClick={(e) => handleAction(e, "preparing")}
            >
              <Check size={16} /> Nhận đơn
            </button>
          </div>
        );
      case "confirmed":
        return (
          <button
            type="button"
            className="oc-btn primary"
            onClick={(e) => handleAction(e, "preparing")}
          >
            <ChefHat size={16} /> Bắt đầu chế biến
          </button>
        );
      case "preparing":
        return (
          <button
            type="button"
            className="oc-btn success"
            onClick={(e) => handleAction(e, "ready")}
          >
            <ChefHat size={16} /> Báo xong ({Math.round(progress)}%)
          </button>
        );
      case "ready":
        return (
          <button
            type="button"
            className="oc-btn primary-outline"
            onClick={(e) => handleAction(e, "served")}
          >
            <CheckCircle size={16} /> Đã trả món
          </button>
        );
      case "served":
        return (
          <div className="oc-status-label text-blue">
            <CheckCircle size={14} /> Đã phục vụ
          </div>
        );
      case "cancelled":
        return (
          <div className="oc-status-label text-red">
            <X size={14} /> Đã hủy
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`oc-card ${
        isFocusMode ? "mode-focus" : ""
      } ${statusColorClass} ${order?.currentStatus}`}
      style={
        shouldUseTimeAlertColor
          ? { "--oc-card-alert-color": alertColor }
          : undefined
      }
      onClick={() => onViewOrder?.(order)}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Mở chi tiết đơn ${orderDisplayCode}`}
    >
      <div className="oc-status-strip"></div>

      <div className="oc-header">
        <div className="oc-header-left">
          <div
            className={`oc-table-tag ${
              order?.orderType === "takeaway" ? "takeaway" : ""
            }`}
          >
            {orderLocationLabel}
          </div>

          <span className="oc-order-code">{orderDisplayCode}</span>

          <span
            className={`oc-status-pill oc-status-pill--${order?.currentStatus || "unknown"}`}
          >
            {statusLabel}
          </span>
        </div>

        <TimeBadge
          minutes={ageMinutes}
          thresholds={normalizedThresholds}
          colors={normalizedColors}
        />
      </div>
      {batchTitle && (
        <div className="oc-batch-info">
          <span className="oc-batch-title">{batchTitle}</span>
          {order?.orderCode && (
            <span className="oc-batch-code">{order.orderCode}</span>
          )}
        </div>
      )}
      <div className="oc-info-section">
        <div className="oc-guest">
          <AlertTriangle size={12} />
          <span className="name">
            {PRIORITY_LABELS[(order?.priority || "MEDIUM").toUpperCase()] ||
              "Ưu tiên vừa"}
          </span>
        </div>
      </div>

      <div className="oc-info-section">
        <div className="oc-guest">
          <User size={12} />
          <span className="name">{customerName}</span>
        </div>
        {isPaymentRequested && (
          <div className="oc-note-badge oc-note-badge--payment">
            Khách gọi thanh toán
          </div>
        )}
        {hasPendingVoidRequest && (
          <div className="oc-note-badge oc-note-badge--void">
            Có yêu cầu hủy món
          </div>
        )}
        {hasPendingReturnRequest && (
          <div className="oc-note-badge oc-note-badge--return">
            Có yêu cầu trả lại món
          </div>
        )}
        {hasNote && (
          <div className="oc-note-box">
            <StickyNote size={12} />
            <span>{order.note}</span>
          </div>
        )}
      </div>

      {order?.currentStatus === "preparing" && (
        <div className="oc-progress-track">
          <div
            className={`oc-progress-fill oc-progress-fill--${progressStep}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          ></div>
        </div>
      )}

      <div className="oc-items-wrapper custom-scrollbar">
        {visibleItems.map((item, idx) => {
          const isDone = ["ready", "served"].includes(item.status);
          return (
            <div
              key={idx}
              className={`oc-item-row ${isDone ? "done" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onViewItem) onViewItem({ item, orderInfo: order });
              }}
            >
              <div className="qty-badge">{item.quantity}</div>
              <div className="item-content">
                <div className="item-name">{item.name}</div>
                {(item.modifiers?.length > 0 || item.method) && (
                  <div className="item-meta">
                    {item.method && (
                      <span className="method">{item.method}</span>
                    )}
                    {item.modifiers?.map((mod, i) => (
                      <span key={i} className="mod">
                        + {mod.name || mod.optionName || "Modifier"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {remainCount > 0 && (
          <div className="oc-more-items">
            <MoreHorizontal size={14} /> +{remainCount} món khác
          </div>
        )}
      </div>

      <div className="oc-footer">
        <div className="oc-total">
          <span className="label">Tổng tiền</span>
          <span className="value">
            {formatCurrency(order?.totals?.grandTotal)}
          </span>
        </div>
        <div className="oc-footer-actions">{renderActions()}</div>
      </div>
    </div>
  );
};

export default OrderCard;
