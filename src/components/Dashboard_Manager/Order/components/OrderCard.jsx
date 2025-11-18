import React, { useMemo } from "react";
import { Clock, User, ChefHat, CheckCircle, Eye, Check, X } from "lucide-react";
import "./OrderCard.scss";

/* =======================================================
   1. Gộp món trùng (cộng dồn số lượng) – dùng cho normal mode
   ======================================================= */
const mergeDuplicateItems = (items = []) => {
  const merged = new Map();
  for (const it of items) {
    const key = `${it.dishId || it.name}_${it.method || ""}_${it.unit || ""}`;
    if (!merged.has(key)) merged.set(key, { ...it });
    else {
      const prev = merged.get(key);
      prev.quantity = Number(prev.quantity || 0) + Number(it.quantity || 0);
      prev.lineSubtotal =
        (Number(prev.price || 0) + Number(prev.modifiersPrice || 0)) *
        prev.quantity;
      merged.set(key, prev);
    }
  }
  return [...merged.values()];
};

/* =======================================================
   2. Helpers
   ======================================================= */
const formatCurrency = (v) =>
  (Number(v) || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  });

const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && "$date" in v) return parseDate(v.$date);
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000);
  if (typeof v === "string" && /^\d+$/.test(v.trim()))
    return new Date(Number(v) > 1e12 ? Number(v) : Number(v) * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const minutesSince = (createdAt) => {
  const dt = parseDate(createdAt);
  if (!dt) return null;
  return Math.floor((Date.now() - dt.getTime()) / 60000);
};

// default thresholds nếu không truyền gì từ ngoài
const DEFAULT_THRESHOLDS = {
  warn: 10,
  danger: 20,
  critical: 30,
};

// default colors nếu setting không truyền
const DEFAULT_TIME_COLORS = {
  ok: "#16a34a", // xanh lá
  warn: "#eab308", // vàng
  danger: "#f97316", // cam/đỏ nhạt
  critical: "#b91c1c", // đỏ đậm
};

/* =======================================================
   3. Thành phần hiển thị cho NORMAL MODE
   ======================================================= */
const TimeWarningBadge = ({ createdAt, thresholds, colors }) => {
  const m = minutesSince(createdAt);
  if (m == null) return null;

  const { warn, danger, critical } = thresholds;
  const palette = { ...DEFAULT_TIME_COLORS, ...(colors || {}) };

  // style chung – chỉ override background để vẫn giữ style pill trong SCSS
  let style = {};

  if (m >= critical) {
    // 🔴🔴 Khẩn cấp: đỏ đậm + icon rõ ràng
    style = { backgroundColor: palette.critical };
    return (
      <span className="timeWarning critical" style={style}>
        🚨 {m} phút
      </span>
    );
  }

  if (m >= danger) {
    // 🔴 Nguy hiểm
    style = { backgroundColor: palette.danger };
    return (
      <span className="timeWarning danger" style={style}>
        {m} phút
      </span>
    );
  }

  if (m >= warn) {
    // 🟡 Cảnh báo
    style = { backgroundColor: palette.warn };
    return (
      <span className="timeWarning warning" style={style}>
        {m} phút
      </span>
    );
  }

  // 🟢 Mặc định: xanh lá
  style = { backgroundColor: palette.ok };
  return (
    <span className="orderTime ok" style={style}>
      {m} phút
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const labelMap = {
    pending: "Chờ xác nhận",
    preparing: "Đang chuẩn bị",
    ready: "Sẵn sàng",
    served: "Đã phục vụ",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  const key = status || "pending";
  return <span className={`statusBadge ${key}`}>{labelMap[key]}</span>;
};

const getOrderTypeIcon = (type) =>
  type === "takeaway" ? "🛍️" : type === "delivery" ? "🏍️" : "🪑";
const getCustomerDisplay = (order) => {
  const user = order?.user || {};
  const customer = order?.customerInfo || {};

  const name = customer.name || user.fullName || "Khách lẻ";

  const phone = customer.phone || user.phone || "";
  const email = customer.email || user.email || "";

  const contact = phone || email || "";

  return { name, contact };
};
/* =======================================================
   4. Main Component
   ======================================================= */
const OrderCard = ({
  order,
  onUpdateStatus,
  onViewOrder,
  onViewItem,
  isFocusMode = false,
  onQuickItemDone, // dùng cho nút Xong trong focus mode
  timeThresholds = DEFAULT_THRESHOLDS, // ✅ nhận config ngưỡng thời gian từ ngoài
  timeColors = {}, // ✅ nhận config màu từ setting
}) => {
  // chuẩn hoá thresholds (fallback sang default nếu thiếu)
  const thresholds = {
    warn:
      Number(timeThresholds.warn ?? DEFAULT_THRESHOLDS.warn) ||
      DEFAULT_THRESHOLDS.warn,
    danger:
      Number(timeThresholds.danger ?? DEFAULT_THRESHOLDS.danger) ||
      DEFAULT_THRESHOLDS.danger,
    critical:
      Number(timeThresholds.critical ?? DEFAULT_THRESHOLDS.critical) ||
      DEFAULT_THRESHOLDS.critical,
  };

  const ageMinutes = minutesSince(order?.createdAt);
  let timeClass = "";
  if (ageMinutes != null) {
    const { warn, danger, critical } = thresholds;
    if (ageMinutes >= critical) timeClass = "time-high";
    else if (ageMinutes >= danger) timeClass = "time-mid";
    else if (ageMinutes >= warn) timeClass = "time-warn";
    else timeClass = "time-ok";
  }

  // normal mode: gộp món
  const mergedItems = useMemo(
    () => mergeDuplicateItems(order?.items || []),
    [order?.items]
  );

  const totalItems = mergedItems.length;
  const pendingCount = mergedItems.filter(
    (it) => it.status === "pending"
  ).length;

  const callUpdateStatus = (status) => {
    if (typeof onUpdateStatus !== "function") return;
    // GIỮ NGUYÊN API CŨ: (orderId, status)
    onUpdateStatus(order.id, status);
  };

  /* ----------------- Action buttons (normal mode) ----------------- */
  const renderActionButtons = () => {
    if (isFocusMode) return null;

    const s = order?.currentStatus;
    switch (s) {
      case "pending":
        return (
          <>
            <button
              className="confirmButton"
              onClick={() => callUpdateStatus("preparing")}
            >
              <Check size={14} /> Bắt đầu
            </button>
            <button
              className="cancelButton"
              onClick={() => callUpdateStatus("cancelled")}
            >
              <X size={14} /> Hủy
            </button>
          </>
        );
      case "preparing":
        return (
          <button
            className="readyButton"
            onClick={() => callUpdateStatus("ready")}
          >
            <ChefHat size={14} /> Hoàn tất chế biến
          </button>
        );
      case "ready":
        return (
          <button
            className="confirmButton"
            onClick={() => callUpdateStatus("served")}
          >
            <CheckCircle size={14} /> Hoàn thành
          </button>
        );
      default:
        return null;
    }
  };

  /* ----------------- Items ----------------- */
  const baseItems = isFocusMode ? order?.items || [] : mergedItems;

  // Normal mode: cố định 3 dòng món + 1 dòng "còn X món"
  let visibleItems = baseItems;
  let extraCount = 0;
  let placeholderCount = 0;

  if (!isFocusMode) {
    const MAX = 3;
    visibleItems = baseItems.slice(0, MAX);
    extraCount = Math.max(0, baseItems.length - MAX);
    placeholderCount = Math.max(0, MAX - visibleItems.length);
  }

  const handleQuickDone = (e, item, idx) => {
    e.stopPropagation(); // không mở modal món
    if (typeof onQuickItemDone !== "function") return;
    const itemKey = item._lineId || item.dishId || item.id || idx;
    onQuickItemDone(order.id, itemKey, "ready");
  };

  /* ----------------- RENDER ----------------- */
  return (
    <div
      className={[
        "orderCard",
        order?.currentStatus || "",
        isFocusMode ? "focus" : "",
        isFocusMode && timeClass ? timeClass : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header */}
      <div className="orderHeader">
        <div>
          <div className="orderTitle">
            {isFocusMode ? (
              <span className="orderTableOnly">{order?.tableCode || "—"}</span>
            ) : (
              <>
                {getOrderTypeIcon(order?.orderType)}{" "}
                {order?.tableCode || "Mang về"}{" "}
                <span className="orderId">
                  #{String(order?.id || "").slice(-6)}
                </span>
              </>
            )}
          </div>

          {!isFocusMode &&
            (() => {
              const { name, contact } = getCustomerDisplay(order);
              return (
                <div className="orderUser">
                  <User size={14} />
                  <span className="orderUser__name">{name}</span>
                  {contact && (
                    <span className="orderUser__contact">· {contact}</span>
                  )}
                </div>
              );
            })()}
        </div>

        {!isFocusMode ? (
          <TimeWarningBadge
            createdAt={order?.createdAt}
            thresholds={thresholds}
            colors={timeColors}
          />
        ) : ageMinutes != null ? (
          <span className="orderTimeMini">{ageMinutes} phút</span>
        ) : null}
      </div>

      {/* Status (normal mode) */}
      {!isFocusMode && (
        <div className="totalSection mb-2">
          <div className="totalLabel">
            {totalItems} món ({pendingCount} chờ)
          </div>
          <StatusBadge status={order?.currentStatus} />
        </div>
      )}

      {/* Items */}
      <div className={`itemsSection ${isFocusMode ? "focus" : ""}`}>
        {!isFocusMode && (
          <div className="sectionTitle">
            <Clock size={16} />
            <span>Món</span>
          </div>
        )}

        <div className="itemsList">
          {visibleItems.map((item, idx) => {
            const key = item._lineId || item.dishId || idx;
            const isDone = ["ready", "served", "cancelled"].includes(
              item.status
            );

            return (
              <div
                key={key}
                className={`itemCard ${isFocusMode ? "focus" : ""}`}
                onClick={() =>
                  !isFocusMode &&
                  onViewItem?.({
                    item,
                    orderInfo: { id: order.id, table: order.tableCode },
                  })
                }
              >
                <div className="itemInfo">
                  <div className="itemName">
                    <span className="quantity">{item.quantity}x</span>
                    <span>{item.name}</span>
                    {item.method && (
                      <span className="itemMethod"> ({item.method})</span>
                    )}
                  </div>
                  {!isFocusMode && (
                    <div className="itemStatus">{item.status}</div>
                  )}
                </div>

                {/* Nút Xong luôn hiện trong focus mode */}
                {isFocusMode && (
                  <button
                    type="button"
                    className="itemDoneBtn"
                    disabled={isDone}
                    onClick={(e) => !isDone && handleQuickDone(e, item, idx)}
                  >
                    Xong
                  </button>
                )}
              </div>
            );
          })}

          {/* slot rỗng để đủ 3 dòng món */}
          {!isFocusMode &&
            Array.from({ length: placeholderCount }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className="itemCard itemCard--placeholder"
                aria-hidden="true"
              />
            ))}

          {/* dòng "còn X món" (hoặc placeholder) */}
          {!isFocusMode &&
            (extraCount > 0 ? (
              <div className="itemMore">... còn {extraCount} món</div>
            ) : (
              <div
                className="itemMore itemMore--placeholder"
                aria-hidden="true"
              >
                &nbsp;
              </div>
            ))}
        </div>
      </div>

      {/* Tổng tiền & actions: chỉ ở normal mode */}
      {!isFocusMode && (
        <>
          <div className="totalSection">
            <div className="totalLabel">Tổng cộng</div>
            <div className="totalAmount">
              {formatCurrency(order?.totals?.grandTotal)}
            </div>
          </div>

          <div className="actions">
            {renderActionButtons()}
            <button className="viewButton" onClick={() => onViewOrder?.(order)}>
              <Eye size={14} /> Xem chi tiết
            </button>
          </div>
        </>
      )}

      {/* Focus mode: chỉ còn nút xem chi tiết nhỏ */}
      {isFocusMode && (
        <div className="actions focusActions">
          <button
            className="viewButton slim"
            onClick={() => onViewOrder?.(order)}
          >
            <Eye size={14} /> Xem chi tiết
          </button>
        </div>
      )}
    </div>
  );
};

export default OrderCard;
