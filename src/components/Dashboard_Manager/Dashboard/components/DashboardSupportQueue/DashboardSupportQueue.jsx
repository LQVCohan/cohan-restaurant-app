import React from "react";
import { Headphones } from "lucide-react";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
};

export default function DashboardSupportQueue({ requests = [], count = 0, loading, error, busyKey, onAcknowledge, onResolve, onOpenHandoff }) {
  return (
    <article className="dashboard-card dashboard-card--support-queue">
      <div className="dashboard-card__head dashboard-card__head--compact">
        <div>
          <h3>Hỗ trợ khách hàng</h3>
          <p>Tóm tắt yêu cầu hỗ trợ / handoff AI mới nhất.</p>
        </div>
        <span className="queue-count queue-count--support"><Headphones size={14} />{loading ? "Đang tải" : `${count || requests.length} chờ`}</span>
      </div>

      {loading ? (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--loading"><h4>Đang tải yêu cầu hỗ trợ</h4><p>Đang đồng bộ hàng đợi khách hàng.</p></div>
      ) : error ? (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--error"><h4>Không tải được hỗ trợ</h4><p>{error?.message || "Vui lòng làm mới dashboard."}</p></div>
      ) : requests.length ? (
        <div className="dashboard-support-list">
          {requests.slice(0, 5).map((request) => (
            <div className="dashboard-support-item" key={request.requestId}>
              <div>
                <strong>#{request.orderCode || request.orderId}</strong>
                <p>{request.message || "Khách cần hỗ trợ."}</p>
                <span>
                  {request.trackingCode ? `Tracking ${request.trackingCode} • ` : ""}
                  {request.tableCode ? `Bàn ${request.tableCode} • ` : ""}
                  {request.type || "SUPPORT"} • {request.status || "PENDING"} • {formatDateTime(request.createdAt)}
                </span>
              </div>
              <div className="dashboard-support-item__actions">
                <button type="button" className="queue-btn queue-btn--primary" disabled={!!busyKey} onClick={() => onAcknowledge?.(request)}>{busyKey === `support-ack:${request.requestId}` ? "Đang nhận..." : "Đã nhận xử lý"}</button>
                <button type="button" className="queue-btn queue-btn--ghost" disabled={!!busyKey} onClick={() => onResolve?.(request)}>{busyKey === `support-resolve:${request.requestId}` ? "Đang hoàn tất..." : "Hoàn tất"}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty dashboard-empty--compact dashboard-empty--healthy"><h4>Chưa có yêu cầu hỗ trợ</h4><p>Handoff AI và yêu cầu PENDING sẽ hiển thị tại đây.</p></div>
      )}

      <button type="button" className="dashboard-support-open" onClick={onOpenHandoff}>Mở Handoff AI</button>
    </article>
  );
}
