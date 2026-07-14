import React, { useEffect } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  CalendarClock,
  Eye,
  PackageCheck,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import {
  formatFutureOrderDate,
  getFutureOrderItemCount,
  getFutureOrderSchedule,
  sortFutureOrders,
} from "./futureOrderUtils";
import "./FutureOrdersModal.scss";

const FUTURE_RESERVATION_ORDERS = gql`
  query FutureReservationOrders($restaurantId: ID!, $limit: Int) {
    futureReservationOrders(restaurantId: $restaurantId, limit: $limit) {
      id
      orderCode
      reservationId
      tableCode
      currentStatus
      orderType
      createdAt
      customerInfo {
        name
        phone
        email
        note
        partySize
        timeTo
      }
      user {
        id
        fullName
        phone
        email
      }
      items {
        _id
        name
        quantity
        unit
        unitPrice
        lineSubtotal
        status
      }
      totals {
        subtotal
        discount
        grandTotal
      }
      payment {
        status
      }
      clientMeta
    }
  }
`;

const formatCurrency = (value) =>
  `${Math.max(0, Number(value || 0)).toLocaleString("vi-VN")} đ`;

const getReservationStatusLabel = (order) => {
  const status = String(order?.clientMeta?.reservationStatus || "confirmed");
  const labels = {
    confirmed: "Đã xác nhận",
    pending_change: "Đang chờ thay đổi",
    pending_payment: "Chờ thanh toán cọc",
    seated: "Đã nhận bàn",
  };
  return labels[status] || status;
};

export default function FutureOrdersModal({
  open,
  restaurantId,
  onClose,
  onViewOrder,
}) {
  const { data, loading, error, refetch } = useQuery(
    FUTURE_RESERVATION_ORDERS,
    {
      variables: { restaurantId, limit: 200 },
      skip: !open || !restaurantId,
      fetchPolicy: "network-only",
      notifyOnNetworkStatusChange: true,
      pollInterval: open ? 30000 : 0,
    },
  );

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const orders = sortFutureOrders(data?.futureReservationOrders || []);

  return (
    <div
      className="future-orders-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="future-orders-title"
    >
      <button
        type="button"
        className="future-orders-modal__backdrop"
        onClick={onClose}
        aria-label="Đóng danh sách order trước"
      />

      <section className="future-orders-modal__panel">
        <header className="future-orders-modal__header">
          <div className="future-orders-modal__heading">
            <span className="future-orders-modal__icon" aria-hidden="true">
              <CalendarClock size={22} />
            </span>
            <div>
              <span className="future-orders-modal__eyebrow">LỊCH ĐẶT MÓN</span>
              <h2 id="future-orders-title">Order trước</h2>
              <p>
                Các món đặt cho thời điểm trong tương lai. Những món này chưa
                được đưa vào POS hoặc màn hình bếp cho đến khi tới giờ.
              </p>
            </div>
          </div>
          <div className="future-orders-modal__header-actions">
            <button
              type="button"
              className="future-orders-modal__refresh"
              onClick={() => void refetch()}
              disabled={loading || !restaurantId}
            >
              <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
              Làm mới
            </button>
            <button
              type="button"
              className="future-orders-modal__close"
              onClick={onClose}
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="future-orders-modal__summary" aria-live="polite">
          <span>
            <PackageCheck size={16} />
            <strong>{orders.length.toLocaleString("vi-VN")}</strong> order chưa
            tới giờ
          </span>
          <small>
            Danh sách tự cập nhật mỗi 30 giây và tự rời khỏi đây khi tới giờ.
          </small>
        </div>

        <div className="future-orders-modal__body">
          {loading && !data ? (
            <div className="future-orders-modal__state">
              <RefreshCw size={30} className="is-spinning" />
              <strong>Đang tải order trước...</strong>
            </div>
          ) : error ? (
            <div className="future-orders-modal__state future-orders-modal__state--error">
              <strong>Không tải được order trước</strong>
              <p>{error.message}</p>
              <button type="button" onClick={() => void refetch()}>
                Thử lại
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="future-orders-modal__state">
              <CalendarClock size={38} />
              <strong>Chưa có order nào ở tương lai</strong>
              <p>Order đặt trước mới sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="future-orders-modal__list">
              {orders.map((order) => {
                const schedule = getFutureOrderSchedule(order);
                const customerName =
                  order?.customerInfo?.name ||
                  order?.user?.fullName ||
                  "Khách chưa ghi tên";
                const itemCount = getFutureOrderItemCount(order);

                return (
                  <article className="future-order-card" key={order.id}>
                    <div className="future-order-card__time">
                      <CalendarClock size={18} />
                      <div>
                        <span>Thời gian phục vụ</span>
                        <strong>{formatFutureOrderDate(schedule)}</strong>
                      </div>
                    </div>

                    <div className="future-order-card__main">
                      <div className="future-order-card__topline">
                        <div>
                          <span className="future-order-card__code">
                            {order.orderCode || order.id}
                          </span>
                          <span className="future-order-card__table">
                            Bàn {order.tableCode || "chưa xác định"}
                          </span>
                        </div>
                        <span className="future-order-card__status">
                          {getReservationStatusLabel(order)}
                        </span>
                      </div>

                      <div className="future-order-card__customer">
                        <Users size={15} />
                        <strong>{customerName}</strong>
                        {order?.customerInfo?.partySize ? (
                          <span>· {order.customerInfo.partySize} khách</span>
                        ) : null}
                        {order?.customerInfo?.phone ? (
                          <span>· {order.customerInfo.phone}</span>
                        ) : null}
                      </div>

                      <div className="future-order-card__items">
                        {(order.items || []).slice(0, 4).map((item) => (
                          <span key={item._id || `${item.name}-${item.quantity}`}>
                            {item.name} × {Number(item.quantity || 0)}
                            {item.unit && item.unit !== "portion"
                              ? ` ${item.unit}`
                              : ""}
                          </span>
                        ))}
                        {(order.items || []).length > 4 ? (
                          <span>+{order.items.length - 4} món khác</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="future-order-card__footer">
                      <span>
                        {itemCount.toLocaleString("vi-VN")} món · Tổng dự kiến
                      </span>
                      <strong>{formatCurrency(order?.totals?.grandTotal)}</strong>
                      <button
                        type="button"
                        onClick={() => onViewOrder?.(order.id)}
                      >
                        <Eye size={16} />
                        Xem chi tiết
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
