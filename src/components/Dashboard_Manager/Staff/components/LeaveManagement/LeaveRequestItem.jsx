import React, { useState } from "react";

const LeaveRequestItem = ({ request, onApprove, onReject }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const getStatusConfig = (status) => {
    switch (status) {
      case "pending":
        return { class: "status-pending", text: "Chờ duyệt", icon: "⏳" };
      case "approved":
        return { class: "status-approved", text: "Đã duyệt", icon: "✅" };
      case "rejected":
        return { class: "status-rejected", text: "Từ chối", icon: "❌" };
      default:
        return { class: "status-pending", text: "Chờ duyệt", icon: "⏳" };
    }
  };

  const getLeaveTypeConfig = (type) => {
    switch (type) {
      case "annual":
        return { icon: "🏖️", text: "Nghỉ phép năm" };
      case "sick":
        return { icon: "🤒", text: "Nghỉ ốm" };
      case "personal":
        return { icon: "👨‍👩‍👧‍👦", text: "Nghỉ cá nhân" };
      case "maternity":
        return { icon: "🤱", text: "Nghỉ thai sản" };
      default:
        return { icon: "📝", text: "Khác" };
    }
  };

  const calculateDays = () => {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN");
  };

  const handleApprove = async () => {
    if (window.confirm("✅ Bạn có chắc chắn muốn duyệt đơn nghỉ phép này?")) {
      setIsProcessing(true);
      try {
        await onApprove(request.id);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleReject = async () => {
    const reason = window.prompt("❌ Nhập lý do từ chối (tùy chọn):");
    if (reason !== null) {
      // User didn't cancel
      setIsProcessing(true);
      try {
        await onReject(request.id, reason);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const statusConfig = getStatusConfig(request.status);
  const leaveTypeConfig = getLeaveTypeConfig(request.leaveType);

  return (
    <div className="leave-request-item">
      <div
        className="request-header"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="request-main-info">
          <div className="employee-info">
            <div className="employee-name">{request.employeeName}</div>
            <div className="leave-type">
              {leaveTypeConfig.icon} {leaveTypeConfig.text}
            </div>
          </div>

          <div className="request-dates">
            <div className="date-range">
              📅 {formatDate(request.startDate)} - {formatDate(request.endDate)}
            </div>
            <div className="duration">⏱️ {calculateDays()} ngày</div>
          </div>
        </div>

        <div className="request-status-section">
          <span className={`leave-status ${statusConfig.class}`}>
            {statusConfig.icon} {statusConfig.text}
          </span>
          <div className="expand-icon">{showDetails ? "🔼" : "🔽"}</div>
        </div>
      </div>

      {showDetails && (
        <div className="request-details">
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">📝 Lý do:</span>
              <span className="detail-value">{request.reason}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">📅 Ngày tạo:</span>
              <span className="detail-value">
                {formatDate(request.createdAt)}
              </span>
            </div>
            {request.processedAt && (
              <div className="detail-item">
                <span className="detail-label">⏰ Ngày xử lý:</span>
                <span className="detail-value">
                  {formatDate(request.processedAt)}
                </span>
              </div>
            )}
            {request.rejectionReason && (
              <div className="detail-item full-width">
                <span className="detail-label">❌ Lý do từ chối:</span>
                <span className="detail-value rejection-reason">
                  {request.rejectionReason}
                </span>
              </div>
            )}
          </div>

          {request.status === "pending" && (
            <div className="request-actions">
              <button
                className="btn btn-danger btn-small"
                onClick={handleReject}
                disabled={isProcessing}
              >
                {isProcessing ? "⏳" : "❌"} Từ Chối
              </button>
              <button
                className="btn btn-primary btn-small"
                onClick={handleApprove}
                disabled={isProcessing}
              >
                {isProcessing ? "⏳" : "✅"} Duyệt Đơn
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeaveRequestItem;
