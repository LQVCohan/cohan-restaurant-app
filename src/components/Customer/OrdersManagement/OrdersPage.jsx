import React, { useMemo, useState, useContext, useEffect } from "react";
import "./OrdersPage.scss";
import OrderItem from "./OrderItem";
import Toast from "../../ui/Toast";
import Skeleton from "../../ui/Skeleton";
import Icon from "../../ui/Icon";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { AuthContext } from "../../../context/AuthContext";
import CancelOrderModal from "./modals/CancelOrderModal";
import ChangeTimeModal from "./modals/ChangeTimeModal";
import QRPaymentModal from "../QRPaymentModal/QRPaymentModal";
import TrackingModal from "./modals/TrackingModal";
import ChangeTableModal from "./modals/ChangeTableModal";
// Import ConfirmationModal mà chúng ta đã làm ở bước trước
import ConfirmationModal from "../../Customer/TableBooking/ConfirmationModal/ConfirmationModal";

/* ───────────────── GraphQL Queries ───────────────── */
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
            name
            price
            quantity
          }
          totals {
            grandTotal
          }
          currentStatus
          createdAt
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
      status
      createdAt
    }
  }
`;

const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      currentStatus
      updatedAt
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
const CREATE_RESERVATION = gql`
  mutation CreateReservation($input: CreateReservationInput!) {
    createReservation(input: $input) {
      id
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

// ✅ MỚI: Mutation Xóa đặt bàn
const DELETE_RESERVATION = gql`
  mutation DeleteReservation($id: ID!) {
    deleteReservation(id: $id) {
      id
      status
    }
  }
`;

const fmtMoney = (v) =>
  typeof v === "number" ? v.toLocaleString("vi-VN") + "đ" : "0đ";
const toVNDateTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
};
const normalizeOrderType = (raw) => {
  const v = (raw || "").toLowerCase();
  if (["delivery", "ship", "giao_hang"].includes(v)) return "delivery";
  return "dinein";
};

export default function OrdersPage() {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id;
  console.log("User ID in OrdersPage:", userId);
  const [activeTab, setActiveTab] = useState("all");
  const [toasts, setToasts] = useState([]);
  const pushToast = (text, type = "success") =>
    setToasts((t) => [...t, { id: Math.random(), text, type }]);
  const closeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  // --- States Modal ---
  const [modal, setModal] = useState({
    type: null,
    orderKey: null,
    payload: null,
  });
  const [cancelTarget, setCancelTarget] = useState(null); // Target để Hủy
  const [deleteTarget, setDeleteTarget] = useState(null); // Target để Xóa (Mới)
  const [changeTimeTarget, setChangeTimeTarget] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [changeTableOpen, setChangeTableOpen] = useState(null);

  /* Queries */
  const {
    data: orderConn,
    loading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery(ORDERS_BY_USER, {
    variables: { userId, limit: 20 },
    skip: !userId,
    fetchPolicy: "network-only",
  });

  const {
    data: resvList,
    loading: resvLoading,
    refetch: refetchReservations,
  } = useQuery(MY_RESERVATIONS, {
    variables: { limit: 20 },
    skip: !userId,
    fetchPolicy: "network-only",
  });

  /* Mutations */
  const [cancelOrderMutation] = useMutation(CANCEL_ORDER, {
    onCompleted: () => {
      pushToast("Đã hủy đơn", "success");
      refetchOrders();
    },
  });
  const [cancelReservationMutation] = useMutation(CANCEL_RESERVATION, {
    onCompleted: () => {
      pushToast("Đã hủy đặt bàn", "success");
      refetchReservations();
    },
  });
  const [createReservation] = useMutation(CREATE_RESERVATION, {
    onCompleted: () => {
      pushToast("Đặt bàn thành công!", "success");
      refetchReservations();
    },
  });

  // ✅ MỚI: Mutation Xóa
  const [deleteReservationMutation] = useMutation(DELETE_RESERVATION, {
    onCompleted: () => {
      pushToast("Đã xóa lịch sử đặt bàn", "success");
      refetchReservations();
    },
    onError: (err) => {
      pushToast("Lỗi khi xóa: " + err.message, "error");
    },
  });

  /* --- 1. MAP DATA CHO ĐẶT BÀN --- */
  const reservationItems = useMemo(() => {
    const arr = resvList?.myReservations || [];
    return arr.map((r) => {
      const timeObj = new Date(r.timeTo);
      const dateStr = timeObj.toLocaleDateString("vi-VN");
      const timeStr = timeObj.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const durationVal = r.durationMinutes ? r.durationMinutes : 90;

      const mainInfo = [
        { label: "Ngày giờ", value: `${dateStr} - ${timeStr}` },
        { label: "Thời lượng", value: `${durationVal} phút` },
        { label: "Số khách", value: `${r.partySize} người` },
      ];
      if (r.depositAmount > 0) {
        mainInfo.push({
          label: "Tiền cọc",
          value: fmtMoney(r.depositAmount),
          highlight: true,
        });
      }

      // Logic xác định nút Hủy hay Xóa
      const isCancelled = ["cancelled", "rejected", "expired"].includes(
        (r.status || "").toLowerCase()
      );
      const isCompleted = (r.status || "").toLowerCase() === "checked_in";

      // Tạo danh sách actions động
      const dynamicActions = [];

      // Action 1: Đổi giờ / Đổi bàn (Chỉ hiện khi chưa hủy/hoàn thành)
      if (!isCancelled && !isCompleted) {
        dynamicActions.push(
          {
            icon: "clock",
            label: "Đổi giờ",
            variant: "secondary",
            onClick: () => setChangeTimeTarget(r),
          },
          {
            icon: "mapPin",
            label: "Đổi bàn",
            variant: "secondary",
            onClick: () => setChangeTableOpen(r),
          }
        );
      }

      // Action 2: Xem chi tiết (Luôn hiện)
      dynamicActions.push({
        icon: "eye",
        label: "Chi tiết",
        variant: "primary",
        onClick: () => openOrderDetails(r.id, r),
      });

      // Action 3: Thanh toán (Chỉ hiện khi pending_payment)
      if (r.status === "pending_payment") {
        dynamicActions.push({
          icon: "creditCard",
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

      // Action 4: Hủy hoặc Xóa
      if (isCancelled || isCompleted) {
        // Nếu đã hủy/xong -> Hiện nút Xóa
        dynamicActions.push({
          icon: "trash",
          label: "Xóa",
          variant: "danger",
          onClick: () => setDeleteTarget({ id: r.id, kind: "reservation" }),
        });
      } else {
        // Nếu đang hoạt động -> Hiện nút Hủy
        dynamicActions.push({
          icon: "x",
          label: "Hủy đặt",
          variant: "danger",
          onClick: () => setCancelTarget({ id: r.id, kind: "reservation" }),
        });
      }

      return {
        kind: "reservation",
        key: r.id,
        status: (r.status || "").toLowerCase(),
        restaurantName: r.restaurantName || "Đang cập nhật...",
        header: {
          id: `#${r.orderCode || r.id.slice(-6).toUpperCase()}`,
          timeText: `Tạo lúc: ${toVNDateTime(r.createdAt)}`,
        },
        itemsPreview: [],
        mainInfo: mainInfo,
        actions: dynamicActions, // Sử dụng actions động
        raw: r,
      };
    });
  }, [resvList]);

  /* --- 2. MAP DATA CHO ĐƠN HÀNG (ORDER) --- */
  const deliveryAndDineinItems = useMemo(() => {
    const edges = orderConn?.ordersByUser?.edges || [];
    const nodes = edges.map((e) => e.node).filter(Boolean);

    return nodes.map((o) => {
      const orderTypeNorm = normalizeOrderType(o.orderType);
      const itemsPreview = (o.items || [])
        .slice(0, 2)
        .map((it) => ({ quantity: it.quantity, name: it.name }));
      const moreItemsCount = Math.max(0, (o.items?.length || 0) - 2);

      const mainInfo = [
        {
          label: "Tổng tiền",
          value: fmtMoney(o.totals?.grandTotal),
          highlight: true,
        },
        { label: "Số lượng", value: `${o.items?.length || 0} món` },
      ];
      if (orderTypeNorm === "delivery") {
        mainInfo.push({
          label: "Giao lúc",
          value: o.shipping?.deliveryTime || "—",
        });
      } else {
        mainInfo.push({ label: "Hình thức", value: "Tại quán" });
      }

      // Logic nút Hủy cho Order (Order chưa có hàm delete trong schema cung cấp, nên tạm giữ Hủy)
      // Nếu bạn có mutation deleteOrder thì áp dụng logic tương tự Reservation ở trên
      const isCancelled = ["cancelled", "rejected"].includes(
        (o.currentStatus || "").toLowerCase()
      );

      const orderActions = [
        {
          icon: "eye",
          label: "Chi tiết",
          variant: "secondary",
          onClick: () => openOrderDetails(o.id, o),
        },
        {
          icon: "receipt",
          label: "Hóa đơn",
          variant: "secondary",
          onClick: () => viewReceipt(o.id),
        },
      ];

      // Thêm nút Hủy nếu chưa hoàn thành/hủy
      if (!isCancelled && o.currentStatus !== "completed") {
        orderActions.push({
          icon: "x",
          label: "Hủy đơn",
          variant: "danger",
          onClick: () => setCancelTarget({ id: o.id, kind: "order" }),
        });
      }

      // Thêm nút theo dõi nếu đang giao
      if (
        orderTypeNorm === "delivery" &&
        ["shipping", "delivering"].includes(o.currentStatus)
      ) {
        orderActions.unshift({
          icon: "truck",
          label: "Lộ trình",
          variant: "primary",
          onClick: () => setTrackingOrder(o),
        });
      }

      return {
        kind: orderTypeNorm === "delivery" ? "delivery" : "dinein",
        key: o.id,
        status: (o.currentStatus || "").toLowerCase(),
        restaurantName: `Nhà hàng (ID: ${o.restaurantId.slice(-6)})`,
        header: {
          id: `#${o.orderCode || o.id.slice(-6).toUpperCase()}`,
          timeText: toVNDateTime(o.createdAt),
          moreItemsCount: moreItemsCount,
        },
        itemsPreview: itemsPreview,
        mainInfo: mainInfo,
        actions: orderActions,
        raw: o,
      };
    });
  }, [orderConn]);

  const allItems = useMemo(() => {
    const rawList = [...reservationItems, ...deliveryAndDineinItems];

    // Chỉ giữ lại các item KHÔNG PHẢI là 'no_show'
    return rawList.filter((item) => item.status !== "no_show");
  }, [reservationItems, deliveryAndDineinItems]);
  const counts = useMemo(() => {
    const c = {
      all: allItems.length,
      reservation: 0,
      dinein: 0,
      delivery: 0,
      cancelled: 0,
      completed: 0,
    };
    allItems.forEach((o) => {
      if (o.kind === "reservation") c.reservation++;
      if (o.kind === "dinein") c.dinein++;
      if (o.kind === "delivery") c.delivery++;
      if (["cancelled", "rejected"].includes(o.status)) c.cancelled++;
      if (o.status === "completed") c.completed++;
    });
    return c;
  }, [allItems]);

  const visible = useMemo(
    () =>
      allItems.filter((o) => {
        if (activeTab === "all") return true;
        if (activeTab === "reservation") return o.kind === "reservation";
        if (activeTab === "dinein") return o.kind === "dinein";
        if (activeTab === "delivery") return o.kind === "delivery";
        if (activeTab === "done_cancel")
          return ["cancelled", "completed", "rejected", "no_show"].includes(
            o.status
          );
        return true;
      }),
    [allItems, activeTab]
  );

  /* Render Helper */
  const openOrderDetails = (key, payload) =>
    setModal({ type: "details", orderKey: key, payload });
  const viewReceipt = (id) => {
    pushToast("Đang tải hóa đơn...", "success");
  };
  const callShipper = () => pushToast("Đang kết nối shipper...", "success");

  return (
    <div className="orders-container">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={closeToast} />
      ))}
      <div className="page-header">
        <h1 className="page-title">
          <Icon name="receipt" size={28} style={{ marginRight: 8 }} /> Đơn hàng
          của tôi
        </h1>
        <button className="btn btn-primary">➕ Đặt món mới</button>
      </div>

      <div className="filter-tabs">
        <button
          className={`filter-tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          Tất cả ({counts.all})
        </button>
        <button
          className={`filter-tab ${
            activeTab === "reservation" ? "active" : ""
          }`}
          onClick={() => setActiveTab("reservation")}
        >
          <span className="tab-icon">🍽️</span> Đặt bàn ({counts.reservation})
        </button>
        <button
          className={`filter-tab ${activeTab === "dinein" ? "active" : ""}`}
          onClick={() => setActiveTab("dinein")}
        >
          <span className="tab-icon">🏬</span> Tại quán ({counts.dinein})
        </button>
        <button
          className={`filter-tab ${activeTab === "delivery" ? "active" : ""}`}
          onClick={() => setActiveTab("delivery")}
        >
          <span className="tab-icon">🚚</span> Giao hàng ({counts.delivery})
        </button>
        <button
          className={`filter-tab ${
            activeTab === "done_cancel" ? "active" : ""
          }`}
          onClick={() => setActiveTab("done_cancel")}
        >
          <span className="tab-icon">📜</span> Lịch sử
        </button>
      </div>
      <div id="ordersList">
        {ordersLoading || resvLoading ? (
          <Skeleton rows={3} />
        ) : (
          visible.map((item) => {
            // Logic kiểm tra xem đây có phải là đơn hàng cũ/đã xong không
            const isHistory = [
              "cancelled",
              "completed",
              "rejected",
              "expired",
              "no_show",
              "checked_in",
            ].includes(item.status);

            return (
              <div
                key={item.key}
                className={`order-item-wrapper ${isHistory ? "is-muted" : ""}`}
              >
                <OrderItem
                  {...item}
                  onClick={() => openOrderDetails(item.key, item.raw)}
                />
              </div>
            );
          })
        )}
      </div>
      {/* --- Modals --- */}
      <QRPaymentModal
        isOpen={!!qrBooking}
        onClose={() => setQrBooking(null)}
        booking={qrBooking}
        onPaymentConfirmed={() => {
          setQrBooking(null);
          pushToast("Thanh toán thành công!", "success");
          refetchReservations?.();
        }}
      />
      <ChangeTimeModal
        isOpen={!!changeTimeTarget}
        onClose={() => setChangeTimeTarget(null)}
        initialDate={
          changeTimeTarget?.timeTo
            ? new Date(changeTimeTarget.timeTo).toISOString().slice(0, 10)
            : undefined
        }
        initialTime={
          changeTimeTarget?.timeTo
            ? new Date(changeTimeTarget.timeTo).toTimeString().slice(0, 5)
            : "19:30"
        }
        onSubmit={({ iso }) => {
          createReservation({
            variables: {
              input: {
                restaurantId: changeTimeTarget.restaurantId,
                tableId: changeTimeTarget.tableId,
                timeTo: iso,
                durationMinutes: 90,
                partySize: changeTimeTarget.partySize,
              },
            },
          }).finally(() => setChangeTimeTarget(null));
        }}
      />
      {/* Modal Hủy (Có lý do) */}
      <CancelOrderModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={
          cancelTarget?.kind === "reservation"
            ? "❌ Hủy đặt bàn"
            : "❌ Hủy đơn hàng"
        }
        onConfirm={({ reason }) => {
          if (cancelTarget.kind === "reservation")
            cancelReservationMutation({
              variables: { id: cancelTarget.id },
            }).finally(() => setCancelTarget(null));
          else
            cancelOrderMutation({
              variables: { id: cancelTarget.id, reason },
            }).finally(() => setCancelTarget(null));
        }}
      />
      {/* ✅ Modal Xóa (Confirm đơn giản) */}
      <ConfirmationModal
        visible={!!deleteTarget}
        variant="danger"
        title="Xóa lịch sử đặt bàn?"
        message="Bạn có chắc chắn muốn xóa bản ghi này khỏi lịch sử không? Hành động này không thể hoàn tác."
        confirmText="Xóa vĩnh viễn"
        cancelText="Giữ lại"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget.kind === "reservation") {
            deleteReservationMutation({ variables: { id: deleteTarget.id } });
          }
          setDeleteTarget(null);
        }}
      />
      <TrackingModal
        isOpen={!!trackingOrder}
        onClose={() => setTrackingOrder(null)}
        order={trackingOrder}
        onCallShipper={callShipper}
      />
      <ChangeTableModal
        isOpen={!!changeTableOpen}
        onClose={() => setChangeTableOpen(null)}
        currentReservation={changeTableOpen}
        restaurants={[]}
        tablesByRestaurant={{}}
        onSubmit={() => {
          pushToast("Yêu cầu đổi bàn đã gửi.", "success");
          setChangeTableOpen(null);
        }}
      />
    </div>
  );
}
