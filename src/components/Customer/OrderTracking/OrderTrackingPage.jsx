// src/pages/OrderTrackingPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { GET_ORDER_TRACKING } from "./queries/orderTracking.queries";
import useSocketDeliveryTracking from "../../../hooks/useSocketDeliveryTracking";
import OrderTrackingMap from "./components/OrderTrackingMap";
import "./orderTracking.scss";

const GET_ORDER_ITEMS_FOR_TRACKING = gql`
  query GetOrderItemsForTracking($id: ID!) {
    order(id: $id) {
      id
      restaurantId
      orderCode
      items {
        _id
        name
        quantity
        proofImages
      }
    }
  }
`;

const PROGRESS_STEPS = [
  { label: "Nhận đơn", statuses: ["driver_assigned", "preparing", "picked_up", "on_the_way", "arriving", "delivered"] },
  { label: "Chuẩn bị", statuses: ["preparing", "picked_up", "on_the_way", "arriving", "delivered"] },
  { label: "Đã lấy hàng", statuses: ["picked_up", "on_the_way", "arriving", "delivered"] },
  { label: "Đang giao", statuses: ["on_the_way", "arriving", "delivered"] },
  { label: "Hoàn tất", statuses: ["delivered"] },
];

function mapStatusLabel(status) {
  if (!status) return "Đang xử lý";
  const map = {
    pending: "Đang chờ tài xế",
    driver_assigned: "Đã có tài xế nhận đơn",
    preparing: "Nhà hàng đang chuẩn bị món",
    picked_up: "Tài xế đã lấy hàng",
    on_the_way: "Tài xế đang giao đến bạn",
    arriving: "Tài xế sắp đến nơi",
    delivered: "Đơn hàng đã giao xong",
    cancelled: "Đơn hàng đã bị huỷ",
  };
  return map[status] || status;
}

function formatTimeString(s) {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function TrackingState({ title, message, role = "status", children }) {
  return (
    <main className="ot-page" aria-labelledby="order-tracking-state-title">
      <div className="ot-page-inner" role={role} aria-live={role === "alert" ? "assertive" : "polite"}>
        <h2 id="order-tracking-state-title">{title}</h2>
        {message && <p>{message}</p>}
        {children}
      </div>
    </main>
  );
}

function TrackingActions({ ordersLabel = "Quay lại đơn hàng của tôi" }) {
  return (
    <div className="ot-actions">
      <Link to="/orders" className="ot-btn">{ordersLabel}</Link>
      <Link to="/" className="ot-btn">Tiếp tục xem món</Link>
    </div>
  );
}

export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get("restaurantId");
  const initialOrderCode = searchParams.get("orderCode") || "";

  const [orderCode, setOrderCode] = useState(initialOrderCode);
  const [resolvedRestaurantId, setResolvedRestaurantId] = useState(restaurantId || "");
  const [deliveryStatus, setDeliveryStatus] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [etaInfo, setEtaInfo] = useState(null);
  const [events, setEvents] = useState([]);

  const { data, loading, error } = useQuery(GET_ORDER_TRACKING, {
    skip: !orderId || !resolvedRestaurantId,
    variables: { orderId, restaurantId: resolvedRestaurantId },
    fetchPolicy: "cache-and-network",
  });

  const {
    data: orderData,
    loading: orderLookupLoading,
    error: orderLookupError,
  } = useQuery(GET_ORDER_ITEMS_FOR_TRACKING, {
    skip: !orderId,
    variables: { id: orderId },
    fetchPolicy: "cache-and-network",
  });

  const needsRestaurantResolution = Boolean(
    orderId && !restaurantId && !resolvedRestaurantId
  );
  const isResolvingRestaurant = needsRestaurantResolution && orderLookupLoading;
  const cannotResolveRestaurant =
    Boolean(orderId) &&
    !resolvedRestaurantId &&
    !orderLookupLoading &&
    (!orderData?.order?.restaurantId || orderLookupError);

  useEffect(() => {
    if (restaurantId) {
      setResolvedRestaurantId(restaurantId);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!resolvedRestaurantId && orderData?.order?.restaurantId) {
      setResolvedRestaurantId(orderData.order.restaurantId);
    }
  }, [orderData, resolvedRestaurantId]);

  useEffect(() => {
    if (!orderCode && orderData?.order?.orderCode) {
      setOrderCode(orderData.order.orderCode);
    }
  }, [orderCode, orderData]);

  // Sync data lần đầu từ GraphQL
  useEffect(() => {
    if (!data?.getOrderTracking) return;
    const t = data.getOrderTracking;

    setDeliveryStatus(t.deliveryStatus || "pending");
    setDriverLocation(t.driverLocation || null);
    setEtaInfo({
      eta: t.eta || null,
      distance: t.distance,
      duration: t.duration,
    });
    setEvents(t.events || []);
    if (!orderCode && t.orderCode) setOrderCode(t.orderCode);
  }, [data, orderCode]);

  // Socket realtime theo orderCode
  useSocketDeliveryTracking(orderCode, {
    onDriverAssigned: (evt) => {
      const { meta } = evt;
      setDeliveryStatus(meta?.statusTo || "driver_assigned");
      setDriverInfo({
        name: meta?.driverName,
        phone: meta?.driverPhone,
        vehiclePlate: meta?.driverVehiclePlate,
      });
      setEvents((prev) => [
        {
          id: `driver_assigned_${Date.now()}`,
          type: "DELIVERY_DRIVER_ASSIGNED",
          message: "Đã có tài xế nhận đơn của bạn",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    onStatusUpdated: (evt) => {
      const { meta } = evt;
      const newStatus = meta?.statusTo || meta?.status || "pending";
      setDeliveryStatus(newStatus);
      setEvents((prev) => [
        {
          id: `status_${Date.now()}`,
          type: "DELIVERY_STATUS_UPDATED",
          message: `Trạng thái đơn hàng: ${mapStatusLabel(newStatus)}`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    onLocationUpdated: (evt) => {
      const loc = evt?.meta?.driverLocation;
      if (loc) {
        setDriverLocation(loc);
      }
    },
    onETAUpdated: (evt) => {
      const { meta } = evt;
      setEtaInfo({
        eta: meta?.eta || null,
        distance: meta?.distance,
        duration: meta?.duration,
      });
      setEvents((prev) => [
        {
          id: `eta_${Date.now()}`,
          type: "DELIVERY_ETA_UPDATED",
          message: "Thời gian dự kiến giao hàng đã được cập nhật",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
  });

  const tracking = data?.getOrderTracking;
  const statusLabel = mapStatusLabel(deliveryStatus);

  const items = useMemo(() => {
    const rows = orderData?.order?.items || [];
    return rows.map((it) => ({
      _id: it._id,
      name: it.name,
      quantity: Number(it.quantity || 1),
      proofImages: Array.isArray(it.proofImages) ? it.proofImages.filter(Boolean) : [],
    }));
  }, [orderData]);

  const activeStepIndex = useMemo(() => {
    const index = PROGRESS_STEPS.findLastIndex((step) => step.statuses.includes(deliveryStatus));
    return Math.max(index, 0);
  }, [deliveryStatus]);

  const driverCard = useMemo(() => {
    const info =
      driverInfo ||
      (() => {
        const ev = tracking?.events?.find(
          (e) =>
            e.type === "shipping_updated" ||
            e.type === "status_changed" ||
            e.type === "DELIVERY_DRIVER_ASSIGNED"
        );
        const d = ev?.data || {};
        if (!d.driverName && !d.driverPhone) return null;
        return {
          name: d.driverName,
          phone: d.driverPhone,
          vehiclePlate: d.driverVehiclePlate,
        };
      })();

    if (!info) return null;

    return (
      <article className="ot-card ot-driver-card" aria-label="Thông tin tài xế giao hàng">
        <div className="ot-driver-avatar" aria-hidden="true">🛵</div>
        <div className="ot-driver-info">
          <div className="ot-driver-name">{info.name || "Tài xế"}</div>
          {info.phone && <div className="ot-driver-phone">📞 {info.phone}</div>}
          {info.vehiclePlate && (
            <div className="ot-driver-plate">🚗 {info.vehiclePlate}</div>
          )}
        </div>
      </article>
    );
  }, [driverInfo, tracking]);

  if (!orderId) {
    return (
      <TrackingState
        title="Không tìm thấy thông tin đơn hàng"
        message="Không đủ thông tin theo dõi đơn. Vui lòng mở từ danh sách đơn hàng."
        role="alert"
      >
        <TrackingActions />
      </TrackingState>
    );
  }

  if (isResolvingRestaurant) {
    return (
      <TrackingState
        title="Đang tải trạng thái đơn hàng..."
        message="Đang kiểm tra thông tin nhà hàng của đơn..."
      />
    );
  }

  if (cannotResolveRestaurant) {
    return (
      <TrackingState
        title="Không tìm thấy thông tin đơn hàng"
        message={orderLookupError?.message || "Không đủ thông tin theo dõi đơn. Vui lòng mở từ danh sách đơn hàng."}
        role="alert"
      >
        <TrackingActions ordersLabel="Quay lại danh sách đơn hàng" />
      </TrackingState>
    );
  }

  if (loading && !tracking) {
    return (
      <TrackingState
        title="Đang tải thông tin đơn hàng..."
        message="Đang tải trạng thái đơn hàng..."
      />
    );
  }

  if (error) {
    return (
      <TrackingState title="Có lỗi xảy ra" message={error.message} role="alert">
        <TrackingActions />
      </TrackingState>
    );
  }

  return (
    <main className="ot-page" aria-labelledby="order-tracking-title">
      <div className="ot-page-inner">
        <header className="ot-header" aria-labelledby="order-tracking-title">
          <div className="ot-header-main">
            <h1 className="ot-title" id="order-tracking-title">{statusLabel}</h1>
            {tracking?.orderCode && (
              <div className="ot-order-code">
                Mã đơn: <strong>{tracking.orderCode}</strong>
              </div>
            )}
          </div>

          <div className="ot-progress" role="list" aria-label="Tiến trình giao hàng">
            {PROGRESS_STEPS.map((step, index) => {
              const isActive = step.statuses.includes(deliveryStatus);
              const isCurrent = index === activeStepIndex;
              return (
                <div
                  key={step.label}
                  className={`ot-progress-step ${isActive ? "active" : ""}`}
                  role="listitem"
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${step.label}${isActive ? " đã hoàn thành hoặc đang xử lý" : " chưa đến bước này"}`}
                >
                  {step.label}
                </div>
              );
            })}
          </div>
        </header>

        <section className="ot-section" aria-label="Bản đồ theo dõi giao hàng">
          <OrderTrackingMap
            driverLocation={driverLocation}
            customerLocation={tracking?.customerLocation}
            restaurantLocation={tracking?.restaurantLocation}
          />
        </section>

        {driverCard}

        <section className="ot-section" aria-labelledby="order-tracking-eta-title" aria-live="polite">
          <div className="ot-card ot-eta-card">
            <h2 id="order-tracking-eta-title">Thời gian dự kiến</h2>
            <div className="ot-eta-main">
              <div className="ot-eta-time">
                {etaInfo?.eta
                  ? formatTimeString(etaInfo.eta)
                  : "Đang cập nhật..."}
              </div>
              {etaInfo?.distance && (
                <div className="ot-eta-meta">
                  Khoảng cách còn lại: {Math.round(etaInfo.distance / 100) / 10}{" "}
                  km
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="ot-section" aria-labelledby="order-tracking-items-title">
          <div className="ot-card ot-order-card">
            <h2 id="order-tracking-items-title">Chi tiết đơn hàng</h2>
            {items.length ? (
              <ul className="ot-order-items">
                {items.map((item) => (
                  <li key={item._id || item.name} className="ot-order-item">
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    {item.proofImages?.length > 0 && (
                      <div className="ot-order-proofs" aria-label={`Ảnh xác nhận món ${item.name}`}>
                        {item.proofImages.map((src, idx) => (
                          <img key={`${src}_${idx}`} src={src} alt={`Ảnh xác nhận ${item.name} ${idx + 1}`} />
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">Chưa có dữ liệu món trong đơn.</p>
            )}
          </div>
        </section>

        <section className="ot-section" aria-labelledby="order-tracking-timeline-title">
          <div className="ot-card ot-timeline-card">
            <h2 id="order-tracking-timeline-title">Lịch sử cập nhật</h2>
            {events?.length ? (
              <ul className="ot-timeline" aria-live="polite">
                {events.map((e) => (
                  <li key={e.id} className="ot-timeline-item">
                    <div className="ot-timeline-dot" aria-hidden="true" />
                    <div className="ot-timeline-body">
                      <div className="ot-timeline-message">
                        {e.message || e.type}
                      </div>
                      <time className="ot-timeline-time" dateTime={e.createdAt}>
                        {formatTimeString(e.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">Chưa có cập nhật nào.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
