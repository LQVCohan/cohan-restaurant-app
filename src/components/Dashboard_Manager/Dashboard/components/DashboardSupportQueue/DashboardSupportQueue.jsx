import React from "react";
import { Headphones } from "lucide-react";

import DashboardState from "../DashboardState";

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

const REQUEST_TYPE_LABELS = {
  SUPPORT: "Yêu cầu hỗ trợ",
  HANDOFF: "Trợ lý AI chuyển cho nhân viên",
  CALL_STAFF: "Gọi nhân viên",
  STAFF_CALL: "Gọi nhân viên",
  PAYMENT: "Hỗ trợ thanh toán",
  PAYMENT_REQUEST: "Yêu cầu thanh toán",
  support: "Yêu cầu hỗ trợ",
  handoff: "Trợ lý AI chuyển cho nhân viên",
  call_staff: "Gọi nhân viên",
  staff_call: "Gọi nhân viên",
  payment: "Hỗ trợ thanh toán",
  payment_request: "Yêu cầu thanh toán",
};

const REQUEST_STATUS_LABELS = {
  PENDING: "Chờ tiếp nhận",
  ACKNOWLEDGED: "Đã tiếp nhận",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã hoàn tất",
  pending: "Chờ tiếp nhận",
  acknowledged: "Đã tiếp nhận",
  in_progress: "Đang xử lý",
  resolved: "Đã hoàn tất",
};

export default function DashboardSupportQueue({
  requests = [],
  count = 0,
  loading,
  error,
  busyKey,
  onAcknowledge,
  onResolve,
  onOpenHandoff,
}) {
  const requestCount = Number(count || requests.length || 0);

  return (
    <article className="dashboard-card dashboard-card--support-queue">
      <div className="dashboard-card__head dashboard-card__head--compact">
        <div>
          <h3>Yêu cầu hỗ trợ khách hàng</h3>
          <p>Các yêu cầu từ trợ lý AI hoặc khách tại bàn cần nhân viên xử lý.</p>
        </div>
        <span className="queue-count queue-count--support">
          <Headphones size={14} aria-hidden="true" />
          {loading ? "Đang tải" : error ? "Lỗi tải" : `${requestCount} yêu cầu`}
        </span>
      </div>

      {loading ? (
        <DashboardState state="loading" title="Đang tải yêu cầu hỗ trợ" />
      ) : error ? (
        <DashboardState state="error" title="Không thể tải yêu cầu hỗ trợ" />
      ) : requests.length ? (
        <div className="dashboard-support-list">
          {requests.slice(0, 5).map((request) => {
            const typeLabel =
              REQUEST_TYPE_LABELS[request.type] || "Yêu cầu hỗ trợ";
            const statusLabel =
              REQUEST_STATUS_LABELS[request.status] || "Chưa xác định trạng thái";

            return (
              <div className="dashboard-support-item" key={request.requestId}>
                <div>
                  <strong>#{request.orderCode || request.orderId}</strong>
                  <p>{request.message || "Khách hàng cần hỗ trợ."}</p>
                  <span>
                    {request.trackingCode
                      ? `Mã theo dõi ${request.trackingCode} • `
                      : ""}
                    {request.tableCode ? `Bàn ${request.tableCode} • ` : ""}
                    {typeLabel} • {statusLabel} • {formatDateTime(request.createdAt)}
                  </span>
                </div>
                <div className="dashboard-support-item__actions">
                  <button
                    type="button"
                    className="queue-btn queue-btn--primary"
                    disabled={Boolean(busyKey)}
                    onClick={() => onAcknowledge?.(request)}
                  >
                    {busyKey === `support-ack:${request.requestId}`
                      ? "Đang tiếp nhận..."
                      : "Tiếp nhận"}
                  </button>
                  <button
                    type="button"
                    className="queue-btn queue-btn--ghost"
                    disabled={Boolean(busyKey)}
                    onClick={() => onResolve?.(request)}
                  >
                    {busyKey === `support-resolve:${request.requestId}`
                      ? "Đang hoàn tất..."
                      : "Đánh dấu hoàn tất"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DashboardState state="clear" title="Hiện không có yêu cầu hỗ trợ">
          <p>Yêu cầu mới sẽ hiển thị tại đây.</p>
        </DashboardState>
      )}

      <button
        type="button"
        className="dashboard-support-open"
        onClick={onOpenHandoff}
      >
        Xem tất cả yêu cầu hỗ trợ
      </button>
    </article>
  );
}