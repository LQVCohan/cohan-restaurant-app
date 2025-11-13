// src/pages/OrderManagement/components/OrderModal.jsx
import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { gql, useMutation } from "@apollo/client";
import "./OrderModal.scss";

/* ---------------- Helpers: tiền tệ & thời gian (an toàn) ---------------- */

const formatCurrency = (amount) => {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
};

/** Parse nhiều dạng timestamp: number, "1762805854781", seconds(10), {$date: ...}, Date */
const toEpochMs = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "object" && "$date" in v) return toEpochMs(v.$date);
  if (typeof v === "number" && Number.isFinite(v)) {
    return v < 1e12 ? v * 1000 : v; // giây -> ms
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return n < 1e12 ? n * 1000 : n;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
};

const toSafeDate = (v) => {
  const ms = toEpochMs(v);
  return ms ? new Date(ms) : null;
};

/* ---------------- Status mapping ---------------- */

const ITEM_STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  cancelled: "Đã hủy",
  completed: "Hoàn thành",
};
const getItemStatusText = (status) => ITEM_STATUS_LABEL[status] || status;

// orderType → VI
const toViOrderType = (type) => {
  switch (type) {
    case "dine_in":
      return "Tại bàn";
    case "takeaway":
      return "Mang về";
    case "delivery":
      return "Giao hàng";
    default:
      return type || "Tại bàn";
  }
};

/* ---------------- Mutations tự dùng trong modal (không sửa hook) ---------------- */

const UPDATE_ORDER_STATUS_BY_CODE = gql`
  mutation UpdateOrderStatusByCode($input: UpdateOrderStatusByCodeInput!) {
    updateOrderStatusByCode(input: $input) {
      order {
        id
        currentStatus
        updatedAt
      }
    }
  }
`;
const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      currentStatus
    }
  }
`;

/* ============================== Component ============================== */

const OrderModal = ({
  order,
  onClose,
  onChangeItemStatusByCode,
  onUpdateItemStatus,
}) => {
  const [savingMap, setSavingMap] = useState({}); // key theo lineId/index -> boolean
  const completingRef = useRef(false); // chống gọi hoàn tất nhiều lần

  // Apollo mutations để tự hoàn tất đơn khi 100%
  const [mutStatusByCode] = useMutation(UPDATE_ORDER_STATUS_BY_CODE);
  const [mutStatusById] = useMutation(UPDATE_ORDER_STATUS);

  /* ---------------- Normalize order fields (KHÔNG sửa hook) ---------------- */

  const orderIdShort = useMemo(
    () => String(order?.id || "").slice(-6) || "N/A",
    [order?.id]
  );

  const orderCode = order?.orderCode || null;
  const restaurantId = order?.restaurantId || order?.restaurant?.id || null;

  const customerName = order?.user?.fullName || "Khách lẻ";
  const tableNumber = order?.tableCode || "N/A";
  const orderStatus = order?.currentStatus || "pending";
  const orderNotes = order?.note || "";
  const orderTypeVi = toViOrderType(order?.orderType);

  // Thời gian hiển thị an toàn
  const createdAtDate = useMemo(
    () => toSafeDate(order?.createdAt),
    [order?.createdAt]
  );

  // Totals an toàn
  const totals = useMemo(() => {
    const t = order?.totals || {};
    return {
      subtotal: Number(t.subtotal || 0),
      discount: Number(t.discount || 0),
      tax: Number(t.tax || 0),
      service: Number(t.service || 0),
      grandTotal: Number(t.grandTotal || 0),
    };
  }, [order?.totals]);

  // Items an toàn (ép số, fallback status)
  const items = useMemo(() => {
    const raw = Array.isArray(order?.items) ? order.items : [];
    return raw.map((it, idx) => {
      const price = Number(it?.price || 0);
      const mod = Number(it?.modifiersPrice || 0);
      const qty = Number(it?.quantity || 0);
      const per =
        (Number.isFinite(price) ? price : 0) + (Number.isFinite(mod) ? mod : 0);
      const lineTotal = per * (Number.isFinite(qty) ? qty : 0);
      return {
        ...it,
        price: Number.isFinite(price) ? price : 0,
        modifiersPrice: Number.isFinite(mod) ? mod : 0,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 0,
        status: it?.status || "pending",
        _lineTotal: lineTotal,
      };
    });
  }, [order?.items]);

  /* ---------------- Progress tổng thể ----------------
     - Loại món bị hủy ra khỏi mẫu số
     - % = served / alive * 100
     - Nếu order.currentStatus là 'served' hoặc 'completed' => 100
  ------------------------------------------------------------------ */
  const progress = useMemo(() => {
    if (orderStatus === "served" || orderStatus === "completed") return 100;

    const alive = items.filter((i) => i.status !== "cancelled");
    if (!alive.length) return 0;

    const servedCount = alive.filter((i) => i.status === "served").length;
    const pct = Math.round((servedCount / alive.length) * 100);
    return Math.max(0, Math.min(100, pct));
  }, [items, orderStatus]);

  /* ---------------- Khi đạt 100% -> tự động chuyển order -> completed ---------------- */
  useEffect(() => {
    const shouldComplete =
      progress === 100 && order?.currentStatus !== "completed";
    if (!shouldComplete || completingRef.current) return;

    completingRef.current = true;

    const complete = async () => {
      try {
        if (restaurantId && orderCode) {
          await mutStatusById({
            variables: { input: { id: order.id, status: "served" } },
          });
        } else if (order?.id) {
          await mutStatusByCode({
            variables: {
              input: { restaurantId, orderCode, status: "served" },
            },
          });
        }
      } catch (e) {
        // không chặn UI, chỉ log
        console.warn("Auto-complete order failed:", e?.message);
      } finally {
        // Chờ parent cập nhật lại order; nếu không, tránh spam bằng cờ này
        setTimeout(() => {
          completingRef.current = false;
        }, 1200);
      }
    };

    complete();
  }, [
    progress,
    order?.id,
    orderCode,
    restaurantId,
    mutStatusByCode,
    mutStatusById,
    order?.currentStatus,
  ]);

  /* ---------------- Hotkeys: ESC đóng ---------------- */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const getStatusClass = (status) => {
    const map = {
      pending: "pending",
      confirmed: "confirmed",
      preparing: "preparing",
      ready: "ready",
      served: "served",
      completed: "served",
      cancelled: "cancelled",
    };
    return map[status] || "pending";
  };

  const getStatusBadge = (status) => (
    <span className={`statusBadge ${getStatusClass(status)}`}>
      {getItemStatusText(status)}
    </span>
  );

  const handlePrint = () => window.print();

  /* ---------------- Đổi trạng thái món (giữ API cũ của bạn) ---------------- */
  const handleChangeStatus = useCallback(
    async (item, index, nextStatus) => {
      // dùng lại itemKey cũ: _lineId || dishId || index
      const itemKey = item?._lineId || item?.dishId || index;

      setSavingMap((m) => ({ ...m, [itemKey]: true }));
      try {
        // Ưu tiên API mới theo orderCode + restaurantId
        if (
          typeof onChangeItemStatusByCode === "function" &&
          restaurantId &&
          orderCode
        ) {
          const maybe = onChangeItemStatusByCode({
            restaurantId,
            orderCode,
            itemKey,
            status: nextStatus,
          });
          if (maybe?.then) await maybe;
        }
        // Fallback: hàm cũ nhưng hỗ trợ payload mới
        else if (typeof onUpdateItemStatus === "function") {
          try {
            const maybeNew = onUpdateItemStatus({
              restaurantId,
              orderCode,
              itemKey,
              status: nextStatus,
            });
            if (maybeNew?.then) await maybeNew;
          } catch {
            // Legacy (orderId, itemKey, status)
            const maybeLegacy = onUpdateItemStatus(
              order?.id,
              itemKey,
              nextStatus
            );
            if (maybeLegacy?.then) await maybeLegacy;
          }
        } else {
          console.warn("No handler provided for item status change.");
        }
      } catch (err) {
        console.error("Update item status error:", err);
      } finally {
        setSavingMap((m) => ({ ...m, [itemKey]: false }));
      }
    },
    [
      onChangeItemStatusByCode,
      onUpdateItemStatus,
      restaurantId,
      orderCode,
      order?.id,
    ]
  );

  /* -------------------------------- Render -------------------------------- */

  return (
    <div
      className="modalOverlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-order" onClick={(e) => e.stopPropagation()}>
        {/* Header sticky */}
        <div className="modalHeader">
          <div className="modalHeader__left">
            <h2 className="modalTitle">
              Chi tiết đơn hàng {orderCode ? `• ${orderCode}` : ""}
            </h2>
            <div className="subtleMeta">
              <span>#{orderIdShort}</span>
              <span className="dot">•</span>
              <span>
                {createdAtDate
                  ? createdAtDate.toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })
                  : "—"}
              </span>
            </div>
          </div>
          <div className="modalHeader__actions">
            <button
              onClick={handlePrint}
              className="iconButton"
              aria-label="In đơn hàng"
            >
              <Printer size={18} />
              <span>In</span>
            </button>
            <button
              onClick={onClose}
              className="iconButton ghost"
              aria-label="Đóng"
            >
              <X size={18} />
              <span>Đóng</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="orderProgress">
          <div
            className="orderProgress__bar"
            style={{ width: `${progress}%` }}
          />
          <div className="orderProgress__label">
            Tiến độ đơn: <strong>{progress}%</strong>
          </div>
        </div>

        {/* Content */}
        <div className="modalContent">
          {/* Order Info */}
          <div className="section">
            <div className="infoGrid">
              <div className="infoItem">
                <span className="label">Khách hàng:</span>
                <span className="value">{customerName}</span>
              </div>
              <div className="infoItem">
                <span className="label">Bàn/Loại:</span>
                <span className="value">
                  {tableNumber}
                  {orderTypeVi ? ` • ${orderTypeVi}` : ""}
                </span>
              </div>
              <div className="infoItem">
                <span className="label">Trạng thái đơn:</span>
                {getStatusBadge(orderStatus)}
              </div>
              <div className="infoItem">
                <span className="label">Số món:</span>
                <span className="value">{items.length}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="section">
            <h3 className="sectionTitle">Chi tiết món</h3>
            <div className="itemsList">
              {items.map((item, index) => {
                const key = item._lineId || item.dishId || index;
                const isSaving = !!savingMap[key];

                const disabledAll =
                  orderStatus === "completed" ||
                  orderStatus === "cancelled" ||
                  item.status === "cancelled";

                return (
                  <div
                    key={key}
                    className={`itemCard ${isSaving ? "saving" : ""}`}
                  >
                    <div className="itemInfo">
                      <div className="itemName">{item.name}</div>
                      <div className="itemDetails">
                        {getItemStatusText(item.status)} • Đơn giá:{" "}
                        {formatCurrency(item.price)}
                        {Number(item.modifiersPrice) > 0
                          ? ` (+${formatCurrency(item.modifiersPrice)})`
                          : ""}
                        {item.method ? ` • CĐB: ${item.method}` : ""}
                        {item.unit ? ` • ĐV: ${item.unit}` : ""}
                      </div>
                      {item.note && (
                        <div className="itemNote">
                          <span>Ghi chú:</span> {item.note}
                        </div>
                      )}
                    </div>

                    <div className="itemMeta">
                      <div className="itemPricing">
                        <div className="quantity">x{item.quantity}</div>
                        <div className="itemTotal">
                          {formatCurrency(item._lineTotal)}
                        </div>
                      </div>

                      <div className="itemControl">
                        <select
                          value={item.status || "pending"}
                          onChange={(e) =>
                            handleChangeStatus(item, index, e.target.value)
                          }
                          className="statusSelect"
                          disabled={disabledAll || isSaving}
                          aria-label={`Trạng thái của ${item.name}`}
                        >
                          {/* Không có 'confirmed' để khớp VALID_ITEM_STATUS của hook */}
                          <option value="pending">Chờ xác nhận</option>
                          <option value="preparing">Đang chuẩn bị</option>
                          <option value="ready">Sẵn sàng</option>
                          <option value="served">Đã phục vụ</option>
                          <option value="cancelled">Hủy món</option>
                        </select>
                        {isSaving && (
                          <span
                            className="savingSpin"
                            aria-live="polite"
                            title="Đang lưu"
                          >
                            <Loader2 className="spin" size={16} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="section">
            <div className="totalSection">
              <span className="totalLabel">Tổng cộng</span>
              <span className="totalAmount">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>
          </div>

          {/* Notes */}
          {orderNotes && (
            <div className="section">
              <h4 className="notesTitle">Ghi chú (Tổng đơn)</h4>
              <p className="notesContent">{orderNotes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="actions">
            <button onClick={onClose} className="cancelButton">
              Đóng
            </button>
            <button onClick={handlePrint} className="printButton">
              <Printer size={16} />
              In đơn hàng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderModal;
