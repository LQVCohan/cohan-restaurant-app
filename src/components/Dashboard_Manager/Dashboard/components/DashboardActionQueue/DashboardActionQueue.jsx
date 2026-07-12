import React, { useState } from "react";
import {
  CalendarClock,
  ClipboardList,
  ShoppingBag,
  X,
} from "lucide-react";
import "./DashboardActionQueuePolish.scss";

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value) => {
  if (!value) return "Chưa có thời gian";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Chưa có thời gian";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}, ${hour}:${minute}`;
};

const getQueueAge = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (elapsedMinutes < 15) {
    return { label: "Mới nhận", tone: "new" };
  }
  if (elapsedMinutes < 60) {
    return { label: `Chờ ${elapsedMinutes} phút`, tone: "waiting" };
  }
  if (elapsedMinutes < 1440) {
    return {
      label: `Quá hạn ${Math.floor(elapsedMinutes / 60)} giờ`,
      tone: "overdue",
    };
  }

  return {
    label: `Quá hạn ${Math.floor(elapsedMinutes / 1440)} ngày`,
    tone: "overdue",
  };
};

const ORDER_TYPE_LABELS = {
  DINE_IN: "Dùng tại bàn",
  TAKEAWAY: "Mang đi",
  DELIVERY: "Giao hàng",
  PICKUP: "Nhận tại quầy",
  dine_in: "Dùng tại bàn",
  takeaway: "Mang đi",
  delivery: "Giao hàng",
  pickup: "Nhận tại quầy",
};

const DEPOSIT_STATUS_LABELS = {
  PENDING: "Chờ xác nhận",
  PAID: "Đã đặt cọc",
  UNPAID: "Chưa đặt cọc",
  REFUNDED: "Đã hoàn cọc",
  pending: "Chờ xác nhận",
  paid: "Đã đặt cọc",
  unpaid: "Chưa đặt cọc",
  refunded: "Đã hoàn cọc",
};

const itemSummary = (items = []) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) return "Chưa có thông tin món";
  return (
    safeItems.slice(0, 3).join(", ") +
    (safeItems.length > 3 ? ` và ${safeItems.length - 3} món khác` : "")
  );
};

function ReasonModal({
  title,
  placeholder,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="dashboard-modal-backdrop" role="presentation">
      <div
        className="dashboard-reason-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-reason-title"
      >
        <div className="dashboard-reason-modal__head">
          <h3 id="dashboard-reason-title">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            disabled={busy}
          >
            <X size={16} />
          </button>
        </div>
        <textarea
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={placeholder}
          rows={4}
        />
        <div className="dashboard-reason-modal__actions">
          <button
            type="button"
            className="queue-btn queue-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Quay lại
          </button>
          <button
            type="button"
            className="queue-btn queue-btn--danger"
            onClick={() => onConfirm(reason.trim())}
            disabled={busy || !reason.trim()}
          >
            {busy ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardActionQueue({
  orders = [],
  reservations = [],
  counts = {},
  loading,
  error,
  busyKey,
  onConfirmOrder,
  onRejectOrder,
  onConfirmReservation,
  onCancelReservation,
  onOpenOrders,
  onOpenTables,
}) {
  const [rejectTarget, setRejectTarget] = useState(null);
  const orderCount = Number(counts.orders || orders.length || 0);
  const reservationCount = Number(
    counts.reservations || reservations.length || 0,
  );
  const totalCount = orderCount + reservationCount;
  const hasOrders = orders.length > 0;
  const hasReservations = reservations.length > 0;
  const empty = !loading && !error && !hasOrders && !hasReservations;
  const singleSection = hasOrders !== hasReservations;
  const rejectBusy =
    rejectTarget && busyKey === `order-reject:${rejectTarget.id}`;

  const cardClassName = [
    "dashboard-card",
    "dashboard-card--action-queue",
    totalCount > 0 ? "dashboard-card--action-queue-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const sectionsClassName = [
    "dashboard-queue-sections",
    singleSection ? "dashboard-queue-sections--single" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClassName}>
      <div className="dashboard-card__head dashboard-action-queue__head">
        <div>
          <h3>Yêu cầu chờ xác nhận</h3>
          <p>Ưu tiên yêu cầu chờ lâu, không phụ thuộc bộ lọc thời gian.</p>
        </div>
        <div
          className="dashboard-queue-summary"
          aria-label="Tổng yêu cầu chờ xác nhận"
        >
          {loading ? (
            <span className="queue-summary-chip queue-summary-chip--loading">
              <ClipboardList size={14} aria-hidden="true" />
              Đang tải
            </span>
          ) : (
            <>
              <span
                className={`queue-summary-chip ${orderCount ? "is-active" : ""}`}
              >
                <ShoppingBag size={14} aria-hidden="true" />
                <strong>{orderCount}</strong>
                <span>đơn món</span>
              </span>
              <span
                className={`queue-summary-chip ${reservationCount ? "is-active" : ""}`}
              >
                <CalendarClock size={14} aria-hidden="true" />
                <strong>{reservationCount}</strong>
                <span>đặt bàn</span>
              </span>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--loading">
          <h4>Đang tải yêu cầu chờ xác nhận</h4>
          <p>Hệ thống đang kiểm tra đơn hàng và yêu cầu đặt bàn mới.</p>
        </div>
      ) : error ? (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--error">
          <h4>Không thể tải yêu cầu chờ xác nhận</h4>
          <p>{error?.message || "Vui lòng làm mới trang và thử lại."}</p>
        </div>
      ) : empty ? (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--healthy">
          <h4>Không có yêu cầu nào đang chờ</h4>
          <p>Đơn đặt món và đặt bàn mới sẽ hiển thị tại đây.</p>
        </div>
      ) : (
        <div className={sectionsClassName}>
          {hasOrders ? (
            <section
              className="dashboard-queue-section"
              aria-labelledby="pending-orders-title"
            >
              <div className="dashboard-queue-section__head">
                <ShoppingBag size={15} aria-hidden="true" />
                <h4 id="pending-orders-title">Đơn đặt món</h4>
              </div>
              <div
                className="dashboard-queue-section__list"
                role="list"
                aria-label="Đơn hàng chờ xác nhận"
              >
                {orders.map((order) => {
                  const orderType =
                    ORDER_TYPE_LABELS[order.orderType] ||
                    order.orderType ||
                    "Chưa xác định hình thức";
                  const queueAge = getQueueAge(order.createdAt);

                  return (
                    <div
                      className="dashboard-queue-item"
                      key={order.id}
                      role="listitem"
                    >
                      <div className="dashboard-queue-item__main">
                        <div className="dashboard-queue-item__title-row">
                          <strong>#{order.orderCode || order.id}</strong>
                          {queueAge ? (
                            <span
                              className={`queue-age queue-age--${queueAge.tone}`}
                            >
                              {queueAge.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="dashboard-queue-item__context">
                          {orderType}
                          {order.tableCode ? ` • Bàn ${order.tableCode}` : ""}
                          {order.customerName ? ` • ${order.customerName}` : ""}
                        </p>
                        <div className="dashboard-queue-item__facts">
                          <span className="queue-fact queue-fact--strong">
                            {formatCurrency(order.total)}
                          </span>
                          <span className="queue-fact">
                            {formatDateTime(order.createdAt)}
                          </span>
                        </div>
                        <em className="dashboard-queue-item__detail">
                          {itemSummary(order.itemNames)}
                        </em>
                      </div>
                      <div className="dashboard-queue-item__actions">
                        <button
                          type="button"
                          className="queue-btn queue-btn--primary"
                          disabled={Boolean(busyKey)}
                          aria-busy={busyKey === `order-confirm:${order.id}`}
                          onClick={() => onConfirmOrder?.(order)}
                        >
                          {busyKey === `order-confirm:${order.id}`
                            ? "Đang xác nhận..."
                            : "Xác nhận"}
                        </button>
                        <button
                          type="button"
                          className="queue-btn queue-btn--danger"
                          disabled={Boolean(busyKey)}
                          onClick={() => setRejectTarget(order)}
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          className="queue-btn queue-btn--ghost"
                          onClick={onOpenOrders}
                        >
                          Chi tiết
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {hasReservations ? (
            <section
              className="dashboard-queue-section"
              aria-labelledby="pending-reservations-title"
            >
              <div className="dashboard-queue-section__head">
                <CalendarClock size={15} aria-hidden="true" />
                <h4 id="pending-reservations-title">Đặt bàn</h4>
              </div>
              <div
                className="dashboard-queue-section__list"
                role="list"
                aria-label="Đặt bàn chờ xác nhận"
              >
                {reservations.map((reservation) => {
                  const depositLabel =
                    DEPOSIT_STATUS_LABELS[reservation.depositStatus] ||
                    "Chưa có thông tin đặt cọc";
                  const depositAmount = Number(reservation.depositAmount || 0);
                  const queueAge = getQueueAge(reservation.createdAt);

                  return (
                    <div
                      className="dashboard-queue-item"
                      key={reservation.id}
                      role="listitem"
                    >
                      <div className="dashboard-queue-item__main">
                        <div className="dashboard-queue-item__title-row">
                          <strong>
                            #{reservation.orderCode || reservation.id}
                          </strong>
                          {queueAge ? (
                            <span
                              className={`queue-age queue-age--${queueAge.tone}`}
                            >
                              {queueAge.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="dashboard-queue-item__context">
                          {reservation.customerName || "Khách chưa xác định"} •{" "}
                          {reservation.customerPhone || "Chưa có số điện thoại"}
                          {reservation.tableCode
                            ? ` • Bàn ${reservation.tableCode}`
                            : ""}
                        </p>
                        <div className="dashboard-queue-item__facts">
                          <span className="queue-fact queue-fact--strong">
                            {reservation.partySize || 0} khách
                          </span>
                          <span className="queue-fact">
                            {formatDateTime(reservation.timeTo)}
                          </span>
                          <span className="queue-fact queue-fact--status">
                            {depositLabel}
                            {depositAmount > 0
                              ? ` · ${formatCurrency(depositAmount)}`
                              : ""}
                          </span>
                        </div>
                        {reservation.note ? (
                          <em className="dashboard-queue-item__detail">
                            {reservation.note}
                          </em>
                        ) : null}
                      </div>
                      <div className="dashboard-queue-item__actions">
                        <button
                          type="button"
                          className="queue-btn queue-btn--primary"
                          disabled={Boolean(busyKey)}
                          aria-busy={
                            busyKey === `reservation-confirm:${reservation.id}`
                          }
                          onClick={() =>
                            onConfirmReservation?.(reservation)
                          }
                        >
                          {busyKey ===
                          `reservation-confirm:${reservation.id}`
                            ? "Đang xác nhận..."
                            : "Xác nhận"}
                        </button>
                        <button
                          type="button"
                          className="queue-btn queue-btn--danger"
                          disabled={Boolean(busyKey)}
                          aria-busy={
                            busyKey === `reservation-cancel:${reservation.id}`
                          }
                          onClick={() =>
                            onCancelReservation?.(reservation)
                          }
                        >
                          {busyKey === `reservation-cancel:${reservation.id}`
                            ? "Đang từ chối..."
                            : "Từ chối"}
                        </button>
                        <button
                          type="button"
                          className="queue-btn queue-btn--ghost"
                          onClick={onOpenTables}
                        >
                          Sơ đồ bàn
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {rejectTarget ? (
        <ReasonModal
          title={`Từ chối đơn #${rejectTarget.orderCode || rejectTarget.id}`}
          placeholder="Nhập lý do từ chối để nhân viên hoặc khách hàng hiểu rõ."
          confirmLabel="Xác nhận từ chối"
          busy={rejectBusy}
          onClose={() => setRejectTarget(null)}
          onConfirm={async (reason) => {
            await onRejectOrder?.(rejectTarget, reason);
            setRejectTarget(null);
          }}
        />
      ) : null}
    </article>
  );
}
