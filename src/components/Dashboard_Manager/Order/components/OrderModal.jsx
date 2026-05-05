// src/pages/OrderManagement/components/OrderModal.jsx
import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Loader2,
  Clock,
  CheckCircle2,
  ChefHat,
  MoreVertical,
  Utensils,
  Bike,
  Users,
} from "lucide-react";
import { gql, useMutation } from "@apollo/client";
import "./OrderModal.scss";

/* ---------------- Helpers & Sub-components vẫn giữ nguyên ---------------- */

const formatCurrency = (amount) => {
  const n = Number(amount) || 0;
  return n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
};

const toSafeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const getMinutesElapsed = (dateStr) => {
  const start = toSafeDate(dateStr);
  if (!start) return 0;
  return Math.floor((Date.now() - start.getTime()) / 60000);
};

const ITEM_STATUS_CONFIG = {
  pending: { label: "Chờ xác nhận", color: "yellow", icon: null },
  confirmed: { label: "Đã nhận", color: "blue", icon: null },
  preparing: { label: "Đang làm", color: "indigo", icon: ChefHat },
  ready: { label: "Sẵn sàng", color: "green", icon: CheckCircle2 },
  served: { label: "Đã trả", color: "cyan", icon: CheckCircle2 },
  cancelled: { label: "Đã hủy", color: "red", icon: X },
};

const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      currentStatus
      updatedAt
    }
  }
`;

// ... (Giữ nguyên OrderItemRow component như cũ) ...
const OrderItemRow = React.memo(
  ({ item, index, orderStatus, onStatusChange, isSaving }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const config =
      ITEM_STATUS_CONFIG[item.status] || ITEM_STATUS_CONFIG.pending;
    const StatusIcon = config.icon;
    const disabled =
      ["completed", "cancelled"].includes(orderStatus) ||
      item.status === "cancelled" ||
      item.status === "served";

    const handleSelectStatus = (status) => {
      onStatusChange(item, index, status);
      setMenuOpen(false);
    };

    return (
      <div className={`itemCard ${item.status} ${isSaving ? "saving" : ""}`}>
        <div className="itemCard__info">
          <div className="itemCard__header">
            <span className="qtyBadge">x{item.quantity}</span>
            <span className="itemName">{item.name}</span>
          </div>
          <div className="itemCard__meta">
            {item.modifiersPrice > 0 && (
              <span className="metaTag mod">
                +{formatCurrency(item.modifiersPrice)}
              </span>
            )}
            {item.method && <span className="metaTag">{item.method}</span>}
            {item.unit && <span className="metaTag gray">{item.unit}</span>}
          </div>
          {item.note && (
            <div className="itemCard__note">
              <span>Note:</span> {item.note}
            </div>
          )}
          <div className="itemCard__price">
            {formatCurrency(item._lineTotal)}
          </div>
        </div>
        <div className="itemCard__actions">
          {isSaving ? (
            <Loader2 className="spin text-gold" size={20} />
          ) : (
            <div className="statusDropdown" ref={menuRef}>
              <button
                className={`statusBtn ${config.color}`}
                onClick={() => !disabled && setMenuOpen(!menuOpen)}
                disabled={disabled}
              >
                {StatusIcon && <StatusIcon size={14} />}
                <span>{config.label}</span>
                {!disabled && (
                  <MoreVertical size={14} style={{ opacity: 0.5 }} />
                )}
              </button>
              {menuOpen && (
                <div className="statusMenu">
                  {Object.entries(ITEM_STATUS_CONFIG).map(([key, cfg]) => {
                    if (key === item.status) return null;
                    return (
                      <button
                        key={key}
                        className={`statusMenuItem ${cfg.color}`}
                        onClick={() => handleSelectStatus(key)}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

/* ============================== Main Component ============================== */

const OrderModal = ({ order, onClose, onUpdateItemStatus }) => {
  const [savingMap, setSavingMap] = useState({});
  const completingRef = useRef(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [mutStatusById] = useMutation(UPDATE_ORDER_STATUS);

  const items = useMemo(() => {
    return (order?.items || []).map((it) => ({
      ...it,
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0,
      modifiersPrice: Number(it.modifiersPrice) || 0,
      _lineTotal:
        ((Number(it.price) || 0) + (Number(it.modifiersPrice) || 0)) *
        (Number(it.quantity) || 0),
    }));
  }, [order?.items]);

  const progress = useMemo(() => {
    const validItems = items.filter((i) => i.status !== "cancelled");
    if (!validItems.length) return 0;
    const servedCount = validItems.filter((i) => i.status === "served").length;
    return Math.round((servedCount / validItems.length) * 100);
  }, [items]);

  useEffect(() => {
    setElapsedMinutes(getMinutesElapsed(order?.createdAt));
    const interval = setInterval(() => {
      setElapsedMinutes(getMinutesElapsed(order?.createdAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [order?.createdAt]);

  const handleClose = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    const shouldComplete =
      progress === 100 &&
      order?.id &&
      ["pending", "confirmed", "preparing", "ready"].includes(
        order?.currentStatus
      );
    if (!shouldComplete || completingRef.current) return;
    const performComplete = async () => {
      completingRef.current = true;
      try {
        await mutStatusById({
          variables: { input: { id: order.id, status: "served" } },
        });
      } catch (e) {
        console.error("Auto-complete failed:", e);
      } finally {
        completingRef.current = false;
      }
    };
    performComplete();
  }, [progress, order?.id, order?.currentStatus, mutStatusById]);

  const handleChangeStatus = useCallback(
    async (item, index, nextStatus) => {
      const itemKey = item?._lineId || index;
      setSavingMap((prev) => ({ ...prev, [itemKey]: true }));
      try {
        if (onUpdateItemStatus) {
          await onUpdateItemStatus(order?.id, itemKey, nextStatus);
        }
      } finally {
        setSavingMap((prev) => ({ ...prev, [itemKey]: false }));
      }
    },
    [onUpdateItemStatus, order?.id]
  );

  const handleServeAll = async () => {
    if (!window.confirm("Xác nhận đã trả hết các món còn lại?")) return;
    const pendingItems = items
      .map((it, idx) => ({ ...it, idx }))
      .filter((it) => !["served", "cancelled"].includes(it.status));
    for (const item of pendingItems) {
      await handleChangeStatus(item, item.idx, "served");
    }
  };

  const renderOrderTypeIcon = (type) => {
    switch (type) {
      case "takeaway":
      case "delivery":
        return <Bike size={16} />;
      default:
        return <Users size={16} />;
    }
  };

  const totals = order?.totals || { grandTotal: 0 };

  return createPortal(
    <div className="om-overlay" onClick={handleClose}>
      {/* ⚠️ ĐÃ SỬA TÊN CLASS TẠI ĐÂY TỪ om-container SANG om-modal-box */}
      <div className="om-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="om-header">
          <div className="om-header__left">
            <div className="om-header__title-row">
              <h2 className="title">
                {order?.orderCode || `#${String(order?.id).slice(-4)}`}
              </h2>
              <span className={`status-badge ${order?.currentStatus}`}>
                {ITEM_STATUS_CONFIG[order?.currentStatus]?.label ||
                  order?.currentStatus}
              </span>
            </div>
            <div className="om-header__meta">
              <span className="meta-item">
                <Clock size={14} /> {elapsedMinutes} phút trước
              </span>
              <span className="meta-item">
                {renderOrderTypeIcon(order?.orderType)}{" "}
                {order?.tableCode || "Mang về"}
              </span>
            </div>
          </div>
          <div className="om-header__actions">
            <button
              className="om-btn ghost icon-only"
              onClick={() => onCreateTemporaryBill?.(order)}
              title="In phiếu"
            >
              <Printer size={20} />
            </button>
            <button
              className="om-btn ghost icon-only"
              onClick={handleClose}
              title="Đóng"
            >
              <X size={24} />
            </button>
          </div>
        </header>

        {/* Progress */}
        <div className="om-progress">
          <div className="om-progress__track">
            <div
              className="om-progress__fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="om-progress__text">
            Hoàn thành: <b>{progress}%</b>
          </div>
        </div>

        {/* Body */}
        <div className="om-body custom-scrollbar">
          <section className="om-section info-card">
            <div className="info-row">
              <label>Khách hàng:</label>
              <strong>{order?.user?.fullName || "Khách lẻ"}</strong>
            </div>
            <div className="info-row">
              <label>Thanh toán:</label>
              <strong>
                {order?.payment?.status || "pending"} /{" "}
                {order?.payment?.method || "cash"}
              </strong>
            </div>
            {(order?.shipping?.fullName || order?.shipping?.phone) && (
              <div className="info-row">
                <label>Giao hàng:</label>
                <strong>
                  {order?.shipping?.fullName || "N/A"}{" "}
                  {order?.shipping?.phone
                    ? `(${order.shipping.phone})`
                    : ""}
                </strong>
              </div>
            )}
            {order?.note && (
              <div className="order-note-box">
                <Utensils size={16} />{" "}
                <span className="text">{order.note}</span>
              </div>
            )}
          </section>

          {Array.isArray(order?.statusTimeline) && order.statusTimeline.length > 0 && (
            <section className="om-section">
              <div className="section-header">
                <h3>Timeline trạng thái</h3>
              </div>
              <div className="items-grid">
                {order.statusTimeline.slice().reverse().map((s, idx) => (
                  <div key={`${s.status}-${idx}`} className="itemCard">
                    <div className="itemCard__info">
                      <div className="itemCard__header">
                        <span className="itemName">{s.status}</span>
                      </div>
                      <div className="itemCard__meta">
                        <span className="metaTag">
                          {toSafeDate(s.at)?.toLocaleString("vi-VN") || "—"}
                        </span>
                        {s.byUserId && (
                          <span className="metaTag gray">{s.byUserId}</span>
                        )}
                      </div>
                      {s.note && (
                        <div className="itemCard__note">
                          <span>Note:</span> {s.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="om-section">
            <div className="section-header">
              <h3>Danh sách món ({items.length})</h3>
              {progress < 100 && order?.currentStatus !== "cancelled" && (
                <button className="text-link-btn" onClick={handleServeAll}>
                  Trả hết món
                </button>
              )}
            </div>
            <div className="items-grid">
              {items.map((item, index) => (
                <OrderItemRow
                  key={item._lineId || index}
                  item={item}
                  index={index}
                  orderStatus={order?.currentStatus}
                  isSaving={savingMap[item._lineId || index]}
                  onStatusChange={handleChangeStatus}
                />
              ))}
            </div>
          </section>

          <section className="om-section total-summary">
            <div className="summary-row">
              <span>Tạm tính</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="summary-row discount">
                <span>Giảm giá</span>
                <span>-{formatCurrency(totals.discount)}</span>
              </div>
            )}
            <div className="summary-row grand-total">
              <span>Tổng cộng</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="om-footer">
          <button className="om-btn secondary" onClick={handleClose}>
            Đóng
          </button>
          <button className="om-btn primary" onClick={() => onCreateTemporaryBill?.(order)}>
            <Printer size={18} /> In tạm tính
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default OrderModal;
