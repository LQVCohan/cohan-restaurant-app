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
      <div className="ot-card ot-driver-card">
        <div className="ot-driver-avatar">🛵</div>
        <div className="ot-driver-info">
          <div className="ot-driver-name">{info.name}</div>
          {info.phone && <div className="ot-driver-phone">📞 {info.phone}</div>}
          {info.vehiclePlate && (
            <div className="ot-driver-plate">🚗 {info.vehiclePlate}</div>
          )}
        </div>
      </div>
    );
  }, [driverInfo, tracking]);

  if (!orderId) {
    return (
      <div className="ot-page">
        <div className="ot-page-inner">
          <h2>Không tìm thấy thông tin đơn hàng</h2>
          <p>Không đủ thông tin theo dõi đơn. Vui lòng mở từ danh sách đơn hàng.</p>
          <div className="ot-actions" style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <Link to="/orders" className="ot-btn">Quay lại đơn hàng của tôi</Link>
            <Link to="/" className="ot-btn">Tiếp tục xem món</Link>
          </div>
        </div>
      </div>
    );
  }

  if (isResolvingRestaurant) {
    return (
      <div className="ot-page">
        <div className="ot-page-inner">
          <h2>Đang tải trạng thái đơn hàng...</h2>
          <p>Đang kiểm tra thông tin nhà hàng của đơn...</p>
        </div>
      </div>
    );
  }

  if (cannotResolveRestaurant) {
    return (
      <div className="ot-page">
        <div className="ot-page-inner">
          <h2>Không tìm thấy thông tin đơn hàng</h2>
          {orderLookupError ? (
            <>
              <p>Không thể kiểm tra thông tin đơn hàng.</p>
              {orderLookupError?.message && <p>{orderLookupError.message}</p>}
            </>
          ) : (
            <p>Không đủ thông tin theo dõi đơn. Vui lòng mở từ danh sách đơn hàng.</p>
          )}
          <div className="ot-actions" style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <Link to="/orders" className="ot-btn">Quay lại danh sách đơn hàng</Link>
            <Link to="/" className="ot-btn">Tiếp tục xem món</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !tracking) {
    return (
      <div className="ot-page">
        <div className="ot-page-inner">
          <h2>Đang tải thông tin đơn hàng...</h2>
          <p>Đang tải trạng thái đơn hàng...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ot-page">
        <div className="ot-page-inner">
          <h2>Có lỗi xảy ra</h2>
          <p>{error.message}</p>
          <div className="ot-actions" style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <Link to="/orders" className="ot-btn">Quay lại đơn hàng của tôi</Link>
            <Link to="/" className="ot-btn">Tiếp tục xem món</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ot-page">
      <div className="ot-page-inner">
        {/* HEADER */}
        <header className="ot-header">
          <div className="ot-header-main">
            <h1 className="ot-title">{statusLabel}</h1>
            {tracking?.orderCode && (
              <div className="ot-order-code">
                Mã đơn: <strong>{tracking.orderCode}</strong>
              </div>
            )}
          </div>

          <div className="ot-progress">
            <div
              className={`ot-progress-step ${
                deliveryStatus && deliveryStatus !== "pending" ? "active" : ""
              }`}
            >
              Nhận đơn
            </div>
            <div
              className={`ot-progress-step ${
                [
                  "preparing",
                  "picked_up",
                  "on_the_way",
                  "arriving",
                  "delivered",
                ].includes(deliveryStatus)
                  ? "active"
                  : ""
              }`}
            >
              Chuẩn bị
            </div>
            <div
              className={`ot-progress-step ${
                ["picked_up", "on_the_way", "arriving", "delivered"].includes(
                  deliveryStatus
                )
                  ? "active"
                  : ""
              }`}
            >
              Đã lấy hàng
            </div>
            <div
              className={`ot-progress-step ${
                ["on_the_way", "arriving", "delivered"].includes(deliveryStatus)
                  ? "active"
                  : ""
              }`}
            >
              Đang giao
            </div>
            <div
              className={`ot-progress-step ${
                deliveryStatus === "delivered" ? "active" : ""
              }`}
            >
              Hoàn tất
            </div>
          </div>
        </header>

        {/* MAP */}
        <section className="ot-section">
          <OrderTrackingMap
            driverLocation={driverLocation}
            customerLocation={tracking?.customerLocation}
            restaurantLocation={tracking?.restaurantLocation}
          />
        </section>

        {/* DRIVER */}
        {driverCard}

        {/* ETA */}
        <section className="ot-section">
          <div className="ot-card ot-eta-card">
            <h3>Thời gian dự kiến</h3>
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

        {/* ORDER SUMMARY */}
        <section className="ot-section">
          <div className="ot-card ot-order-card">
            <h3>Chi tiết đơn hàng</h3>
            <ul className="ot-order-items">
              {items.map((item) => (
                <li key={item._id || item.name} className="ot-order-item">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  {item.proofImages?.length > 0 && (
                    <div className="ot-order-proofs">
                      {item.proofImages.map((src, idx) => (
                        <img key={`${src}_${idx}`} src={src} alt={`${item.name}-${idx}`} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* TIMELINE */}
        <section className="ot-section">
          <div className="ot-card ot-timeline-card">
            <h3>Lịch sử cập nhật</h3>
            {events?.length ? (
              <ul className="ot-timeline">
                {events.map((e) => (
                  <li key={e.id} className="ot-timeline-item">
                    <div className="ot-timeline-dot" />
                    <div className="ot-timeline-body">
                      <div className="ot-timeline-message">
                        {e.message || e.type}
                      </div>
                      <div className="ot-timeline-time">
                        {formatTimeString(e.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Chưa có cập nhật nào.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
