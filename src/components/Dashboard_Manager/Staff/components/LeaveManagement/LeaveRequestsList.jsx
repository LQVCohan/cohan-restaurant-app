import React, { useMemo } from "react";
import { AuthContext } from "@/context/AuthContext";
import { isForbiddenError, isUnauthenticatedError } from "@/utils/graphqlErrorUtils";
import "./LeaveRequestsList.scss";

export const getLeaveActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) {
    return "Bạn không có quyền thực hiện thao tác đơn nghỉ phép này.";
  }
  if (isUnauthenticatedError(error)) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.";
  }
  return fallback;
};

const statusLabel = {
  PENDING: "⏳ Chờ duyệt",
  PENDING_REPLACEMENT_CONFIRMATION: "⏳ Chờ duyệt",
  APPROVED: "✅ Đã duyệt",
  REJECTED: "❌ Từ chối",
};

const leaveTypeLabel = {
  ANNUAL: "Nghỉ năm",
  SICK: "Nghỉ bệnh",
  UNPAID: "Nghỉ không lương",
  PAID_PERSONAL: "Nghỉ việc riêng có lương",
  MATERNITY: "Nghỉ thai sản",
  COMPENSATORY: "Nghỉ bù",
  HOLIDAY: "Nghỉ lễ/tết",
  HALF_DAY: "Nghỉ nửa ngày",
};

const LeaveRequestsList = ({
  requests = [],
  onApprove,
  onReject,
  selectedDate,
  onDateChange,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  loading,
  error,
  title = "📋 Quản Lý Nghỉ Phép",
  subtitle = "Theo dõi và xử lý đơn nghỉ thật từ database",
  searchPlaceholder = "🔍 Tìm nhân viên...",
  allowDecisionActions = true,
  showSearch = true,
  headerAction = null,
}) => {
  const { user } = React.useContext(AuthContext);
  const currentUserId = user?.id || user?._id || null;

  const stats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === "PENDING" || r.status === "PENDING_REPLACEMENT_CONFIRMATION").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
    }),
    [requests]
  );

  const requestRows = useMemo(() => requests, [requests]);

  return (
    <div className="leave-list-container">
      <div className="dashboard-header">
        <div className="header-title">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>

        <div className="header-actions">
          <div className="stats-grid">
            <div className="stat-card total">
              <div className="icon">📂</div>
              <div className="info">
                <span className="label">Tổng đơn</span>
                <span className="value">{stats.total}</span>
              </div>
            </div>
            <div className="stat-card pending">
              <div className="icon">⏳</div>
              <div className="info">
                <span className="label">Chờ duyệt</span>
                <span className="value">{stats.pending}</span>
              </div>
            </div>
            <div className="stat-card approved">
              <div className="icon">✅</div>
              <div className="info">
                <span className="label">Đã duyệt</span>
                <span className="value">{stats.approved}</span>
              </div>
            </div>
          </div>
          {headerAction && <div className="header-action-slot">{headerAction}</div>}
        </div>
      </div>

      <div className="controls-bar">
        <div className="tabs">
          {[
            { key: "all", label: "Tất cả" },
            { key: "PENDING", label: "Chờ duyệt" },
            { key: "APPROVED", label: "Đã duyệt" },
            { key: "REJECTED", label: "Từ chối" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${statusFilter === tab.key ? "active" : ""}`}
              onClick={() => onStatusFilterChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="search-box">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
          {showSearch && (
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          )}
        </div>
      </div>

      {error && <div className="empty-row">❌ Không tải được dữ liệu nghỉ phép: {error.message}</div>}

      <div className="table-container">
        <table className="leave-table">
          <thead>
            <tr>
              <th style={{ width: "22%" }}>Nhân viên</th>
              <th style={{ width: "12%" }}>Loại nghỉ</th>
              <th style={{ width: "20%" }}>Thời gian</th>
              <th style={{ width: "10%" }}>Số ngày</th>
              <th style={{ width: "18%" }}>Trạng thái</th>
              <th style={{ width: "18%", textAlign: "right" }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {!loading && requestRows.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-row">Không có đơn nghỉ phép.</td>
              </tr>
            )}

            {requestRows.map((req) => {
              const isOwnRequest = currentUserId && String(req.employeeId || "") === String(currentUserId);
              const canReview = allowDecisionActions && req.status === "PENDING" && !isOwnRequest;

              return (
                <tr key={req.id} className="hover-row">
                  <td>
                    <div className="employee-cell">
                      <div className="avatar">{(req.employeeName || "?").charAt(0)}</div>
                      <div className="info">
                        <div className="name">{req.employeeName}</div>
                        <div className="date-sub">Mã: {req.employeeCode || "--"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="leave-type">{leaveTypeLabel[req.leaveType] || req.leaveType}</span>
                  </td>
                  <td>
                    <div className="date-range">
                      <span>{new Date(req.startDate).toLocaleDateString("vi-VN")}</span>
                      <span className="arrow">➝</span>
                      <span>{new Date(req.endDate).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </td>
                  <td>
                    <strong>{req.requestedDays}</strong> ngày
                  </td>
                  <td>
                    <span className={`status-badge ${String(req.status).toLowerCase()}`}>
                      {statusLabel[req.status] || req.status}
                    </span>
                  </td>
                  <td className="actions-cell">
                    {canReview && (
                      <div className="action-buttons">
                        <button
                          className="btn-icon approve"
                          onClick={async () => {
                            try {
                              await onApprove(req.id, "Duyệt đơn");
                              alert("✅ Duyệt đơn thành công. Hệ thống đã ghi nhận quyết định.");
                            } catch (err) {
                              alert(`⚠️ ${getLeaveActionErrorMessage(err, err?.message || "Duyệt đơn thất bại")}`);
                            }
                          }}
                        >
                          ✓
                        </button>
                        <button
                          className="btn-icon reject"
                          onClick={async () => {
                            const reason = window.prompt("Lý do từ chối", "Không phù hợp lịch làm việc");
                            if (!reason) return;
                            try {
                              await onReject(req.id, reason);
                              alert("✅ Từ chối đơn thành công. Hệ thống đã ghi nhận quyết định.");
                            } catch (err) {
                              alert(`⚠️ ${getLeaveActionErrorMessage(err, err?.message || "Từ chối đơn thất bại")}`);
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {!canReview && (
                      <span className="date-sub">Theo dõi</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaveRequestsList;
