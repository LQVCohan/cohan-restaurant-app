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
  Utensils,
  StickyNote,
} from "lucide-react";
import "./OrderCard.scss";

/* --- HELPERS --- */
const mergeDuplicateItems = (items = []) => {
  const merged = new Map();
  for (const it of items) {
    // Key bao gồm cả modifiers/note để không gộp nhầm món có yêu cầu khác nhau
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

const PRIORITY_LABELS = { HIGH: "Ưu tiên cao", MEDIUM: "Ưu tiên vừa", LOW: "Ưu tiên thấp" };

const minutesSince = (createdAt) => {
  if (!createdAt) return 0;
  const d = new Date(createdAt);
  return isNaN(d.getTime())
    ? 0
    : Math.floor((Date.now() - d.getTime()) / 60000);
};

/* --- SUB-COMPONENT: TIME BADGE --- */
const TimeBadge = ({ minutes }) => {
  let statusClass = "fresh";
  if (minutes >= 30) statusClass = "critical";
  else if (minutes >= 20) statusClass = "danger";
  else if (minutes >= 10) statusClass = "warning";

  return (
    <div className={`oc-time-badge ${statusClass}`}>
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
  onViewItem, // Callback khi click vào món
}) => {
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Memoize logic gộp món & tính toán
  const { mergedItems, progress, ageMinutes, statusColorClass } =
    useMemo(() => {
      const items = mergeDuplicateItems(order?.items || []);
      const age = minutesSince(order?.createdAt);

      // Tính % món đã xong
      const totalItems = items.reduce((sum, it) => sum + it.quantity, 0);
      const doneItems = items.reduce(
        (sum, it) =>
          ["ready", "served"].includes(it.status) ? sum + it.quantity : sum,
        0
      );
      const prog = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;

      // Class màu sắc dựa trên thời gian & trạng thái
      let colorClass = "normal";
      if (order?.currentStatus === "cancelled") colorClass = "cancelled";
      else if (order?.currentStatus === "served") colorClass = "completed";
      else if (age >= 20) colorClass = "danger";
      else if (age >= 10) colorClass = "warning";

      return {
        mergedItems: items,
        progress: prog,
        ageMinutes: age,
        statusColorClass: colorClass,
      };
    }, [order]);

  const MAX_ITEMS = isFocusMode ? 20 : 4; // Focus mode hiển thị nhiều hơn
  const visibleItems = mergedItems.slice(0, MAX_ITEMS);
  const remainCount = Math.max(0, mergedItems.length - MAX_ITEMS);
  const customerName =
    order?.customerInfo?.name || order?.user?.fullName || "Khách lẻ";
  const hasNote = !!order?.note;

  // Xử lý action an toàn với Loading state
  const handleAction = async (e, status) => {
    e.stopPropagation();
    if (isActionLoading || !onUpdateStatus) return;

    setIsActionLoading(true);
    try {
      await onUpdateStatus(order.id, status);
    } finally {
      setIsActionLoading(false);
    }
  };

  /* --- RENDER ACTION BUTTONS --- */
  const renderActions = () => {
    const status = order?.currentStatus;
    if (isActionLoading) {
      return (
        <div className="oc-loading-bar">
          <div className="bar"></div>
        </div>
      );
    }

    switch (status) {
      case "pending":
        return (
          <div className="oc-actions-grid">
            <button
              className="oc-btn secondary cancel"
              onClick={(e) => handleAction(e, "cancelled")}
            >
              Hủy
            </button>
            <button
              className="oc-btn primary"
              onClick={(e) => handleAction(e, "preparing")}
            >
              <Check size={16} /> Nhận đơn
            </button>
          </div>
        );
      case "preparing":
        return (
          <button
            className="oc-btn success"
            onClick={(e) => handleAction(e, "ready")}
          >
            <ChefHat size={16} /> Báo xong ({Math.round(progress)}%)
          </button>
        );
      case "ready":
        return (
          <button
            className="oc-btn primary-outline"
            onClick={(e) => handleAction(e, "served")}
          >
            <CheckCircle size={16} /> Đã trả món
          </button>
        );
      case "served":
        return (
          <div className="oc-status-label text-blue">
            <CheckCircle size={14} /> Hoàn tất
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
      onClick={() => onViewOrder?.(order)}
    >
      {/* 1. LEFT STATUS STRIP */}
      <div className="oc-status-strip"></div>

      {/* 2. HEADER */}
      <div className="oc-header">
        <div className="oc-header-left">
          <div
            className={`oc-table-tag ${
              order?.orderType === "takeaway" ? "takeaway" : ""
            }`}
          >
            {order?.orderType === "takeaway"
              ? "Mang về"
              : order?.tableCode || "N/A"}
          </div>
          <span className="oc-id">
            #{String(order?.orderCode || order?.id).slice(-4)}
          </span>
        </div>
        <TimeBadge minutes={ageMinutes} />
      </div>
      <div className="oc-info-section">
        <div className="oc-guest">
          <AlertTriangle size={12} />
          <span className="name">{PRIORITY_LABELS[(order?.priority || "MEDIUM").toUpperCase()] || "Ưu tiên vừa"}</span>
        </div>
      </div>

      {/* 3. INFO & NOTES */}
      <div className="oc-info-section">
        <div className="oc-guest">
          <User size={12} />
          <span className="name">{customerName}</span>
        </div>
        {hasNote && (
          <div className="oc-note-box">
            <StickyNote size={12} />
            <span>{order.note}</span>
          </div>
        )}
      </div>

      {/* 4. PROGRESS BAR (Chỉ hiện khi đang chế biến) */}
      {order?.currentStatus === "preparing" && (
        <div className="oc-progress-track">
          <div
            className="oc-progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {/* 5. ITEM LIST */}
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
                {/* Hiển thị modifiers nếu có */}
                {(item.modifiers?.length > 0 || item.method) && (
                  <div className="item-meta">
                    {item.method && (
                      <span className="method">{item.method}</span>
                    )}
                    {item.modifiers?.map((mod, i) => (
                      <span key={i} className="mod">
                        + {mod.name}
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

      {/* 6. FOOTER */}
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
