import React, { useMemo, useState, useContext, useCallback } from "react";
import Modal from "@/components/common/Modal";
import { Link, useNavigate } from "react-router-dom";
import "./OrdersPage.scss";
import OrderItem from "./OrderItem"; // Import OrderItem mới
import Toast from "../../ui/Toast";
import Skeleton from "../../ui/Skeleton";

import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { AuthContext } from "../../../context/AuthContext";

// Modals
import CancelOrderModal from "./modals/CancelOrderModal";
import ChangeTimeModal from "./modals/ChangeTimeModal";
import QRPaymentModal from "../QRPaymentModal/QRPaymentModal";
import ChangeTableModal from "./modals/ChangeTableModal";
import {
  getOrderActionErrorMessage,
  getReservationActionErrorMessage,
} from "@/utils/commerceActionErrorMessages";
import ConfirmationModal from "../../Customer/TableBooking/ConfirmationModal/ConfirmationModal";
import { useCart } from "@/context/CartProvider";

/* ───────────────── GraphQL Queries (Giữ nguyên) ───────────────── */
const ORDERS_BY_USER = gql`
  query OrdersByUser($userId: ID!, $limit: Int = 20, $cursor: ID) {
    ordersByUser(userId: $userId, limit: $limit, cursor: $cursor) {
      edges {
        cursor
        node {
          id
          orderCode
          restaurantId
          reservationId
          orderType
          currentStatus
          createdAt
          shipping {
            fullName
            phone
            email
            address
            note
            deliveryTime
            scheduleDate
            scheduleTime
          }
          items {
            _id
            dishId
            menuId
            categoryId
            name
            unit
            image
            proofImages
            quantity
            unitPrice
            lineSubtotal
            servingKey
            servingVariant {
              key
              name
              mode
              price
              sellQty
              sellUnit
            }
            modifiers {
              groupId
              groupName
              optionId
              optionName
              priceRule {
                rule
                amount
              }
            }
          }
          totals {
            grandTotal
          }
        }
      }
    }
  }
`;

const MY_RESERVATIONS = gql`
  query MyReservations($limit: Int = 20, $cursor: ID) {
    myReservations(limit: $limit, cursor: $cursor) {
      id
      orderCode
      restaurantId
      restaurantName
      tableId
      timeTo
      durationMinutes
      partySize
      depositAmount
      depositTxnId
      depositStatus
      depositPaidAt
      depositPaymentProvider
      depositPaymentMethod
      depositPaymentReference
      depositProviderTransactionId
      paymentMethod
      paymentReference
      customerName
      customerPhone
      customerEmail
      note
      isUnlimitedTime
      status
      createdAt
    }
  }
`;

const CANCEL_ORDER = gql`
  mutation CancelOrder($restaurantId: ID!, $orderId: ID!, $reason: String) {
    cancelOrder(restaurantId: $restaurantId, orderId: $orderId, reason: $reason) {
      success
      order {
        id
        currentStatus
        updatedAt
      }
    }
  }
`;
const CANCEL_RESERVATION = gql`
  mutation CancelReservation($id: ID!) {
    cancelReservation(id: $id) {
      id
      status
    }
  }
`;
const REQUEST_RESERVATION_CHANGE = gql`
  mutation RequestReservationChange($input: RequestReservationChangeInput!) {
    requestReservationChange(input: $input) {
      id
      status
      changeRequestType
      changeRequestStatus
      changeRequestFee
      updatedAt
    }
  }
`;

const DELETE_RESERVATION = gql`
  mutation DeleteReservation($id: ID!) {
    deleteReservation(id: $id) {
      id
      status
    }
  }
`;

// Helper format
const fmtMoney = (v) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    v
  );
const EMPTY_VALUE = "--";

const toVNDateTime = (iso) => {
  if (!iso) return EMPTY_VALUE;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? EMPTY_VALUE : date.toLocaleString("vi-VN");
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;
  return value;
};
const normalizeOrderType = (raw) => {
  const value = String(raw || "").toLowerCase();

  if (["delivery", "ship", "giao_hang"].includes(value)) return "delivery";
  if (["takeaway", "pickup", "take_away", "mang_di"].includes(value)) return "takeaway";
  if (["dinein", "dine_in", "eat_in", "tai_quan"].includes(value)) return "dinein";

  return "dinein";
};

const getOrderTypeLabel = (raw) => {
  const value = String(raw || "").toLowerCase();

  if (["delivery", "ship", "giao_hang"].includes(value)) return "Giao hàng";
  if (["takeaway", "pickup", "take_away", "mang_di"].includes(value)) return "Mang đi";
  if (["dinein", "dine_in", "eat_in", "tai_quan"].includes(value)) return "Tại quán";

  return raw ? String(raw) : EMPTY_VALUE;
};

const RESERVATION_STATUS_LABELS = {
  pending_payment: "Chờ thanh toán cọc",
  confirmed: "Đã xác nhận",
  seated: "Đã nhận bàn",
  pending_change: "Đang chờ duyệt thay đổi",
  cancelled: "Đã hủy",
  rejected: "Đã từ chối",
  expired: "Đã hết hạn",
  completed: "Hoàn tất",
  no_show: "Khách không đến",
};

const DEPOSIT_STATUS_LABELS = {
  unpaid: "Chưa thanh toán",
  pending: "Đang chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  refunded: "Đã hoàn cọc",
  cancelled: "Đã hủy",
};

const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
  bank_transfer: "Chuyển khoản ngân hàng",
  e_wallet: "Ví điện tử",
  momo: "MoMo",
  vnpay: "VNPay",
  qr: "Quét mã QR",
  other: "Khác",
};

const getMappedLabel = (map, raw) => {
  if (!raw) return EMPTY_VALUE;
  const value = String(raw).toLowerCase();
  return map[value] || String(raw);
};

const getReservationStatusLabel = (raw) => getMappedLabel(RESERVATION_STATUS_LABELS, raw);
const getDepositStatusLabel = (raw) => getMappedLabel(DEPOSIT_STATUS_LABELS, raw);
const getPaymentMethodLabel = (raw) => getMappedLabel(PAYMENT_METHOD_LABELS, raw);



function OrderDetailModal({ detailTarget, onClose }) {
  if (!detailTarget?.data) return null;

  const { kind, data } = detailTarget;
  const orderCode = data.orderCode || data.id || "--";

  const renderField = (label, value) => (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{displayValue(value)}</span>
    </div>
  );

  return (
    <Modal isOpen={!!detailTarget} onClose={onClose} size="md">
      <Modal.Header>
        {kind === "dinein"
          ? "Chi tiết đơn tại quán"
          : kind === "takeaway"
            ? "Chi tiết đơn mang đi"
            : kind === "delivery"
              ? "Chi tiết đơn giao hàng"
              : "Chi tiết đặt bàn"}
      </Modal.Header>
      <Modal.Body className="order-detail-modal">
        {["dinein", "takeaway", "delivery"].includes(kind) ? (
          <>
            {renderField("Mã đơn", orderCode)}
            {renderField("Trạng thái", data.currentStatus || "--")}
            {renderField("Nhà hàng", data.restaurantId || "--")}
            {renderField("Thời gian tạo", data.createdAt ? toVNDateTime(data.createdAt) : "--")}
            {renderField("Hình thức", getOrderTypeLabel(data.orderType))}
            <div className="detail-items">
              <p className="detail-section-title">Danh sách món</p>
              {(data.items || []).length ? (
                <ul>
                  {(data.items || []).map((it, idx) => (
                    <li key={it?._id || `${it?.name}_${idx}`}>
                      {it?.name || "--"} × {it?.quantity || "--"} {it?.unit || ""} • {fmtMoney(Number(it?.unitPrice ?? it?.price ?? it?.servingVariant?.price ?? 0))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>--</p>
              )}
            </div>
            {renderField("Tổng tiền", fmtMoney(data?.totals?.grandTotal || 0))}
            {data?.reservationId && renderField("Liên kết đặt bàn", data.reservationId)}
          </>
        ) : (
          <>
            {renderField("Mã đặt bàn", orderCode)}
            {renderField("Nhà hàng", data.restaurantName || data.restaurantId || "--")}
            {renderField("Bàn", data.tableId || "--")}
            {renderField("Thời gian đến", data.timeTo ? toVNDateTime(data.timeTo) : "--")}
            {renderField("Thời lượng", data.isUnlimitedTime ? "Không giới hạn" : `${data.durationMinutes || "--"} phút`)}
            {renderField("Số khách", data.partySize ? `${data.partySize} người` : "--")}
            {renderField("Tiền cọc", fmtMoney(data.depositAmount || 0))}
            {renderField("Trạng thái thanh toán cọc", data.depositStatus || "--")}
            {renderField("Trạng thái đặt bàn", data.status || "--")}
            {renderField("Thời gian tạo", data.createdAt ? toVNDateTime(data.createdAt) : "--")}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn--primary" onClick={onClose}>
          Đóng
        </button>
      </Modal.Footer>
    </Modal>
  );
}

function ReceiptModal({ receiptTarget, onClose, onReorder }) {
  if (!receiptTarget) return null;

  const orderCode = receiptTarget?.orderCode || receiptTarget?.id || "--";
  const orderType = normalizeOrderType(receiptTarget?.orderType);

  const renderField = (label, value) => (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{displayValue(value)}</span>
    </div>
  );
  const getOrderItemUnitPrice = (item) =>
    Number(item?.unitPrice ?? item?.price ?? item?.servingVariant?.price ?? 0);

  return (
    <Modal isOpen={!!receiptTarget} onClose={onClose} size="md">
      <Modal.Header>Hóa đơn</Modal.Header>
      <Modal.Body className="order-detail-modal">
        {renderField("Mã đơn", orderCode)}
        {renderField("Trạng thái", receiptTarget?.currentStatus || "--")}
        {renderField("Hình thức", getOrderTypeLabel(receiptTarget?.orderType))}
        {renderField(
          "Nhà hàng",
          receiptTarget?.restaurantName || receiptTarget?.restaurantId || "--"
        )}
        {renderField(
          "Thời gian tạo",
          receiptTarget?.createdAt ? toVNDateTime(receiptTarget.createdAt) : "--"
        )}

        {orderType === "delivery" && receiptTarget?.shipping && (
          <>
            {renderField("Người nhận", receiptTarget?.shipping?.fullName || "--")}
            {renderField("Số điện thoại", receiptTarget?.shipping?.phone || "--")}
            {renderField("Địa chỉ", receiptTarget?.shipping?.address || "--")}
          </>
        )}

        <div className="detail-items">
          <p className="detail-section-title">Danh sách món</p>
          {(receiptTarget?.items || []).length ? (
            <ul>
              {(receiptTarget?.items || []).map((it, idx) => {
                const unitPrice = getOrderItemUnitPrice(it);
                const quantity = Number(it?.quantity);
                const hasSubtotal = Number.isFinite(quantity);
                const lineSubtotal = Number(it?.lineSubtotal);
                const resolvedSubtotal = Number.isFinite(lineSubtotal)
                  ? lineSubtotal
                  : unitPrice * quantity;

                return (
                  <li key={it?._id || `${it?.name}_${idx}`}>
                    {it?.name || "--"} • SL: {it?.quantity ?? "--"} {it?.unit || ""} • Đơn giá: {Number.isFinite(unitPrice) ? fmtMoney(unitPrice) : "--"} • Tạm tính: {hasSubtotal ? fmtMoney(resolvedSubtotal) : "--"}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>--</p>
          )}
        </div>

        {renderField(
          "Tổng tiền",
          Number.isFinite(Number(receiptTarget?.totals?.grandTotal))
            ? fmtMoney(Number(receiptTarget?.totals?.grandTotal))
            : "--"
        )}
        {receiptTarget?.reservationId &&
          renderField("Liên kết đặt bàn", receiptTarget?.reservationId)}
      </Modal.Body>
      <Modal.Footer>
        {!!(receiptTarget?.items || []).length && (
          <button
            className="btn btn--outline"
            onClick={() => onReorder?.(receiptTarget)}
          >
            Đặt lại đơn này
          </button>
        )}
        <button className="btn btn--primary" onClick={onClose}>
          Đóng
        </button>
      </Modal.Footer>
    </Modal>
  );
}
function ReservationReceiptModal({ reservation, onClose }) {
  if (!reservation) return null;

  const reservationCode = reservation?.orderCode || reservation?.id || EMPTY_VALUE;
  const paymentReference =
    reservation?.depositPaymentReference ||
    reservation?.paymentReference ||
    reservation?.depositProviderTransactionId ||
    reservation?.depositTxnId ||
    EMPTY_VALUE;
  const paymentMethod =
    reservation?.depositPaymentMethod ||
    reservation?.paymentMethod ||
    reservation?.depositPaymentProvider;
  const paidAt = reservation?.depositPaidAt;

  const renderField = (label, value) => (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{displayValue(value)}</span>
    </div>
  );

  return (
    <Modal isOpen={!!reservation} onClose={onClose} size="md">
      <Modal.Header>Hóa đơn đặt bàn</Modal.Header>
      <Modal.Body className="order-detail-modal reservation-receipt-modal">
        <div className="receipt-summary-card">
          <div>
            <p className="receipt-summary-label">Mã hóa đơn đặt bàn</p>
            <strong>{reservationCode}</strong>
          </div>
          <div className="receipt-summary-amount">
            <p className="receipt-summary-label">Tiền cọc</p>
            <strong>{fmtMoney(Number(reservation?.depositAmount || 0))}</strong>
          </div>
        </div>

        <div className="detail-items">
          <p className="detail-section-title">Thông tin đặt bàn</p>
          {renderField("Mã đặt bàn", reservationCode)}
          {renderField("Nhà hàng", reservation?.restaurantName || reservation?.restaurantId)}
          {renderField("Bàn", reservation?.tableId)}
          {renderField("Thời gian đến", toVNDateTime(reservation?.timeTo))}
          {renderField(
            "Thời lượng",
            reservation?.isUnlimitedTime
              ? "Không giới hạn"
              : Number.isFinite(Number(reservation?.durationMinutes))
                ? `${Number(reservation.durationMinutes)} phút`
                : EMPTY_VALUE
          )}
          {renderField(
            "Số khách",
            Number.isFinite(Number(reservation?.partySize))
              ? `${Number(reservation.partySize)} người`
              : EMPTY_VALUE
          )}
          {renderField("Trạng thái đặt bàn", getReservationStatusLabel(reservation?.status))}
          {renderField("Thời gian tạo đặt bàn", toVNDateTime(reservation?.createdAt))}
          {renderField("Ghi chú / yêu cầu đặc biệt", reservation?.note)}
        </div>

        <div className="detail-items">
          <p className="detail-section-title">Thông tin cọc</p>
          {renderField("Tiền cọc", fmtMoney(Number(reservation?.depositAmount || 0)))}
          {renderField("Trạng thái thanh toán cọc", getDepositStatusLabel(reservation?.depositStatus))}
          {renderField("Phương thức thanh toán cọc", getPaymentMethodLabel(paymentMethod))}
          {renderField("Mã giao dịch / tham chiếu", paymentReference)}
          {renderField("Thời gian thanh toán cọc", paidAt ? toVNDateTime(paidAt) : EMPTY_VALUE)}
        </div>

        <div className="detail-items">
          <p className="detail-section-title">Thông tin khách đặt</p>
          {renderField("Khách hàng", reservation?.customerName)}
          {renderField("Số điện thoại", reservation?.customerPhone)}
          {renderField("Email", reservation?.customerEmail)}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn--primary" onClick={onClose}>
          Đóng
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default function OrdersPage() {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id;
  const [activeTab, setActiveTab] = useState("all");
  const [toasts, setToasts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const navigate = useNavigate();
  const { cart, addToCart, clearCart } = useCart();

  // State Modals
  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [changeTimeTarget, setChangeTimeTarget] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const [changeTableOpen, setChangeTableOpen] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [reservationReceiptTarget, setReservationReceiptTarget] = useState(null);

  // Queries
  const {
    data: orderConn,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery(ORDERS_BY_USER, {
    variables: { userId, limit: 20 },
    skip: !userId,
    fetchPolicy: "network-only",
  });
  const {
    data: resvList,
    loading: resvLoading,
    error: resvError,
    refetch: refetchReservations,
  } = useQuery(MY_RESERVATIONS, {
    variables: { limit: 20 },
    skip: !userId,
    fetchPolicy: "network-only",
  });

  // Mutations
  const [cancelOrderMutation] = useMutation(CANCEL_ORDER, {
    onCompleted: () => {
      pushToast("Đã hủy đơn");
      refetchOrders();
    },
    onError: (err) => pushToast(getOrderActionErrorMessage(err, "Không thể hủy đơn.")),
  });
  const [cancelReservationMutation] = useMutation(CANCEL_RESERVATION, {
    onCompleted: () => {
      pushToast("Đã hủy bàn");
      refetchReservations();
    },
    onError: (err) =>
      pushToast(getReservationActionErrorMessage(err, "Không thể hủy đặt bàn.")),
  });
  const [requestReservationChange] = useMutation(REQUEST_RESERVATION_CHANGE, {
    onCompleted: () => {
      pushToast("Đã gửi yêu cầu thay đổi tới nhà hàng");
      refetchReservations();
    },
    onError: (err) =>
      pushToast(getReservationActionErrorMessage(err, "Không thể gửi yêu cầu thay đổi.")),
  });

  const [deleteReservationMutation] = useMutation(DELETE_RESERVATION, {
    onCompleted: () => {
      pushToast("Đã xóa lịch sử");
      refetchReservations();
    },
    onError: (err) =>
      pushToast(getReservationActionErrorMessage(err, "Không thể xóa lịch sử đặt bàn.")),
  });

  const pushToast = (text) =>
    setToasts((t) => [...t, { id: Math.random(), text }]);
  const closeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));


  const handleItemClick = (item) => {
    const raw = item?.raw;

    if (["dinein", "takeaway", "delivery"].includes(item?.kind)) {
      if (!raw) {
        pushToast("Không đủ thông tin để mở chi tiết đơn.");
        return;
      }
      setDetailTarget({ kind: item.kind, data: raw });
      return;
    }

    if (item?.kind === "reservation") {
      if (!raw) {
        pushToast("Không đủ thông tin để mở chi tiết đơn.");
        return;
      }
      setDetailTarget({ kind: "reservation", data: raw });
      return;
    }

    pushToast("Không đủ thông tin để mở chi tiết đơn.");
  };

  const resolveOrderRestaurantId = (order) =>
    order?.restaurantId || order?.raw?.restaurantId || null;

  const mapOrderItemToCartItem = (orderItem, restaurantId) => {
    const id = orderItem?.dishId || orderItem?.menuItemId || orderItem?.itemId;
    if (!id) return null;
    const price =
      Number(orderItem?.unitPrice) ||
      Number(orderItem?.servingVariant?.price) ||
      Number(orderItem?.price) ||
      0;

    return {
      id,
      dishId: orderItem?.dishId || id,
      restaurantId,
      name: orderItem?.name || "Món ăn",
      price,
      quantity: Number(orderItem?.quantity) > 0 ? Number(orderItem.quantity) : 1,
      unit: orderItem?.unit || "phần",
      image:
        orderItem?.image ||
        orderItem?.thumbnail ||
        (Array.isArray(orderItem?.proofImages) ? orderItem.proofImages[0] : "") ||
        "",
      modifiers: orderItem?.modifiers || orderItem?.options || [],
    };
  };

  const performReorder = useCallback((order, restaurantId) => {
    const sourceItems = Array.isArray(order?.items) ? order.items : [];
    const mapped = sourceItems
      .map((item) => mapOrderItemToCartItem(item, restaurantId))
      .filter(Boolean);

    if (!mapped.length) {
      pushToast("Một số món trong đơn cũ không còn đủ thông tin để đặt lại.");
      return false;
    }

    mapped.forEach((item) => addToCart(item));
    pushToast("Đã thêm món từ đơn cũ vào giỏ hàng.");
    navigate(`/cus-menu?restaurantId=${encodeURIComponent(restaurantId)}`);
    return true;
  }, [addToCart, navigate]);

  const handleReorder = useCallback((order) => {
    const sourceItems = Array.isArray(order?.items) ? order.items : [];
    if (!sourceItems.length) {
      pushToast("Đơn này không có món để đặt lại.");
      return false;
    }

    const restaurantId = resolveOrderRestaurantId(order);
    if (!restaurantId) {
      pushToast("Không đủ thông tin nhà hàng để đặt lại đơn.");
      return false;
    }

    const cartRestaurantIds = [...new Set((cart || []).map((item) => item?.restaurantId).filter(Boolean))];
    const hasConflict =
      cartRestaurantIds.length > 0 &&
      (cartRestaurantIds.length > 1 || String(cartRestaurantIds[0]) !== String(restaurantId));

    if (hasConflict) {
      const confirmed = window.confirm(
        "Giỏ hàng hiện tại sẽ được thay bằng các món từ đơn này. Tiếp tục?"
      );
      if (!confirmed) return false;
      clearCart();
    }

    return performReorder(order, restaurantId);
  }, [cart, clearCart, performReorder]);

  /* --- 1. MAPPING RESERVATION DATA --- */
  const reservationItems = useMemo(() => {
    return (resvList?.myReservations || []).map((r) => {
      const isCancelled = ["cancelled", "rejected", "expired"].includes(
        (r.status || "").toLowerCase()
      );
      const isCompleted = ["completed", "seated"].includes((r.status || "").toLowerCase());

      const actions = [
        {
          label: "Hóa đơn đặt bàn",
          variant: "outline",
          onClick: () => setReservationReceiptTarget(r),
        },
      ];

      // Action: Thanh toán
      if (r.status === "pending_payment") {
        actions.push({
          label: "Thanh toán cọc",
          variant: "success",
          onClick: () =>
            setQrBooking({
              id: r.id,
              orderCode: r.orderCode,
              deposit: r.depositAmount,
            }),
        });
      }

      // Action: Đổi giờ/bàn
      if (!isCancelled && !isCompleted) {
        actions.push({
          label: "Đổi giờ",
          variant: "outline",
          onClick: () => setChangeTimeTarget(r),
        });
        actions.push({
          label: "Đổi bàn",
          variant: "outline",
          onClick: () => setChangeTableOpen(r),
        });
      }

      // Action: Hủy/Xóa
      if (isCancelled || isCompleted) {
        actions.push({
          label: "Xóa",
          variant: "danger",
          onClick: () => setDeleteTarget({ id: r.id, kind: "reservation" }),
        });
      } else {
        actions.push({
          label: "Hủy",
          variant: "danger",
          onClick: () => setCancelTarget({ id: r.id, kind: "reservation" }),
        });
      }

      return {
        key: r.id,
        kind: "reservation",
        status: (r.status || "").toLowerCase(),
        orderId: r.orderCode || r.id.slice(-6).toUpperCase(),
        restaurantName: r.restaurantName || "Nhà hàng",
        header: { timeText: toVNDateTime(r.createdAt) },
        itemsPreview: [], // Đặt bàn không có list món
        mainInfo: [
          {
            label: "Ngày đến",
            value: toVNDateTime(r.timeTo),
            highlight: true,
          },
          { label: "Số khách", value: `${r.partySize} người` },
          { label: "Tiền cọc", value: fmtMoney(Number(r.depositAmount || 0)) },
          { label: "Thời lượng", value: r.isUnlimitedTime ? "Không giới hạn" : `${r.durationMinutes || 60} phút` },
          { label: "TT thanh toán", value: getDepositStatusLabel(r.depositStatus) },
        ],
        actions: actions,
        raw: r,
      };
    });
  }, [resvList]);

  /* --- 2. MAPPING ORDER DATA --- */
  const orderItems = useMemo(() => {
    const nodes = (orderConn?.ordersByUser?.edges || [])
      .map((e) => e.node)
      .filter(Boolean);

    return nodes.map((o) => {
      const type = normalizeOrderType(o.orderType);
      const isCancelled = ["cancelled", "rejected"].includes(
        (o.currentStatus || "").toLowerCase()
      );

      const itemsPreview = (o.items || [])
        .slice(0, 2)
        .map((it) => ({ quantity: it.quantity, name: it.name }));
      const moreCount = Math.max(0, (o.items?.length || 0) - 2);

      const actions = [
        {
          label: "Hóa đơn",
          variant: "outline",
          onClick: () => setReceiptTarget(o),
        },
      ];
      if ((o.items || []).length > 0) {
        actions.push({
          label: "Đặt lại",
          variant: "primary",
          onClick: () => handleReorder(o),
        });
      }

      if (!isCancelled && o.currentStatus !== "completed") {
        actions.push({
          label: "Hủy đơn",
          variant: "danger",
          onClick: () => setCancelTarget({ id: o.id, restaurantId: o.restaurantId, kind: "order" }),
        });
      }
      return {
        key: o.id,
        kind: type,
        status: (o.currentStatus || "").toLowerCase(),
        orderId: o.orderCode || o.id.slice(-6).toUpperCase(),
        restaurantName: `Nhà hàng (ID: ${o.restaurantId.slice(-4)})`,
        header: {
          timeText: toVNDateTime(o.createdAt),
          moreItemsCount: moreCount,
        },
        itemsPreview: itemsPreview,
        mainInfo: [
          {
            label: "Tổng tiền",
            value: fmtMoney(o.totals?.grandTotal),
            highlight: true,
          },
          { label: "Số món", value: `${o.items?.length || 0} món` },
          {
            label: type === "delivery" ? "Giao lúc" : "Hình thức",
            value:
              type === "delivery"
                ? o.shipping?.deliveryTime || "--"
                : getOrderTypeLabel(o.orderType),
          },
        ],
        actions: actions,
        raw: o,
      };
    });
  }, [orderConn, handleReorder]);

  const allItems = useMemo(
    () => [...reservationItems, ...orderItems],
    [reservationItems, orderItems]
  );
  const isDefaultFilters = !searchTerm.trim() && statusFilter === "all" && sortBy === "newest";

  // Filter + Search + Sort logic
  const visibleItems = useMemo(() => {
    const searchText = searchTerm.trim().toLowerCase();
    const completedStatuses = ["completed", "seated"];
    const cancelledStatuses = ["cancelled", "rejected", "expired"];

    const tabFiltered = allItems.filter((item) => {
      if (activeTab === "all") return true;
      if (activeTab === "reservation") return item.kind === "reservation";
      if (activeTab === "dinein") return item.kind === "dinein";
      if (activeTab === "takeaway") return item.kind === "takeaway";
      if (activeTab === "delivery") return item.kind === "delivery";
      if (activeTab === "history") {
        return ["cancelled", "completed", "rejected", "expired"].includes(item.status);
      }
      return true;
    });

    const searched = tabFiltered.filter((item) => {
      if (!searchText) return true;
      const raw = item?.raw || {};
      const itemNames = Array.isArray(raw?.items)
        ? raw.items.map((it) => it?.name).filter(Boolean).join(" ")
        : "";

      const haystack = [
        item?.orderId,
        item?.restaurantName,
        item?.status,
        item?.kind,
        raw?.orderCode,
        raw?.id,
        raw?.restaurantId,
        raw?.currentStatus,
        raw?.status,
        itemNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchText);
    });

    const statusFiltered = searched.filter((item) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "completed") return completedStatuses.includes(item.status);
      if (statusFilter === "cancelled") return cancelledStatuses.includes(item.status);
      if (statusFilter === "active") {
        return !completedStatuses.includes(item.status) && !cancelledStatuses.includes(item.status);
      }
      return true;
    });

    const getDateValue = (item) => {
      const raw = item?.raw || {};
      const ts = raw?.timeTo || raw?.createdAt;
      const parsed = ts ? Date.parse(ts) : NaN;
      return Number.isFinite(parsed) ? parsed : null;
    };

    const getAmountValue = (item) => {
      const raw = item?.raw || {};
      const amount = raw?.totals?.grandTotal ?? raw?.depositAmount;
      const parsed = Number(amount);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return [...statusFiltered].sort((a, b) => {
      if (sortBy === "newest" || sortBy === "oldest") {
        const av = getDateValue(a);
        const bv = getDateValue(b);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return sortBy === "newest" ? bv - av : av - bv;
      }

      if (sortBy === "amount_desc" || sortBy === "amount_asc") {
        const av = getAmountValue(a);
        const bv = getAmountValue(b);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return sortBy === "amount_desc" ? bv - av : av - bv;
      }

      return 0;
    });
  }, [activeTab, allItems, searchTerm, statusFilter, sortBy]);

  const hasAnyError = Boolean(ordersError || resvError);
  const hasLoadedItems = allItems.length > 0;
  const hasVisibleItems = visibleItems.length > 0;
  const isLoading = ordersLoading || resvLoading;
  const shouldShowFullError = !isLoading && hasAnyError && !hasLoadedItems;
  const shouldShowPartialWarning = !isLoading && hasAnyError && hasLoadedItems;
  const shouldShowEmpty = !isLoading && !hasVisibleItems && !shouldShowFullError;
  const hasFilterOrSearch = !isDefaultFilters;
  const hasScopedFilter = hasFilterOrSearch || activeTab !== "all";
  const summaryStats = useMemo(() => {
    const completedStatuses = ["completed", "seated"];
    const cancelledStatuses = ["cancelled", "rejected", "expired"];
    const activeCount = allItems.filter(
      (item) => !completedStatuses.includes(item.status) && !cancelledStatuses.includes(item.status)
    ).length;

    return [
      { label: "Tổng hồ sơ", value: allItems.length },
      { label: "Đặt bàn", value: reservationItems.length },
      { label: "Đang xử lý", value: activeCount },
      { label: "Đang hiển thị", value: visibleItems.length },
    ];
  }, [allItems, reservationItems.length, visibleItems.length]);

  return (
    <main className="orders-page">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={closeToast} />
      ))}

      <section className="page-header orders-hero" aria-labelledby="orders-page-title">
        <div className="hero-copy">
          <span className="eyebrow">Trung tâm giao dịch cá nhân</span>
          <h1 id="orders-page-title" className="title">Quản lý đơn hàng & đặt bàn</h1>
          <p className="subtitle">Quản lý đơn món, lịch đặt bàn, hóa đơn và trạng thái thanh toán cọc tại một nơi duy nhất.</p>
          <div className="summary-strip" aria-label="Tổng quan đơn hàng">
            {summaryStats.map((stat) => (
              <div key={stat.label} className="summary-chip">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </div>
        <button
          className="btn-create"
          aria-label="Tạo đơn mới"
          onClick={() => navigate("/restaurants")}
        >
          Tạo đơn mới
        </button>
      </section>

      <section className="orders-toolbar" aria-label="Bộ lọc đơn hàng">
        <div className="tabs-container">
        {[
          { id: "all", label: "Tất cả", icon: "📑" },
          { id: "reservation", label: "Đặt bàn", icon: "📅" },
          { id: "dinein", label: "Tại quán", icon: "🍽️" },
          { id: "takeaway", label: "Mang đi", icon: "🥡" },
          { id: "delivery", label: "Giao hàng", icon: "🚚" },
          { id: "history", label: "Lịch sử", icon: "📜" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
        </div>
        <div className="orders-controls">
        <input
          className="orders-search"
          type="text"
          placeholder="Tìm theo mã đơn, món, nhà hàng..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="orders-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang xử lý</option>
          <option value="completed">Hoàn tất</option>
          <option value="cancelled">Đã hủy/từ chối/hết hạn</option>
        </select>
        <select className="orders-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="amount_desc">Tổng tiền cao đến thấp</option>
          <option value="amount_asc">Tổng tiền thấp đến cao</option>
        </select>
        {hasFilterOrSearch && (
          <button
            className="btn-clear-filters"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setSortBy("newest");
            }}
          >
            Xóa lọc
          </button>
        )}
        </div>
      </section>

      <section className="orders-grid" aria-live="polite">
        {isLoading ? (
          <div className="empty-state">
            <p>Đang tải danh sách đơn hàng...</p>
            <Skeleton rows={3} />
          </div>
        ) : shouldShowFullError ? (
          <div className="empty-state">
            <p>{ordersError?.message || resvError?.message || "Không thể tải danh sách đơn hàng."}</p>
            <div className="empty-actions">
              <Link to="/orders" className="btn-create">Quay lại đơn hàng của tôi</Link>
              <Link to="/" className="btn-create">Tiếp tục xem món</Link>
            </div>
          </div>
        ) : (
          <>
            {shouldShowPartialWarning && (
              <div className="empty-state empty-state--warning">
                <p>Một phần dữ liệu chưa tải được. Bạn vẫn có thể xem các đơn đã tải.</p>
                {(ordersError?.message || resvError?.message) && (
                  <p>{ordersError?.message || resvError?.message}</p>
                )}
              </div>
            )}
            {visibleItems.map((item) => (
              <OrderItem
                key={item.key}
                {...item}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </>
        )}
        {shouldShowEmpty && (
          <div className="empty-state">
            <p>{hasScopedFilter ? "Không tìm thấy đơn phù hợp." : "Bạn chưa có đơn hàng nào."}</p>
            <Link to="/" className="btn-create">Tiếp tục xem món</Link>
          </div>
        )}
      </section>

      {/* --- MODALS --- */}
      <QRPaymentModal
        isOpen={!!qrBooking}
        onClose={() => setQrBooking(null)}
        booking={qrBooking}
        onPaymentConfirmed={() => {
          setQrBooking(null);
          refetchReservations();
        }}
      />
      <ChangeTimeModal
        isOpen={!!changeTimeTarget}
        onClose={() => setChangeTimeTarget(null)}
        onSubmit={async (v) => {
          await requestReservationChange({
            variables: {
              input: {
                reservationId: changeTimeTarget?.id,
                type: "time",
                requestedTimeTo: v?.timeTo || null,
                requestedDurationMinutes: v?.durationMinutes || null,
                note: "Khách yêu cầu đổi giờ từ trang tài khoản",
              },
            },
          });
          setChangeTimeTarget(null);
        }}
      />
      <CancelOrderModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async ({ reason }) => {
          if (cancelTarget.kind === "reservation")
            await cancelReservationMutation({ variables: { id: cancelTarget.id } });
          else
            await cancelOrderMutation({ variables: { orderId: cancelTarget.id, restaurantId: cancelTarget.restaurantId, reason } });
          setCancelTarget(null);
        }}
      />
      <ConfirmationModal
        visible={!!deleteTarget}
        title="Xóa lịch sử?"
        onConfirm={async () => {
          await deleteReservationMutation({ variables: { id: deleteTarget.id } });
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />
      <OrderDetailModal
        detailTarget={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
      <ReceiptModal
        receiptTarget={receiptTarget}
        onClose={() => setReceiptTarget(null)}
        onReorder={(order) => {
          const ok = handleReorder(order);
          if (ok) setReceiptTarget(null);
        }}
      />
      <ReservationReceiptModal
        reservation={reservationReceiptTarget}
        onClose={() => setReservationReceiptTarget(null)}
      />
      <ChangeTableModal
        isOpen={!!changeTableOpen}
        onClose={() => setChangeTableOpen(null)}
        onSubmit={async (payload) => {
          await requestReservationChange({
            variables: {
              input: {
                reservationId: changeTableOpen?.id,
                type: "table",
                requestedTableId: payload?.tableId || null,
                note: "Khách yêu cầu đổi bàn từ trang tài khoản",
              },
            },
          });
          setChangeTableOpen(null);
        }}
      />
    </main>
  );
}
