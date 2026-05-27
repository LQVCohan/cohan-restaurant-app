import React from "react";

const REQUEST_STATUS_LABELS = {
  PENDING: "Chờ xử lý",
  ACKNOWLEDGED: "Đã nhận",
};

const REQUEST_TYPE_LABELS = {
  PAYMENT_REQUEST: "Yêu cầu thanh toán",
  STAFF_CALL: "Gọi nhân viên",
};

const toDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN");
};

export default function BusinessOperationsOverview({
  requestLoading = false,
  requestError = null,
  statusCounts = {},
  serviceRequests = [],
  pendingRequestsCount = 0,
  acknowledgedRequestsCount = 0,
  recentOrders = [],
  lowStockItems = [],
}) {
  const processingOrders = Number(statusCounts?.pending || 0) + Number(statusCounts?.preparing || 0);

  return (
    <section className="operations-today-grid">
      <div className="grid-item operations-today-card">
        <h4>Vận hành hôm nay</h4>
        <div className="ops-kpis">
          <div><span>Đơn đang xử lý</span><strong>{processingOrders}</strong></div>
          <div><span>Yêu cầu chờ xử lý</span><strong>{pendingRequestsCount}</strong></div>
          <div><span>Đã nhận xử lý</span><strong>{acknowledgedRequestsCount}</strong></div>
          <div><span>Cảnh báo tồn kho</span><strong>{lowStockItems.length}</strong></div>
        </div>
      </div>

      <div className="grid-item operations-today-card">
        <h4>Hàng đợi yêu cầu khách</h4>
        {requestLoading ? <p className="ops-empty">Đang tải yêu cầu khách...</p> : null}
        {!requestLoading && requestError ? <p className="ops-warning">Không thể tải hàng đợi yêu cầu khách.</p> : null}
        {!requestLoading && !requestError && serviceRequests.length === 0 ? <p className="ops-empty">Chưa có yêu cầu cần xử lý.</p> : null}
        {!requestLoading && !requestError && serviceRequests.length > 0 ? (
          <ul className="ops-list" data-testid="customer-request-list">
            {serviceRequests.slice(0, 5).map((request, idx) => (
              <li key={`${request.requestId || request.orderCode || idx}-${request.status || "unknown"}`}>
                <div className="ops-request-head">
                  <b>{REQUEST_TYPE_LABELS[request.type] || "Yêu cầu khách"}</b>
                  <span className={`ops-badge ${String(request.status || "").toLowerCase()}`}>
                    {REQUEST_STATUS_LABELS[request.status] || request.status || "-"}
                  </span>
                </div>
                <span>Bàn {request.tableCode || "-"} • #{request.orderCode || "-"}</span>
                {request.message ? <span>{request.message}</span> : null}
                {request.createdAt ? <span>{toDateTime(request.createdAt)}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid-item operations-today-card">
        <h4>Đơn mới gần đây</h4>
        {recentOrders.length === 0 ? (
          <p className="ops-empty">Chưa có đơn hàng mới.</p>
        ) : (
          <ul className="ops-list">
            {recentOrders.slice(0, 4).map((order) => (
              <li key={order.id}>
                <b>{order.orderCode ? `#${order.orderCode}` : "Đơn chưa có mã"}</b>
                <span>{order.customerName || "Khách lẻ"} • {order.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid-item operations-today-card">
        <h4>Cảnh báo tồn kho thấp</h4>
        {lowStockItems.length === 0 ? (
          <p className="ops-empty">Không có nguyên liệu cần bổ sung gấp.</p>
        ) : (
          <ul className="ops-list">
            {lowStockItems.slice(0, 4).map((item) => (
              <li key={item.id}>
                <b>{item.name}</b>
                <span>Tồn: {item.onHand} • Giữ chỗ: {item.reserved}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
