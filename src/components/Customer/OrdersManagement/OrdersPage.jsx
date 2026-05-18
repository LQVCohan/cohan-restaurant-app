import React, { useMemo, useState, useContext } from "react";
import { Link } from "react-router-dom";
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

export default function OrdersPage() {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id;
  const [activeTab, setActiveTab] = useState("all");
  const [toasts, setToasts] = useState([]);

  // State Modals
  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [changeTimeTarget, setChangeTimeTarget] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [changeTableOpen, setChangeTableOpen] = useState(null);

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
          onClick: () => pushToast("Xem hóa đơn..."),
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
        <button className="btn-create">➕ Tạo đơn mới</button>
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
                onClick={() => console.log("View details", item.key)}
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
