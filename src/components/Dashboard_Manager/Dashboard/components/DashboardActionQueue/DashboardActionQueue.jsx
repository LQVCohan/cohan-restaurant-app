import React, { useMemo, useState } from "react";
import { ClipboardList, X } from "lucide-react";

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
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
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
  const totalCount =
    Number(counts.orders || 0) + Number(counts.reservations || 0);
  const empty = !loading && !error && !orders.length && !reservations.length;
  const rejectBusy =
    rejectTarget && busyKey === `order-reject:${rejectTarget.id}`;

  const sections = useMemo(
    () => [
      {
        key: "orders",
        title: "Đơn hàng chờ xác nhận",
        count: counts.orders || orders.length,
      },
      {
        key: "reservations",
        title: "Đặt bàn chờ xác nhận",
        count: counts.reservations || reservations.length,
      },
    ],
    [counts, orders.length, reservations.length],
  );

  return (
    <article className="dashboard-card dashboard-card--action-queue">
      <div className="dashboard-card__head">
        <div>
          <h3>Yêu cầu chờ xác nhận</h3>
          <p>Xử lý đơn hàng và yêu cầu đặt bàn mới ngay tại đây.</p>
        </div>
        <span className="queue-count">
          <ClipboardList size={14} />
          {loading ? "Đang tải" : `${totalCount} yêu cầu`}
        </span>
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
          <p>Đơn hàng và yêu cầu đặt bàn mới sẽ hiển thị tại đây.</p>
        </div>
      ) : (
        <div className="dashboard-queue-sections">
          <section
            className="dashboard-queue-section"
            aria-labelledby="pending-orders-title"
          >
            <div className="dashboard-queue-section__head">
              <h4 id="pending-orders-title">{sections[0].title}</h4>
              <span>{sections[0].count}</span>
            </div>
            {orders.length ? (
              orders.map((order) => {
                const orderType =
                  ORDER_TYPE_LABELS[order.orderType] ||
                  order.orderType ||
                  "Chưa xác định hình thức";

                return (
                  <div className="dashboard-queue-item" key={order.id}>
                    <div className="dashboard-queue-item__main">
                      <strong>#{order.orderCode || order.id}</strong>
                      <p>
                        {orderType}
                        {order.tableCode ? ` • Bàn ${order.tableCode}` : ""}
                        {order.customerName ? ` • ${order.customerName}` : ""}
                      </p>
                      <span>
                        {formatCurrency(order.total)} •{" "}
                        {formatDateTime(order.createdAt)}
                      </span>
                      <em>{itemSummary(order.itemNames)}</em>
                    </div>
                    <div className="dashboard-queue-item__actions">
                      <button
                        type="button"
                        className="queue-btn queue-btn--primary"
                        disabled={Boolean(busyKey)}
                        onClick={() => onConfirmOrder?.(order)}
                      >
                        {busyKey === `order-confirm:${order.id}`
                          ? "Đang xác nhận..."
                          : "Xác nhận đơn"}
                      </button>
                      <button
                        type="button"
                        className="queue-btn queue-btn--danger"
                        disabled={Boolean(busyKey)}
                        onClick={() => setRejectTarget(order)}
                      >
                        Từ chối đơn
                      </button>
                      <button
                        type="button"
                        className="queue-btn queue-btn--ghost"
                        onClick={onOpenOrders}
                      >
                        Xem đơn hàng
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="dashboard-queue-section__empty">
                Chưa có đơn hàng chờ xác nhận.
              </p>
            )}
          </section>

          <section
            className="dashboard-queue-section"
            aria-labelledby="pending-reservations-title"
          >
            <div className="dashboard-queue-section__head">
              <h4 id="pending-reservations-title">{sections[1].title}</h4>
              <span>{sections[1].count}</span>
            </div>
            {reservations.length ? (
              reservations.map((reservation) => {
                const depositLabel =
                  DEPOSIT_STATUS_LABELS[reservation.depositStatus] ||
                  "Chưa có thông tin đặt cọc";

                return (
                  <div className="dashboard-queue-item" key={reservation.id}>
                    <div className="dashboard-queue-item__main">
                      <strong>#{reservation.orderCode || reservation.id}</strong>
                      <p>
                        {reservation.customerName || "Khách chưa xác định"} •{" "}
                        {reservation.customerPhone || "Chưa có số điện thoại"}
                        {reservation.tableCode
                          ? ` • Bàn ${reservation.tableCode}`
                          : ""}
                      </p>
                      <span>
                        {reservation.partySize || 0} khách •{" "}
                        {formatDateTime(reservation.timeTo)} • {depositLabel}
                      </span>
                      {reservation.note ? <em>{reservation.note}</em> : null}
                    </div>
                    <div className="dashboard-queue-item__actions">
                      <button
                        type="button"
                        className="queue-btn queue-btn--primary"
                        disabled={Boolean(busyKey)}
                        onClick={() => onConfirmReservation?.(reservation)}
                      >
                        {busyKey === `reservation-confirm:${reservation.id}`
                          ? "Đang xác nhận..."
                          : "Xác nhận đặt bàn"}
                      </button>
                      <button
                        type="button"
                        className="queue-btn queue-btn--danger"
                        disabled={Boolean(busyKey)}
                        onClick={() => onCancelReservation?.(reservation)}
                      >
                        {busyKey === `reservation-cancel:${reservation.id}`
                          ? "Đang từ chối..."
                          : "Từ chối đặt bàn"}
                      </button>
                      <button
                        type="button"
                        className="queue-btn queue-btn--ghost"
                        onClick={onOpenTables}
                      >
                        Xem sơ đồ bàn
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="dashboard-queue-section__empty">
                Chưa có yêu cầu đặt bàn chờ xác nhận.
              </p>
            )}
          </section>
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
