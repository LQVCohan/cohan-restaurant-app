import React, { useCallback, useMemo, useState } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import "./OrderModal.scss";

// Giữ nguyên
const formatCurrency = (amount) => {
  if (typeof amount !== "number") amount = 0;
  return amount.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
};

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "cancelled",
];
const ITEM_STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  cancelled: "Đã hủy",
};

/**
 * Props:
 * - order: Order { orderCode, restaurantId, items, ... }
 * - onClose: () => void
 * - onChangeItemStatusByCode?: ({ restaurantId, orderCode, itemKey, status, note? }) => Promise
 * - onUpdateItemStatus?: (payload | legacy) => Promise
 *   + mới: onUpdateItemStatus({ restaurantId, orderCode, itemKey, status })
 *   + cũ:  onUpdateItemStatus(orderId, itemKey, status)
 */
const OrderModal = ({
  order,
  onClose,
  onChangeItemStatusByCode,
  onUpdateItemStatus,
}) => {
  const [savingMap, setSavingMap] = useState({}); // key theo lineId/index -> boolean

  // --- Lấy dữ liệu từ GQL Order Object ---
  const orderId = order?.id?.slice(-6) || "N/A";
  const orderCode = order?.orderCode || null;
  const restaurantId = order?.restaurantId || order?.restaurant?.id || null;

  const customerName = order?.user?.fullName || "Khách lẻ";
  const tableNumber = order?.tableCode || "N/A";
  const orderTime = new Date(order?.createdAt || Date.now());
  const orderStatus = order?.currentStatus || "pending";
  const items = order?.items || [];
  const totals = order?.totals || { grandTotal: 0 };
  const orderNotes = order?.note || "";

  const getItemStatusText = (status) => ITEM_STATUS_LABEL[status] || status;

  const getStatusClass = (status) => {
    // map class cho badge (giữ tính mở rộng)
    const map = {
      pending: "pending",
      confirmed: "confirmed",
      preparing: "preparing",
      ready: "ready",
      served: "served",
      completed: "served", // fallback
      cancelled: "cancelled",
    };
    return map[status] || "pending";
  };

  const getStatusBadge = (status) => (
    <span className={`statusBadge ${getStatusClass(status)}`}>
      {getItemStatusText(status)}
    </span>
  );

  // Progress tổng thể: tính dựa trên item “cao nhất” chưa hủy
  const progress = useMemo(() => {
    const alive = items.filter((i) => i.status !== "cancelled");
    if (!alive.length) return 0;
    const idxMax = Math.max(
      ...alive.map((i) => STATUS_ORDER.indexOf(i.status))
    );
    return Math.max(0, Math.round(((idxMax + 1) / STATUS_ORDER.length) * 100));
  }, [items]);

  // Close khi nhấn ESC
  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  // ✅ Đổi status món: ưu tiên API mới theo orderCode; fallback API cũ
  const handleChangeStatus = useCallback(
    async (item, index, nextStatus) => {
      const itemKey = item._lineId || item.dishId || index;

      // Optimistic: bật spinner cho item này
      setSavingMap((m) => ({ ...m, [itemKey]: true }));

      try {
        // Ưu tiên hàm mới theo orderCode + restaurantId
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
          // Thử chữ ký mới (payload object)
          try {
            const maybeNew = onUpdateItemStatus({
              restaurantId,
              orderCode,
              itemKey,
              status: nextStatus,
            });
            if (maybeNew?.then) await maybeNew;
          } catch {
            // Cuối cùng: chữ ký legacy (orderId, itemKey, status)
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
        // (rollback sẽ do cha xử lý bằng state nguồn; ở đây chỉ log)
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
            <h2 className="modalTitle">Chi tiết đơn hàng</h2>
            <div className="subtleMeta">
              <span>#{orderId}</span>
              <span className="dot">•</span>
              <span>
                {orderTime.toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                })}
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
                <span className="value">{tableNumber}</span>
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
                          {formatCurrency(
                            (item.price + (item.modifiersPrice || 0)) *
                              item.quantity
                          )}
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

          {/* Total */}
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

          {/* Actions (dự phòng ở footer) */}
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
