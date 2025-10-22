// src/components/orders/OrdersPage.jsx
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
            deliveryMethod
            deliveryTime
            scheduleDate
            scheduleTime
          }
          items {
            name
            price
            quantity
            modifiersPrice
            lineSubtotal
          }
          totals {
            subtotal
            discount
            tax
            service
            grandTotal
          }
          payment {
            method
            paidAmount
            status
            txnRef
            paidAt
            currency
          }
          statusTimeline {
            status
            at
            note
            byUserId
          }
          currentStatus
          note
          createdAt
          updatedAt
        }
      }
      pageInfo {
        endCursor
        hasNextPage
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
      userId

      timeTo

      customerName
      customerPhone
      customerEmail
      partySize
      note
      depositAmount
      depositTxnId
      depositStatus
      status
      pendingPaymentExpiresAt
      createdAt
      updatedAt
    }
  }
`;

const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      orderCode
      orderType
      restaurantId
      totals {
        grandTotal
      }
      currentStatus
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
      orderCode
      restaurantId
      restaurantName
      tableId
      timeFrom
      durationMinutes
      partySize
      depositAmount
      depositStatus
      status
      pendingPaymentExpiresAt
      createdAt
    }
  }
`;

const CANCEL_RESERVATION = gql`
  mutation CancelReservation($id: ID!) {
    cancelReservation(id: $id) {
      id
      status
      updatedAt
    }
  }
`;

/* Helpers */
const fmtMoney = (v) =>
  typeof v === "number" ? v.toLocaleString("vi-VN") + "đ" : v;
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
  if (["dinein", "dine_in", "at_restaurant", "tại nhà hàng"].includes(v))
    return "dinein";
  return "dinein";
};

export default function OrdersPage() {
  const auth = useContext(AuthContext);
  const userId =
    auth?.user?.id ||
    auth?.currentUser?.id ||
    auth?.currentUserId ||
    auth?.me?.id ||
    null;

  const [activeTab, setActiveTab] = useState("all");
  const [toasts, setToasts] = useState([]);
  const pushToast = (text, type = "success") =>
    setToasts((t) => [
      ...t,
      { id: crypto?.randomUUID?.() || String(Math.random()), text, type },
    ]);
  const closeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const [modal, setModal] = useState({
    type: null,
    orderKey: null,
    payload: null,
  });

  const [cancelTarget, setCancelTarget] = useState(null); // { id, kind: 'order' | 'reservation' }
  const [changeTimeTarget, setChangeTimeTarget] = useState(null); // payload reservation
  const [qrBooking, setQrBooking] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null); // node order
  const [changeTableOpen, setChangeTableOpen] = useState(null);
  /* Queries */
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

  /* Mutations */
  const [createOrder, { loading: creatingOrder }] = useMutation(CREATE_ORDER, {
    onError: (e) => pushToast(`Lỗi tạo đơn: ${e.message}`, "error"),
    onCompleted: () => {
      pushToast("Tạo đơn thành công!", "success");
      refetchOrders?.();
    },
  });
  const [updateOrderStatusMutation, { loading: updatingStatus }] = useMutation(
    UPDATE_ORDER_STATUS,
    {
      onError: (e) =>
        pushToast(`Lỗi cập nhật trạng thái: ${e.message}`, "error"),
      onCompleted: () => {
        pushToast("Cập nhật trạng thái thành công", "success");
        refetchOrders?.();
      },
    }
  );
  const [cancelOrderMutation, { loading: cancelling }] = useMutation(
    CANCEL_ORDER,
    {
      onError: (e) => pushToast(`Lỗi hủy đơn: ${e.message}`, "error"),
      onCompleted: () => {
        pushToast("Đã hủy đơn hàng", "success");
        refetchOrders?.();
      },
    }
  );
  const [createReservation, { loading: creatingReservation }] = useMutation(
    CREATE_RESERVATION,
    {
      onError: (e) => pushToast(`Lỗi đặt bàn: ${e.message}`, "error"),
      onCompleted: () => {
        pushToast("Tạo đặt bàn mới thành công!", "success");
        refetchReservations?.();
      },
    }
  );

  const [cancelReservationMutation, { loading: cancellingReservation }] =
    useMutation(CANCEL_RESERVATION, {
      onError: (e) => pushToast(`Lỗi hủy đặt bàn: ${e.message}`, "error"),
      onCompleted: () => {
        pushToast("Đã hủy đặt bàn", "success");
        refetchReservations?.();
      },
    });

  /* Báo toast khi có lỗi tải dữ liệu */
  useEffect(() => {
    if (ordersError)
      pushToast(
        `Không tải được danh sách đơn: ${ordersError.message}`,
        "error"
      );
  }, [ordersError]);
  useEffect(() => {
    if (resvError)
      pushToast(`Không tải được đặt bàn: ${resvError.message}`, "error");
  }, [resvError]);

  /* Map data -> UI */
  const reservationItems = useMemo(() => {
    const arr = resvList?.myReservations || [];
    return arr.map((r) => ({
      kind: "reservation",
      key: r.id,
      status: (r.status || "").toLowerCase(),
      header: {
        id: `#${r.orderCode || r.id}`,
        restaurant: r.restaurantName || "Nhà hàng",
        timeText: `${new Date(r.timeFrom).toLocaleDateString(
          "vi-VN"
        )}, ${new Date(r.timeFrom).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })} • Thời lượng: ${r.durationMinutes} phút`,
      },
      summary: [
        { label: "Số người", value: `${r.partySize} người` },
        { label: "Tiền cọc", value: fmtMoney(r.depositAmount) },
        ...(r.status === "pending_payment" && r.pendingPaymentExpiresAt
          ? [{ label: "Còn lại", value: "(xem chi tiết)" }]
          : []),
      ],
      raw: r,
    }));
  }, [resvList]);

  const deliveryAndDineinItems = useMemo(() => {
    const edges = orderConn?.ordersByUser?.edges || [];
    const nodes = edges.map((e) => e.node).filter(Boolean);

    return nodes.map((o) => {
      const orderTypeNorm = normalizeOrderType(o.orderType);
      const itemsCount =
        o.items?.reduce((acc, it) => acc + (it.quantity || 0), 0) || 0;
      const total = o.totals?.grandTotal ?? 0;
      const deliveryTime =
        o.shipping?.deliveryTime ||
        (o.shipping?.scheduleTime
          ? `${o.shipping.scheduleDate || ""} ${o.shipping.scheduleTime}`.trim()
          : "—");

      return {
        kind: orderTypeNorm === "delivery" ? "delivery" : "dinein",
        key: o.id,
        status: (o.currentStatus || "").toLowerCase(),
        header: {
          id: `#${o.id}`,
          restaurant: o.restaurantId,
          timeText: `${toVNDateTime(o.createdAt)} • ${
            orderTypeNorm === "delivery" ? "Giao hàng" : "Tại nhà hàng"
          }`,
        },
        details: [
          { label: "Số món", value: `${itemsCount} món` },
          { label: "Tổng tiền", value: fmtMoney(total) },
          ...(orderTypeNorm === "delivery"
            ? [{ label: "Thời gian giao", value: deliveryTime }]
            : []),
        ],
        raw: o,
      };
    });
  }, [orderConn]);

  const allItems = useMemo(
    () => [...reservationItems, ...deliveryAndDineinItems],
    [reservationItems, deliveryAndDineinItems]
  );

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
      if (o.status === "cancelled") c.cancelled++;
      if (o.status === "completed") c.completed++;
    });
    return c;
  }, [allItems]);

  const visible = useMemo(
    () =>
      allItems.filter((o) => {
        switch (activeTab) {
          case "all":
            return true;
          case "reservation":
            return o.kind === "reservation";
          case "dinein":
            return o.kind === "dinein";
          case "delivery":
            return o.kind === "delivery";
          case "done_cancel":
            return ["cancelled", "completed"].includes(o.status);
          default:
            return true;
        }
      }),
    [allItems, activeTab]
  );

  /* Handlers + modal */
  const openOrderDetails = (key, payload) =>
    setModal({ type: "details", orderKey: key, payload });

  const closeModal = () =>
    setModal({ type: null, orderKey: null, payload: null });

  const reorder = (orderNode) => {
    if (!orderNode) return;
    const input = {
      orderCode: orderNode.orderCode || undefined,
      userId: userId || undefined,
      restaurantId: orderNode.restaurantId,
      reservationId: orderNode.reservationId || undefined,
      orderType: orderNode.orderType || "delivery",
      shipping: {
        fullName: orderNode.shipping?.fullName || undefined,
        phone: orderNode.shipping?.phone || undefined,
        email: orderNode.shipping?.email || undefined,
        address: orderNode.shipping?.address || undefined,
        note: orderNode.shipping?.note || undefined,
        deliveryMethod: orderNode.shipping?.deliveryMethod || undefined,
        deliveryTime: orderNode.shipping?.deliveryTime || undefined,
        scheduleDate: orderNode.shipping?.scheduleDate || undefined,
        scheduleTime: orderNode.shipping?.scheduleTime || undefined,
      },
      items: (orderNode.items || []).map((it) => ({
        dishId: it.dishId || undefined,
        menuId: it.menuId || undefined,
        categoryId: it.categoryId || undefined,
        name: it.name,
        unit: it.unit || undefined,
        image: it.image || undefined,
        price: it.price,
        modifiersPrice: it.modifiersPrice || 0,
        method: it.method || undefined,
        methodDelta: it.methodDelta || undefined,
        description: it.description || undefined,
        quantity: it.quantity,
        modifiers: (it.modifiers || []).map((m) => ({
          optionId: m.optionId || undefined,
          optionName: m.optionName,
          groupId: m.groupId || undefined,
          price: m.price || 0,
        })),
      })),
      note: orderNode.note || undefined,
      paymentMethod: orderNode?.payment?.method || "cod",
      customer: undefined,
    };
    createOrder({ variables: { input } });
  };

  const markOrderCompleted = (id) => {
    updateOrderStatusMutation({
      variables: {
        input: { id, status: "completed", note: "User marked as completed" },
      },
    });
  };

  const contactRestaurant = () =>
    pushToast("Đang kết nối với nhà hàng...", "success");
  const viewReceipt = (id) => {
    pushToast("Đang tải hóa đơn...", "success");
    markOrderCompleted(id);
  };
  const callShipper = () => pushToast("Đang kết nối với shipper...", "success");

  /* Loading / Error */
  const loading =
    !userId ||
    ordersLoading ||
    resvLoading ||
    creatingOrder ||
    updatingStatus ||
    cancelling ||
    creatingReservation ||
    cancellingReservation;

  const error = ordersError || resvError;

  return (
    <div className="orders-container">
      {/* Toasts */}
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={closeToast} />
      ))}

      <div className="page-header">
        <h1 className="page-title">
          <Icon name="receipt" size={28} style={{ marginRight: 8 }} />
          Đơn hàng của tôi
        </h1>
        <button
          className="btn btn-primary"
          onClick={() => (window.location.href = "#")}
        >
          ➕ Đặt món mới
        </button>
      </div>

      {/* Tabs */}
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
          🍽️ Đặt bàn ({counts.reservation})
        </button>
        <button
          className={`filter-tab ${activeTab === "dinein" ? "active" : ""}`}
          onClick={() => setActiveTab("dinein")}
        >
          🏬 Tại nhà hàng ({counts.dinein})
        </button>
        <button
          className={`filter-tab ${activeTab === "delivery" ? "active" : ""}`}
          onClick={() => setActiveTab("delivery")}
        >
          🚚 Giao tận nơi ({counts.delivery})
        </button>
        <button
          className={`filter-tab ${
            activeTab === "done_cancel" ? "active" : ""
          }`}
          onClick={() => setActiveTab("done_cancel")}
        >
          ✅/❌ Đã hủy/Hoàn tất ({counts.cancelled + counts.completed})
        </button>
      </div>

      {loading && <Skeleton rows={4} />}
      {!loading && error && (
        <div className="message message-error">
          Không tải được dữ liệu. Vui lòng thử lại.
        </div>
      )}

      <div id="ordersList" style={{ opacity: loading ? 0.6 : 1 }}>
        {visible.map((item) => (
          <OrderItem
            key={item.key}
            kind={item.kind}
            status={item.status}
            orderId={item.key}
            header={item.header}
            summary={item.summary}
            details={item.details}
            // Trong trường hợp OrderItem chưa forward onClick, vẫn có nút "Xem chi tiết" bên dưới
            onClick={() => openOrderDetails(item.key, item.raw)}
            actions={
              item.kind === "reservation"
                ? [
                    // điều hướng/đổi chỗ trước
                    {
                      icon: "clock",
                      label: "Đổi giờ",
                      variant: "secondary",
                      onClick: () => setChangeTimeTarget(item.raw),
                    },
                    {
                      icon: "mapPin",
                      label: "Đổi bàn",
                      variant: "secondary",
                      onClick: () => setChangeTableOpen(item.raw),
                    },
                    // xem chi tiết
                    {
                      icon: "eye",
                      label: "Xem chi tiết",
                      variant: "primary",
                      onClick: () => openOrderDetails(item.key, item.raw),
                    },
                    // ưu tiên CUỐI: thanh toán, hủy
                    {
                      icon: "creditCard",
                      label: "Thanh toán cọc",
                      variant: "success",
                      onClick: () =>
                        setQrBooking({
                          id: item.raw.id,
                          orderCode: item.raw.orderCode,
                          deposit: item.raw.depositAmount,
                        }),
                    },
                    {
                      icon: "x",
                      label: "Hủy đặt",
                      variant: "danger",
                      onClick: () =>
                        setCancelTarget({
                          id: item.key,
                          kind:
                            item.kind === "reservation"
                              ? "reservation"
                              : "order",
                        }),
                    },
                  ]
                : [
                    {
                      icon: "truck",
                      label: "Xem lộ trình",
                      variant: "primary",
                      onClick: () => setTrackingOrder(item.raw),
                    },
                    {
                      icon: "phone",
                      label: "Liên hệ nhà hàng",
                      variant: "secondary",
                      onClick: () => contactRestaurant(item.key),
                    },
                    {
                      icon: "eye",
                      label: "Xem chi tiết",
                      variant: "primary",
                      onClick: () => openOrderDetails(item.key, item.raw),
                    },
                    {
                      icon: "check",
                      label: "Đặt lại",
                      variant: "primary",
                      onClick: () => reorder(item.raw),
                    },
                    {
                      icon: "receipt",
                      label: "Xem hóa đơn",
                      variant: "secondary",
                      onClick: () => viewReceipt(item.key),
                    },
                    {
                      icon: "x",
                      label: "Hủy đơn",
                      variant: "danger",
                      onClick: () =>
                        setCancelTarget({
                          id: item.key,
                          kind:
                            item.kind === "reservation"
                              ? "reservation"
                              : "order",
                        }),
                    },
                  ]
            }
          />
        ))}
      </div>

      {/* Empty state */}
      {!loading && visible.length === 0 && (
        <div id="emptyState" className="empty-state">
          <div className="empty-icon">📋</div>
          <h3 className="empty-title">Không có đơn hàng nào</h3>
          <p className="empty-description">
            Bạn chưa có đơn hàng nào trong danh mục này.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => (window.location.href = "#")}
          >
            🍽️ Đặt món ngay
          </button>
        </div>
      )}

      {/* PAYMENT modal */}
      <QRPaymentModal
        isOpen={!!qrBooking}
        onClose={() => setQrBooking(null)}
        booking={qrBooking}
        onPaymentConfirmed={(rs) => {
          setQrBooking(null);
          pushToast("✅ Thanh toán thành công!", "success");
          refetchReservations?.();
        }}
      />

      {/* CHANGE TIME */}
      <ChangeTimeModal
        isOpen={!!changeTimeTarget}
        onClose={() => setChangeTimeTarget(null)}
        initialDate={
          changeTimeTarget?.timeFrom
            ? new Date(changeTimeTarget.timeFrom).toISOString().slice(0, 10)
            : undefined
        }
        initialTime={
          changeTimeTarget?.timeFrom
            ? new Date(changeTimeTarget.timeFrom).toTimeString().slice(0, 5)
            : "19:30"
        }
        onSubmit={({ iso }) => {
          if (!changeTimeTarget) return;
          // theo nghiệp vụ bạn: tạo reservation mới thay vì update
          createReservation({
            variables: {
              input: {
                restaurantId: changeTimeTarget.restaurantId,
                tableId: changeTimeTarget.tableId,
                timeFrom: iso,
                durationMinutes: changeTimeTarget.durationMinutes || 90,
                partySize: changeTimeTarget.partySize || 2,
                note: changeTimeTarget.note || undefined,
                restaurantName: changeTimeTarget.restaurantName || undefined,
                customerName: changeTimeTarget.customerName || undefined,
                customerPhone: changeTimeTarget.customerPhone || undefined,
                customerEmail: changeTimeTarget.customerEmail || undefined,
                depositAmount: changeTimeTarget.depositAmount || undefined,
              },
            },
          }).finally(() => setChangeTimeTarget(null));
        }}
      />

      {/* CHANGE TABLE */}

      {/* TRACKING */}

      {/*Cancel Order*/}

      <CancelOrderModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={
          cancelTarget?.kind === "reservation"
            ? "❌ Hủy đặt bàn"
            : "❌ Hủy đơn hàng"
        }
        onConfirm={({ reason, note }) => {
          if (!cancelTarget) return;
          if (cancelTarget.kind === "reservation") {
            // hủy reservation
            cancelReservationMutation({
              variables: { id: cancelTarget.id },
            }).finally(() => setCancelTarget(null));
          } else {
            // hủy order món
            cancelOrderMutation({
              variables: { id: cancelTarget.id, reason: note || reason },
            }).finally(() => setCancelTarget(null));
          }
        }}
      />
      <TrackingModal
        isOpen={!!trackingOrder}
        onClose={() => setTrackingOrder(null)}
        order={trackingOrder}
        onCallShipper={() => {
          pushToast("Đang kết nối với shipper...", "success");
        }}
      />

      <ChangeTableModal
        isOpen={!!changeTableOpen}
        onClose={() => setChangeTableOpen(null)}
        currentReservation={changeTableOpen}
        restaurants={
          // truyền list của bạn; ví dụ ghép từ context:
          (auth?.restaurants || []).map((r) => ({ id: r.id, name: r.name }))
        }
        tablesByRestaurant={{
          // tạm thời mock theo restaurantId hiện tại để thấy UI
          [changeTableOpen?.restaurantId || ""]: [
            {
              id: "t1",
              name: "Bàn 8",
              capacity: 4,
              deposit: 100000,
              floor: "Tầng 1",
            },
            {
              id: "t2",
              name: "Bàn 12",
              capacity: 6,
              deposit: 150000,
              floor: "Tầng 2",
            },
          ],
        }}
        onSubmit={({ restaurantId, tableId }) => {
          // Nếu khác nhà hàng => hiển thị toast trừ 50% cọc (server sẽ xử lý logic)
          if (restaurantId !== changeTableOpen?.restaurantId) {
            pushToast(
              "Đổi sang nhà hàng khác: sẽ khấu trừ 50% cọc hiện tại.",
              "warning"
            );
          } else {
            pushToast(
              "Yêu cầu đổi bàn đã gửi. Vui lòng đợi nhà hàng xác nhận.",
              "success"
            );
          }

          setChangeTableOpen(null);
        }}
      />
    </div>
  );
}
