import React, { useMemo, useState, useContext } from "react";
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
import TrackingModal from "./modals/TrackingModal";
import ChangeTableModal from "./modals/ChangeTableModal";
import {
  getOrderActionErrorMessage,
  getReservationActionErrorMessage,
} from "@/utils/commerceActionErrorMessages";
import ConfirmationModal from "../../Customer/TableBooking/ConfirmationModal/ConfirmationModal";

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
            name
            price
            quantity
            unit
            proofImages
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
      depositStatus
      isUnlimitedTime
      status
      createdAt
    }
  }
`;

const CANCEL_ORDER = gql`
  mutation CancelOrder($id: ID!, $reason: String) {
    cancelOrder(id: $id, reason: $reason) {
      id
      currentStatus
      updatedAt
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
const toVNDateTime = (iso) => new Date(iso).toLocaleString("vi-VN");
const normalizeOrderType = (raw) =>
  ["delivery", "ship", "giao_hang"].includes((raw || "").toLowerCase())
    ? "delivery"
    : "dinein";

const getOrderTypeLabel = (raw) => {
  const value = String(raw || "").toLowerCase();

  if (["delivery", "ship", "giao_hang"].includes(value)) return "Giao hàng";
  if (["takeaway", "pickup", "take_away", "mang_di"].includes(value)) return "Mang đi";
  if (["dinein", "dine_in", "eat_in", "tai_quan"].includes(value)) return "Tại quán";

  return raw ? String(raw) : "--";
};



function OrderDetailModal({ detailTarget, onClose }) {
  if (!detailTarget?.data) return null;

  const { kind, data } = detailTarget;
  const orderCode = data.orderCode || data.id || "--";

  const renderField = (label, value) => (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || "--"}</span>
    </div>
  );

  return (
    <Modal isOpen={!!detailTarget} onClose={onClose} size="md">
      <Modal.Header>
        {kind === "dinein" ? "Chi tiết đơn tại quán" : "Chi tiết đặt bàn"}
      </Modal.Header>
      <Modal.Body className="order-detail-modal">
        {kind === "dinein" ? (
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
                      {it?.name || "--"} × {it?.quantity || "--"} {it?.unit || ""} • {fmtMoney(it?.price || 0)}
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

function ReceiptModal({ receiptTarget, onClose }) {
  if (!receiptTarget) return null;

  const orderCode = receiptTarget?.orderCode || receiptTarget?.id || "--";
  const orderType = normalizeOrderType(receiptTarget?.orderType);

  const renderField = (label, value) => (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || "--"}</span>
    </div>
  );

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
                const unitPrice = Number(it?.price);
                const quantity = Number(it?.quantity);
                const hasSubtotal = Number.isFinite(unitPrice) && Number.isFinite(quantity);

                return (
                  <li key={it?._id || `${it?.name}_${idx}`}>
                    {it?.name || "--"} • SL: {it?.quantity ?? "--"} {it?.unit || ""} • Đơn giá: {Number.isFinite(unitPrice) ? fmtMoney(unitPrice) : "--"} • Tạm tính: {hasSubtotal ? fmtMoney(unitPrice * quantity) : "--"}
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
  const navigate = useNavigate();

  // State Modals
  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [changeTimeTarget, setChangeTimeTarget] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [changeTableOpen, setChangeTableOpen] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [receiptTarget, setReceiptTarget] = useState(null);

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


  const buildTrackingUrl = (order) => {
    const orderId = order?.id;
    if (!orderId) return null;

    const params = new URLSearchParams();
    if (order.restaurantId) params.set("restaurantId", order.restaurantId);
    if (order.orderCode) params.set("orderCode", order.orderCode);

    const query = params.toString();
    return `/track-delivery/${orderId}${query ? `?${query}` : ""}`;
  };

  const handleItemClick = (item) => {
    const raw = item?.raw;

    if (item?.kind === "delivery") {
      const url = buildTrackingUrl(raw);
      if (url) {
        navigate(url);
        return;
      }
      pushToast("Không đủ thông tin để mở chi tiết đơn.");
      return;
    }

    if (item?.kind === "dinein") {
      if (!raw) {
        pushToast("Không đủ thông tin để mở chi tiết đơn.");
        return;
      }
      setDetailTarget({ kind: "dinein", data: raw });
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

  /* --- 1. MAPPING RESERVATION DATA --- */
  const reservationItems = useMemo(() => {
    return (resvList?.myReservations || []).map((r) => {
      const isCancelled = ["cancelled", "rejected", "expired"].includes(
        (r.status || "").toLowerCase()
      );
      const isCompleted = ["completed", "seated"].includes((r.status || "").toLowerCase());

      const actions = [];

      // Action: Thanh toán
      if (r.status === "pending_payment") {
        actions.push({
          label: "Thanh toán",
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
            value: new Date(r.timeTo).toLocaleString("vi-VN"),
            highlight: true,
          },
          { label: "Số khách", value: `${r.partySize} người` },
          { label: "Tiền cọc", value: fmtMoney(r.depositAmount) },
          { label: "Thời lượng", value: r.isUnlimitedTime ? "Không giới hạn" : `${r.durationMinutes || 60} phút` },
          { label: "TT thanh toán", value: r.depositStatus || "--" },
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

      if (!isCancelled && o.currentStatus !== "completed") {
        actions.push({
          label: "Hủy đơn",
          variant: "danger",
          onClick: () => setCancelTarget({ id: o.id, kind: "order" }),
        });
      }
      if (
        type === "delivery" &&
        ["shipping", "delivering"].includes(o.currentStatus)
      ) {
        actions.unshift({
          label: "Theo dõi",
          variant: "primary",
          onClick: () => setTrackingOrder(o),
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
                : "Tại quán",
          },
        ],
        actions: actions,
        raw: o,
      };
    });
  }, [orderConn]);

  const allItems = [...reservationItems, ...orderItems];

  // Filter logic
  const visibleItems = allItems.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "reservation") return item.kind === "reservation";
    if (activeTab === "dinein") return item.kind === "dinein";
    if (activeTab === "delivery") return item.kind === "delivery";
    if (activeTab === "history")
      return ["cancelled", "completed", "rejected", "expired"].includes(
        item.status
      );
    return true;
  });

  const hasAnyError = Boolean(ordersError || resvError);
  const hasVisibleItems = visibleItems.length > 0;
  const isLoading = ordersLoading || resvLoading;
  const shouldShowFullError = !isLoading && hasAnyError && !hasVisibleItems;
  const shouldShowPartialWarning = !isLoading && hasAnyError && hasVisibleItems;
  const shouldShowEmpty = !isLoading && !hasAnyError && !hasVisibleItems;

  return (
    <div className="orders-page">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={closeToast} />
      ))}

      <div className="page-header">
        <h1 className="title">📦 Quản lý Đơn hàng</h1>
        <button
          className="btn-create"
          aria-label="Tạo đơn mới"
          onClick={() => navigate("/restaurants")}
        >
          ➕ Tạo đơn mới
        </button>
      </div>

      <div className="tabs-container">
        {[
          { id: "all", label: "Tất cả", icon: "📑" },
          { id: "reservation", label: "Đặt bàn", icon: "📅" },
          { id: "dinein", label: "Tại quán", icon: "🍽️" },
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

      <div className="orders-grid">
        {isLoading ? (
          <div className="empty-state">
            <p>Đang tải danh sách đơn hàng...</p>
            <Skeleton rows={3} />
          </div>
        ) : shouldShowFullError ? (
          <div className="empty-state">
            <p>{ordersError?.message || resvError?.message || "Không thể tải danh sách đơn hàng."}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
              <Link to="/orders" className="btn-create">Quay lại đơn hàng của tôi</Link>
              <Link to="/" className="btn-create">Tiếp tục xem món</Link>
            </div>
          </div>
        ) : (
          <>
            {shouldShowPartialWarning && (
              <div className="empty-state" style={{ marginBottom: 12 }}>
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
            <p>Bạn chưa có đơn hàng nào.</p>
            <Link to="/" className="btn-create">Tiếp tục xem món</Link>
          </div>
        )}
      </div>

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
            await cancelOrderMutation({ variables: { id: cancelTarget.id, reason } });
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
      <TrackingModal
        isOpen={!!trackingOrder}
        onClose={() => setTrackingOrder(null)}
        order={trackingOrder}
      />
      <OrderDetailModal
        detailTarget={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
      <ReceiptModal
        receiptTarget={receiptTarget}
        onClose={() => setReceiptTarget(null)}
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
    </div>
  );
}
