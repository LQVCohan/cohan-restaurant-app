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
import { formatDiscountReasonLabel } from "@/utils/discountDisplay";
import { getOrderLineDisplay } from "@/utils/orderLineDisplay";
import OrderTrackingQrCard from "./OrderTrackingQrCard";

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
const ORDER_STATUS_LABELS = {
  draft: "Đơn nháp",
  pending: "Đơn mới tạo",
  confirmed: "POS đã xác nhận",
  customer_attached: "Đã gắn khách hàng",
  preparing: "Bếp đã nhận và đang chuẩn bị",
  ready: "Món đã sẵn sàng",
  served: "Đã trả món",
  completed: "Hoàn tất",
  cancelled: "Đã hủy đơn",
  failed: "Thất bại",
};

const SYSTEM_NOTE_LABELS = {
  "Off-premise order created": "Tạo đơn mang về/giao hàng",
  "Order created": "Tạo đơn",
  "Order confirmed": "Xác nhận đơn",
};

const getTimelineLabel = (event) =>
  SYSTEM_NOTE_LABELS[event?.note] ||
  ORDER_STATUS_LABELS[event?.status] ||
  event?.status ||
  "Cập nhật trạng thái";
const getAllowedNextItemStatuses = (itemStatus, orderStatus) => {
  if (["cancelled", "returned", "served"].includes(itemStatus)) {
    return [];
  }

  if (["cancelled", "completed"].includes(orderStatus)) {
    return [];
  }

  switch (itemStatus) {
    case "pending":
      return ["preparing"];
    case "preparing":
      return ["ready"];
    case "ready":
      return ["served"];
    default:
      return [];
  }
};
const ITEM_STATUS_CONFIG = {
  pending: {
    label: "Chờ bếp nhận",
    color: "yellow",
    icon: null,
  },
  preparing: {
    label: "Đang chuẩn bị",
    color: "indigo",
    icon: ChefHat,
  },
  ready: {
    label: "Sẵn sàng",
    color: "green",
    icon: CheckCircle2,
  },
  served: {
    label: "Đã trả",
    color: "cyan",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Đã hủy",
    color: "red",
    icon: X,
  },
  returned: {
    label: "Đã trả lại",
    color: "gray",
    icon: X,
  },
};
export const ORDER_ITEM_ISSUE_REASON_OPTIONS = [
  { group: "kitchen", label: "Bếp", options: ["Món cháy / khét", "Món sống hoặc chưa chín", "Món nguội", "Món sai vị / không đạt chất lượng", "Bếp làm sai món", "Ra món quá lâu", "Hết món / hết nguyên liệu"] },
  { group: "service", label: "Phục vụ/Order", options: ["Nhân viên nhập sai món", "Order sai món", "Phục vụ nhập sai"] },
  { group: "customer", label: "Khách hàng", options: ["Khách đổi ý", "Khách gọi nhầm", "Khách không dùng nữa"] },
  { group: "bill", label: "Bill/Thanh toán", options: ["Sai bill / sai hóa đơn", "Tách/gộp bill"] },
  { group: "other", label: "Khác", options: ["Khác"] },
];
export function buildReturnReasonFromForm(formState = {}) {
  const preset = String(formState.reasonPreset || "").trim();
  const customReason = String(formState.reason || "").trim();
  if (!preset && !customReason) throw new Error("Vui lòng chọn hoặc nhập lý do trả lại món.");
  if (preset && preset !== "Khác") {
    return customReason && customReason !== preset ? `${preset} - ${customReason}` : preset;
  }
  if (preset === "Khác") {
    if (!customReason) throw new Error("Vui lòng nhập lý do trả lại món.");
    return customReason;
  }
  return customReason;
}

const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      currentStatus
      updatedAt
    }
  }
`;

const OrderItemRow = React.memo(
  ({
    item,
    index,
    order,
    orderStatus,
    onStatusChange,
    isSaving,
    onOpenApproveVoid,
    onOpenRejectVoid,
    onOpenCancelItem,
    onOpenRequestReturn,
    onOpenApproveReturn,
    onOpenRejectReturn,
  }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const targetOrderId = item?.sourceOrderId || order?.actionOrderId || order?.id || order?._id;

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

    const lineDisplay = getOrderLineDisplay(item, { mode: "receipt" });
    const config = ITEM_STATUS_CONFIG[item.status] || ITEM_STATUS_CONFIG.pending;
    const StatusIcon = config.icon;

    const allowedNextStatuses = getAllowedNextItemStatuses(
      item.status,
      orderStatus,
    );

    const disabled =
      ["completed", "cancelled"].includes(orderStatus) ||
      ["cancelled", "returned", "served"].includes(item.status) ||
      allowedNextStatuses.length === 0;
    const pendingVoidRequests = (item.voidRequests || []).filter(
      (r) => r.status === "pending",
    );
    const pendingReturnRequests = (item.returnRequests || []).filter(
      (r) => r.status === "pending",
    );
    const baseline =
      Number(item.originalQuantity || 0) > 0
        ? Number(item.originalQuantity)
        : Number(item.quantity || 0) + Number(item.returnedQuantity || 0);
    const remainingReturnable = Math.max(
      0,
      baseline - Number(item.returnedQuantity || 0),
    );
    const canReviewVoid =
      !["completed", "cancelled"].includes(orderStatus) &&
      !["served", "cancelled", "returned"].includes(item.status);
    const canCancelItem =
      !["completed", "cancelled"].includes(orderStatus) &&
      !["served", "cancelled", "returned"].includes(item.status) &&
      pendingVoidRequests.length === 0 &&
      typeof onOpenCancelItem === "function";

    const handleSelectStatus = (status) => {
      onStatusChange(item, index, status);
      setMenuOpen(false);
    };

    return (
      <div className={`itemCard ${item.status} ${isSaving ? "saving" : ""}`}>
        <div className="itemCard__info">
          <div className="itemCard__header">
            <span className="qtyBadge">
              {Number(item.cancelledQuantity || 0) > 0
                ? `Còn lại: x${item.quantity}`
                : `x${item.quantity}`}
            </span>
            <span className="itemName">{lineDisplay.displayName}</span>
            {lineDisplay.isComboLine && <span className="metaTag combo">Combo</span>}
            {Number(item.cancelledQuantity || 0) > 0 && (
              <span className="metaTag">Đã hủy: x{item.cancelledQuantity}</span>
            )}
          </div>
          {lineDisplay.isComboLine && lineDisplay.childItems.length > 0 && (
            <ul className="itemCard__comboItems" aria-label="Món trong combo">
              {lineDisplay.childItems.map((child) => (
                <li key={child.key}>{child.qty}× {child.name}</li>
              ))}
            </ul>
          )}
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
            {formatCurrency(lineDisplay.totalPrice || item._lineTotal)}
            {lineDisplay.discountAmount > 0 && <small>Tiết kiệm {formatCurrency(lineDisplay.discountAmount)}</small>}
          </div>
          {canCancelItem ? (
            <button
              type="button"
              className="itemCard__cancel"
              onClick={() =>
                onOpenCancelItem({
                  item,
                  index,
                  maxQuantity: Number(item.quantity || 1),
                })
              }
            >
              <X size={15} aria-hidden="true" /> Hủy món ngay
            </button>
          ) : null}
          {pendingVoidRequests.map((req) => (
            <div key={req.requestId} className="itemCard__note">
              <div>Yêu cầu hủy: {req.quantity} món</div>
              <div>Lý do: {req.reason || "-"}</div>
              <div>
                Thời gian:{" "}
                {req.requestedAt
                  ? new Date(req.requestedAt).toLocaleString("vi-VN")
                  : "-"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  disabled={
                    !canReviewVoid ||
                    !onOpenApproveVoid ||
                    req.status !== "pending"
                  }
                  onClick={() => onOpenApproveVoid?.({ item, request: req, index })}
                >
                  Duyệt
                </button>
                <button
                  disabled={
                    !canReviewVoid ||
                    !onOpenRejectVoid ||
                    req.status !== "pending"
                  }
                  onClick={() => onOpenRejectVoid?.({ item, request: req, index })}
                >
                  Từ chối
                </button>
              </div>
            </div>
          ))}
          {Number(item.returnedQuantity || 0) > 0 && (
            <div className="itemCard__note">
              Đã trả lại: x{item.returnedQuantity}
            </div>
          )}
          {item.status === "served" &&
            !["completed", "cancelled"].includes(order?.currentStatus) &&
            pendingReturnRequests.length === 0 &&
            remainingReturnable > 0 && (
              <button
                onClick={() => onOpenRequestReturn?.({ item, index, remainingReturnable })}
              >
                Trả lại món
              </button>
            )}
          {pendingReturnRequests.map((req) => (
            <div key={req.requestId} className="itemCard__note">
              <div>Yêu cầu trả lại: {req.quantity} món</div>
              <div>Lý do: {req.reason}</div>
              <div>Cách xử lý: {req.refundMode}</div>
              <button
                onClick={() => onOpenApproveReturn?.({ item, request: req, index })}
              >
                Duyệt trả lại
              </button>
              <button
                onClick={() => onOpenRejectReturn?.({ item, request: req, index })}
              >
                Từ chối
              </button>
            </div>
          ))}
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
                  {allowedNextStatuses.map((key) => {
                    const cfg = ITEM_STATUS_CONFIG[key];
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
  },
);

const OrderModal = ({
  order,
  onClose,
  onUpdateItemStatus,
  onCreateTemporaryBill,
  onReviewItemVoid,
  onCancelItem,
  onRequestItemReturn,
  onReviewItemReturn,
}) => {
  const [savingMap, setSavingMap] = useState({});
  const completingRef = useRef(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [actionDialog, setActionDialog] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionForm, setActionForm] = useState({
    note: "",
    quantity: 1,
    reason: "",
    reasonPreset: "",
    refundMode: "none",
  });
  const [mutStatusById] = useMutation(UPDATE_ORDER_STATUS);
  const actionOrderId = order?.actionOrderId || order?.id || order?._id;

  const items = useMemo(() => {
    return (order?.items || []).map((it) => {
      const quantity = Number(it.quantity) || 0;
      const modifiersPrice = Number(it.modifiersPrice) || 0;

      const unitPrice = Number(
        it.unitPrice ??
          it.price ??
          it.servingVariant?.price ??
          it.basePrice ??
          0,
      );

      const lineSubtotal =
        it.lineSubtotal != null
          ? Number(it.lineSubtotal)
          : (unitPrice + modifiersPrice) * quantity;

      return {
        ...it,
        quantity,
        price: unitPrice,
        unitPrice,
        modifiersPrice,
        _lineTotal: lineSubtotal,
      };
    });
  }, [order?.items]);

  const progress = useMemo(() => {
    const validItems = items.filter((i) => i.status !== "cancelled");
    if (!validItems.length) return 0;
    const servedCount = validItems.filter((i) => i.status === "served").length;
    return Math.round((servedCount / validItems.length) * 100);
  }, [items]);
  const totals = useMemo(() => {
    const fromOrder = order?.totals || {};

    const fallbackSubtotal = items.reduce(
      (sum, item) => sum + Number(item._lineTotal || 0),
      0,
    );

    const subtotal =
      fromOrder.subtotal != null
        ? Number(fromOrder.subtotal)
        : fallbackSubtotal;

    const discount = Number(fromOrder.discount || 0);
    const tax = Number(fromOrder.tax || 0);
    const service = Number(fromOrder.service || 0);
    const shippingFee = Number(fromOrder.shippingFee || 0);
    const voucherCode = String(fromOrder.voucherCode || "").trim();
    const promotionId = String(fromOrder.promotionId || "").trim();
    const discountReason = formatDiscountReasonLabel(fromOrder.discountReason);

    const grandTotal =
      fromOrder.grandTotal != null
        ? Number(fromOrder.grandTotal)
        : Math.max(0, subtotal - discount + tax + service + shippingFee);

    return {
      subtotal,
      discount,
      tax,
      service,
      shippingFee,
      voucherCode,
      promotionId,
      discountReason,
      grandTotal,
      hasDiscountMeta:
        discount > 0 ||
        Boolean(voucherCode) ||
        Boolean(promotionId) ||
        Boolean(discountReason),
    };
  }, [order?.totals, items]);
  useEffect(() => {
    setElapsedMinutes(getMinutesElapsed(order?.createdAt));
    const interval = setInterval(() => {
      setElapsedMinutes(getMinutesElapsed(order?.createdAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [order?.createdAt]);
  useEffect(() => {
    if (!actionDialog) return;
    if (actionDialog.type === "rejectVoid") {
      setActionForm((prev) => ({ ...prev, note: "Không phù hợp trạng thái xử lý" }));
    } else if (["requestReturn", "cancelItem"].includes(actionDialog.type)) {
      setActionForm({
        note: "",
        quantity: 1,
        reason: "",
        reasonPreset: "",
        refundMode: "none",
      });
    } else {
      setActionForm((prev) => ({ ...prev, note: "" }));
    }
  }, [actionDialog]);

  const handleClose = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    const shouldComplete =
      progress === 100 &&
      actionOrderId &&
      ["pending", "confirmed", "preparing", "ready"].includes(
        order?.currentStatus,
      );
    if (!shouldComplete || completingRef.current) return;
    const performComplete = async () => {
      completingRef.current = true;
      try {
        await mutStatusById({
          variables: { input: { id: actionOrderId, status: "served" } },
        });
      } catch (e) {
        console.error("Auto-complete failed:", e);
      } finally {
        completingRef.current = false;
      }
    };
    performComplete();
  }, [actionOrderId, progress, order?.currentStatus, mutStatusById]);

  const handleChangeStatus = useCallback(
    async (item, index, nextStatus) => {
      const itemKey = item?._lineId || index;
      const targetOrderId = item?.sourceOrderId || actionOrderId;
      setSavingMap((prev) => ({ ...prev, [itemKey]: true }));
      try {
        if (onUpdateItemStatus) {
          await onUpdateItemStatus(targetOrderId, itemKey, nextStatus);
        }
      } finally {
        setSavingMap((prev) => ({ ...prev, [itemKey]: false }));
      }
    },
    [actionOrderId, onUpdateItemStatus],
  );

  const openActionDialog = useCallback((payload) => {
    setActionError("");
    setActionDialog(payload);
  }, []);
  const closeActionDialog = useCallback(() => {
    if (actionSubmitting) return;
    setActionDialog(null);
    setActionError("");
  }, [actionSubmitting]);

  const submitActionDialog = useCallback(
    async (formState = {}) => {
      if (!actionDialog) return;
      const targetOrderId =
        actionDialog?.item?.sourceOrderId || actionOrderId || order?.id;
      setActionSubmitting(true);
      setActionError("");
      try {
        if (actionDialog.type === "approveVoid") {
          if (typeof onReviewItemVoid !== "function") throw new Error("Chức năng này chưa khả dụng trong ngữ cảnh hiện tại.");
          await onReviewItemVoid({ orderId: targetOrderId, orderItemId: actionDialog.item._id, requestId: actionDialog.request.requestId, approve: true, note: "POS duyệt yêu cầu hủy món" });
        } else if (actionDialog.type === "rejectVoid") {
          const note = String(formState.note || "").trim();
          if (!note) throw new Error("Vui lòng nhập lý do từ chối.");
          if (typeof onReviewItemVoid !== "function") throw new Error("Chức năng này chưa khả dụng trong ngữ cảnh hiện tại.");
          await onReviewItemVoid({ orderId: targetOrderId, orderItemId: actionDialog.item._id, requestId: actionDialog.request.requestId, approve: false, note });
        } else if (actionDialog.type === "requestReturn") {
          const quantity = Number(formState.quantity);
          const reason = buildReturnReasonFromForm(formState);
          const refundMode = formState.refundMode;
          const remainingReturnable = Number(actionDialog.remainingReturnable || 0);
          if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Số lượng trả lại phải là số nguyên lớn hơn 0.");
          if (quantity > remainingReturnable) throw new Error("Số lượng trả lại lớn hơn số lượng còn có thể trả.");
          if (!["none", "remove_from_bill", "refund_after_payment"].includes(refundMode)) throw new Error("Chế độ xử lý không hợp lệ.");
          if (typeof onRequestItemReturn !== "function") throw new Error("Chức năng này chưa khả dụng trong ngữ cảnh hiện tại.");
          await onRequestItemReturn({ orderId: targetOrderId, orderItemId: actionDialog.item._id, quantity, reason, refundMode });
        } else if (actionDialog.type === "cancelItem") {
          const quantity = Number(formState.quantity);
          const reason = buildReturnReasonFromForm(formState);
          const maxQuantity = Number(actionDialog.maxQuantity || 0);
          if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error("Số lượng hủy phải là số nguyên lớn hơn 0.");
          }
          if (quantity > maxQuantity) {
            throw new Error("Số lượng hủy lớn hơn số lượng món còn lại.");
          }
          if (typeof onCancelItem !== "function") {
            throw new Error("Chức năng hủy món chưa khả dụng.");
          }
          await onCancelItem({
            orderId: targetOrderId,
            orderItemId: actionDialog.item._id,
            quantity,
            reason,
          });
        } else if (actionDialog.type === "approveReturn") {
          if (typeof onReviewItemReturn !== "function") throw new Error("Chức năng này chưa khả dụng trong ngữ cảnh hiện tại.");
          await onReviewItemReturn({ orderId: targetOrderId, orderItemId: actionDialog.item._id, requestId: actionDialog.request.requestId, approve: true });
        } else if (actionDialog.type === "rejectReturn") {
          const note = String(formState.note || "").trim();
          if (!note) throw new Error("Vui lòng nhập lý do từ chối.");
          if (typeof onReviewItemReturn !== "function") throw new Error("Chức năng này chưa khả dụng trong ngữ cảnh hiện tại.");
          await onReviewItemReturn({ orderId: targetOrderId, orderItemId: actionDialog.item._id, requestId: actionDialog.request.requestId, approve: false, note });
        } else if (actionDialog.type === "serveAll") {
          if (typeof onUpdateItemStatus !== "function") throw new Error("Chức năng này chưa khả dụng trong ngữ cảnh hiện tại.");
          const pendingItems = items.map((it, idx) => ({ ...it, idx })).filter((it) => !["served", "cancelled"].includes(it.status));
          for (const item of pendingItems) await handleChangeStatus(item, item.idx, "served");
        }
        setActionDialog(null);
      } catch (error) {
        setActionError(error?.message || "Không thể thực hiện thao tác.");
      } finally {
        setActionSubmitting(false);
      }
    },
    [actionDialog, actionOrderId, handleChangeStatus, items, onCancelItem, onRequestItemReturn, onReviewItemReturn, onReviewItemVoid, order?.id],
  );

  const handleServeAll = async () => {
    openActionDialog({ type: "serveAll", title: "Xác nhận trả hết món?" });
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

  return createPortal(
    <div className="om-overlay" onClick={handleClose}>
      <div className="om-modal-box" onClick={(e) => e.stopPropagation()}>
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
                  {order?.shipping?.phone ? `(${order.shipping.phone})` : ""}
                  {order?.shipping?.address && (
                    <div className="info-row">
                      <label>Địa chỉ:</label>
                      <strong>{order.shipping.address}</strong>
                    </div>
                  )}
                  {(order?.shipping?.deliveryTime ||
                    order?.shipping?.scheduleDate ||
                    order?.shipping?.scheduleTime) && (
                    <div className="info-row">
                      <label>Thời gian:</label>
                      <strong>
                        {order.shipping.deliveryTime ||
                          [
                            order.shipping.scheduleDate,
                            order.shipping.scheduleTime,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                      </strong>
                    </div>
                  )}
                  {order?.clientMeta?.channel && (
                    <div className="info-row">
                      <label>Kênh nhận:</label>
                      <strong>{order.clientMeta.channel}</strong>
                    </div>
                  )}
                </strong>
              </div>
            )}
            {order?.note && (
              <div className="order-note-box">
                <Utensils size={16} /> <span className="text">{order.note}</span>
              </div>
            )}
          </section>
          <section className="om-section info-card">
            <OrderTrackingQrCard orderId={order?.actionOrderId || order?.id || order?._id} />
          </section>

          {Array.isArray(order?.statusTimeline) &&
            order.statusTimeline.length > 0 && (
              <section className="om-section">
                <div className="section-header">
                  <h3>Timeline trạng thái</h3>
                </div>
                <div className="items-grid">
                  {order.statusTimeline
                    .slice()
                    .reverse()
                    .map((s, idx) => (
                      <div key={`${s.status}-${idx}`} className="itemCard">
                        <div className="itemCard__info">
                          <div className="itemCard__header">
                            <span className="itemName">
                              {getTimelineLabel(s)}
                            </span>
                          </div>
                          <div className="itemCard__meta">
                            <span className="metaTag">
                              {toSafeDate(s.at)?.toLocaleString("vi-VN") || "—"}
                            </span>
                          </div>
                          {s.note && !SYSTEM_NOTE_LABELS[s.note] && (
                            <div className="itemCard__note">
                              <span>Ghi chú:</span> {s.note}
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
                  order={order}
                  orderStatus={order?.currentStatus}
                  isSaving={savingMap[item._lineId || index]}
                  onStatusChange={handleChangeStatus}
                  onOpenApproveVoid={({ item, request, index: itemIndex }) =>
                    openActionDialog({ type: "approveVoid", item, request, itemIndex, title: "Duyệt yêu cầu hủy món?" })
                  }
                  onOpenRejectVoid={({ item, request, index: itemIndex }) =>
                    openActionDialog({ type: "rejectVoid", item, request, itemIndex, title: "Từ chối yêu cầu hủy món?" })
                  }
                  onOpenCancelItem={({ item, index: itemIndex, maxQuantity }) =>
                    openActionDialog({
                      type: "cancelItem",
                      item,
                      itemIndex,
                      maxQuantity,
                      title: "Hủy món ngay",
                    })
                  }
                  onOpenRequestReturn={({ item, index: itemIndex, remainingReturnable }) =>
                    openActionDialog({ type: "requestReturn", item, itemIndex, remainingReturnable, title: "Trả lại món" })
                  }
                  onOpenApproveReturn={({ item, request, index: itemIndex }) =>
                    openActionDialog({ type: "approveReturn", item, request, itemIndex, title: "Duyệt trả lại món?" })
                  }
                  onOpenRejectReturn={({ item, request, index: itemIndex }) =>
                    openActionDialog({ type: "rejectReturn", item, request, itemIndex, title: "Từ chối yêu cầu trả lại?" })
                  }
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

            {totals.shippingFee > 0 && (
              <div className="summary-row">
                <span>Phí giao hàng</span>
                <span>{formatCurrency(totals.shippingFee)}</span>
              </div>
            )}

            {totals.hasDiscountMeta && (
              <div className="discount-meta-card">
                <div className="discount-meta-title">Ưu đãi áp dụng</div>
                <div className="discount-meta-tags">
                  {totals.voucherCode && (
                    <span className="discount-meta-tag">
                      Coupon {totals.voucherCode}
                    </span>
                  )}
                  {totals.promotionId && (
                    <span className="discount-meta-tag">Promotion</span>
                  )}
                  {totals.discountReason && (
                    <span className="discount-meta-tag muted">
                      {totals.discountReason}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="summary-row grand-total">
              <span>Tổng cộng</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </section>
        </div>

        <footer className="om-footer">
          <button className="om-btn secondary" onClick={handleClose}>
            Đóng
          </button>
          <button
            className="om-btn primary"
            onClick={() => onCreateTemporaryBill?.(order)}
          >
            <Printer size={18} /> In tạm tính
          </button>
        </footer>
        {actionDialog && (
          <div className="om-actionDialogOverlay" onClick={closeActionDialog}>
            <div className="om-actionDialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="om-actionDialog__header">{actionDialog.title}</div>
              <div className="om-actionDialog__body">
                {actionDialog.type === "approveVoid" && <p>Duyệt hủy x{actionDialog.request?.quantity} món {actionDialog.item?.name}. Tổng tiền sẽ được cập nhật, kho không được hoàn tự động.</p>}
                {actionDialog.type === "approveReturn" && <p>Duyệt trả lại x{actionDialog.request?.quantity} món {actionDialog.item?.name}. Kho sẽ không được hoàn tự động.</p>}
                {actionDialog.type === "serveAll" && <p>Toàn bộ món còn lại sẽ được chuyển sang trạng thái đã trả.</p>}
                {["rejectVoid", "rejectReturn"].includes(actionDialog.type) && (
                  <label className="om-actionDialog__field">Lý do
                    <textarea value={actionForm.note} onChange={(e) => setActionForm((prev) => ({ ...prev, note: e.target.value }))} />
                  </label>
                )}
                {["requestReturn", "cancelItem"].includes(actionDialog.type) && (
                  <>
                    <label className="om-actionDialog__field">Số lượng
                      <input type="number" min={1} max={actionDialog.remainingReturnable || actionDialog.maxQuantity || 1} value={actionForm.quantity} onChange={(e) => setActionForm((prev) => ({ ...prev, quantity: e.target.value }))} />
                    </label>
                    <div className="om-actionDialog__reasonGroup">
                      <label className="om-actionDialog__field">Lý do chính
                        <select
                          className="om-actionDialog__select"
                          value={actionForm.reasonPreset || ""}
                          onChange={(e) => {
                            const nextPreset = e.target.value;
                            setActionForm((prev) => {
                              const prevPreset = String(prev.reasonPreset || "");
                              const prevReason = String(prev.reason || "");
                              const shouldAutoFill = !prevReason.trim() || prevReason.trim() === prevPreset;
                              return {
                                ...prev,
                                reasonPreset: nextPreset,
                                reason: nextPreset !== "Khác" && shouldAutoFill ? nextPreset : prev.reason,
                              };
                            });
                          }}
                        >
                          <option value="">-- Chọn lý do --</option>
                          {ORDER_ITEM_ISSUE_REASON_OPTIONS.map((group) => (
                            <optgroup key={group.group} label={group.label}>
                              {group.options.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <label className="om-actionDialog__field">
                        {actionForm.reasonPreset === "Khác" ? "Lý do khác" : "Ghi chú thêm"}
                        <textarea
                          value={actionForm.reason}
                          placeholder={
                            actionForm.reasonPreset === "Khác"
                              ? `Nhập lý do ${actionDialog.type === "cancelItem" ? "hủy" : "trả lại"} món…`
                              : "Có thể bổ sung chi tiết, ví dụ bàn/số lượng/tình trạng món..."
                          }
                          onChange={(e) => setActionForm((prev) => ({ ...prev, reason: e.target.value }))}
                        />
                      </label>
                      {actionForm.reasonPreset !== "Khác" ? (
                        <p className="om-actionDialog__hint">Chọn lý do chuẩn giúp hệ thống phân loại lỗi bếp/khách/order/bill chính xác hơn.</p>
                      ) : null}
                    </div>
                    {actionDialog.type === "requestReturn" ? (
                      <label className="om-actionDialog__field">Cách xử lý
                        <select value={actionForm.refundMode} onChange={(e) => setActionForm((prev) => ({ ...prev, refundMode: e.target.value }))}>
                          <option value="none">Chỉ ghi nhận trả lại</option>
                          <option value="remove_from_bill">Trừ khỏi hóa đơn</option>
                          <option value="refund_after_payment">Hoàn tiền sau thanh toán</option>
                        </select>
                      </label>
                    ) : (
                      <p className="om-actionDialog__hint">
                        Món sẽ được hủy ngay, tổng hóa đơn được tính lại và lý do được lưu vào lịch sử xử lý.
                      </p>
                    )}
                  </>
                )}
                {actionError && <div className="om-actionDialog__error">{actionError}</div>}
              </div>
              <div className="om-actionDialog__actions">
                <button className="om-actionDialog__button om-actionDialog__button--secondary" onClick={closeActionDialog} disabled={actionSubmitting}>Hủy</button>
                <button className={`om-actionDialog__button ${["approveVoid", "approveReturn", "serveAll", "cancelItem"].includes(actionDialog.type) ? "om-actionDialog__button--danger" : "om-actionDialog__button--primary"}`} onClick={() => submitActionDialog(actionForm)} disabled={actionSubmitting}>
                  {actionSubmitting ? "Đang xử lý..." : "Xác nhận"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default OrderModal;
