import React, { useMemo, useState } from "react";
import { ClipboardList, X } from "lucide-react";

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
};

const itemSummary = (items = []) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) return "Chưa có món";
  return safeItems.slice(0, 3).join(", ") + (safeItems.length > 3 ? ` +${safeItems.length - 3}` : "");
};

function ReasonModal({ title, placeholder, confirmLabel, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <div className="dashboard-modal-backdrop" role="presentation">
      <div className="dashboard-reason-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-reason-title">
        <div className="dashboard-reason-modal__head">
          <h3 id="dashboard-reason-title">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Đóng" disabled={busy}><X size={16} /></button>
        </div>
        <textarea
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={placeholder}
          rows={4}
        />
        <div className="dashboard-reason-modal__actions">
          <button type="button" className="queue-btn queue-btn--ghost" onClick={onClose} disabled={busy}>Hủy</button>
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
  const totalCount = Number(counts.orders || 0) + Number(counts.reservations || 0);
  const empty = !loading && !error && !orders.length && !reservations.length;
  const rejectBusy = rejectTarget && busyKey === `order-reject:${rejectTarget.id}`;

  const sections = useMemo(() => [
    { key: "orders", title: "Đơn đặt món chưa nhận", count: counts.orders || orders.length },
    { key: "reservations", title: "Đặt bàn chưa nhận", count: counts.reservations || reservations.length },
  ], [counts, orders.length, reservations.length]);

  return (
    <article className="dashboard-card dashboard-card--action-queue">
      <div className="dashboard-card__head">
        <div>
          <h3>Cần tiếp nhận</h3>
          <p>Xử lý nhanh đơn đặt món và đặt bàn đang chờ xác nhận.</p>
        </div>
        <span className="queue-count"><ClipboardList size={14} />{loading ? "Đang tải" : `${totalCount} việc`}</span>
      </div>

      {loading ? (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--loading"><h4>Đang tải hàng đợi</h4><p>Đang kiểm tra đơn và đặt bàn cần tiếp nhận.</p></div>
      ) : error ? (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--error"><h4>Không tải được hàng đợi</h4><p>{error?.message || "Vui lòng làm mới dashboard."}</p></div>
      ) : empty ? (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--healthy"><h4>Không có việc cần tiếp nhận</h4><p>Đơn đặt món và đặt bàn mới sẽ xuất hiện tại đây.</p></div>
      ) : (
        <div className="dashboard-queue-sections">
          <section className="dashboard-queue-section" aria-labelledby="pending-orders-title">
            <div className="dashboard-queue-section__head"><h4 id="pending-orders-title">{sections[0].title}</h4><span>{sections[0].count}</span></div>
            {orders.length ? orders.map((order) => (
              <div className="dashboard-queue-item" key={order.id}>
                <div className="dashboard-queue-item__main">
                  <strong>#{order.orderCode || order.id}</strong>
                  <p>{order.orderType || "-"} {order.tableCode ? `• Bàn ${order.tableCode}` : ""} {order.customerName ? `• ${order.customerName}` : ""}</p>
                  <span>{formatCurrency(order.total)} • {formatDateTime(order.createdAt)}</span>
                  <em>{itemSummary(order.itemNames)}</em>
                </div>
                <div className="dashboard-queue-item__actions">
                  <button type="button" className="queue-btn queue-btn--primary" disabled={!!busyKey} onClick={() => onConfirmOrder?.(order)}>{busyKey === `order-confirm:${order.id}` ? "Đang nhận..." : "Nhận đơn"}</button>
                  <button type="button" className="queue-btn queue-btn--danger" disabled={!!busyKey} onClick={() => setRejectTarget(order)}>Từ chối</button>
                  <button type="button" className="queue-btn queue-btn--ghost" onClick={onOpenOrders}>Xem chi tiết</button>
                </div>
              </div>
            )) : <p className="dashboard-queue-section__empty">Chưa có đơn đặt món pending.</p>}
          </section>

          <section className="dashboard-queue-section" aria-labelledby="pending-reservations-title">
            <div className="dashboard-queue-section__head"><h4 id="pending-reservations-title">{sections[1].title}</h4><span>{sections[1].count}</span></div>
            {reservations.length ? reservations.map((reservation) => (
              <div className="dashboard-queue-item" key={reservation.id}>
                <div className="dashboard-queue-item__main">
                  <strong>#{reservation.orderCode || reservation.id}</strong>
                  <p>{reservation.customerName || "Khách"} • {reservation.customerPhone || "Chưa có SĐT"} {reservation.tableCode ? `• Bàn ${reservation.tableCode}` : ""}</p>
                  <span>{reservation.partySize || 0} khách • {formatDateTime(reservation.timeTo)} • Cọc: {reservation.depositStatus || "-"}</span>
                  {reservation.note ? <em>{reservation.note}</em> : null}
                </div>
                <div className="dashboard-queue-item__actions">
                  <button type="button" className="queue-btn queue-btn--primary" disabled={!!busyKey} onClick={() => onConfirmReservation?.(reservation)}>{busyKey === `reservation-confirm:${reservation.id}` ? "Đang nhận..." : "Nhận đặt bàn"}</button>
                  <button type="button" className="queue-btn queue-btn--danger" disabled={!!busyKey} onClick={() => onCancelReservation?.(reservation)}>{busyKey === `reservation-cancel:${reservation.id}` ? "Đang hủy..." : "Từ chối / hủy"}</button>
                  <button type="button" className="queue-btn queue-btn--ghost" onClick={onOpenTables}>Xem quản lý bàn</button>
                </div>
              </div>
            )) : <p className="dashboard-queue-section__empty">Chưa có đặt bàn cần xác nhận.</p>}
          </section>
        </div>
      )}

      {rejectTarget ? (
        <ReasonModal
          title={`Từ chối đơn #${rejectTarget.orderCode || rejectTarget.id}`}
          placeholder="Nhập lý do để khách/nhân viên nắm được nguyên nhân..."
          confirmLabel="Từ chối đơn"
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
