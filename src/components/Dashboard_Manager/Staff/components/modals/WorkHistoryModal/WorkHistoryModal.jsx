import React, { useState, useEffect } from "react";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import Badge from "../../../../../common/Badge";
import "./WorkHistoryModal.scss";

const WorkHistoryModal = ({ isOpen, onClose, employee, workHistory = [] }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sample work history data
  const sampleHistory = [
    {
      id: 1,
      date: "2024-01-15",
      type: "shift",
      action: "check_in",
      time: "08:00",
      description: "Bắt đầu ca làm việc",
      status: "completed",
      duration: "8h 30m",
    },
    {
      id: 2,
      date: "2024-01-15",
      type: "shift",
      action: "check_out",
      time: "16:30",
      description: "Kết thúc ca làm việc",
      status: "completed",
      duration: "8h 30m",
    },
    {
      id: 3,
      date: "2024-01-14",
      type: "overtime",
      action: "overtime",
      time: "17:00-19:00",
      description: "Làm thêm giờ - Rush hour",
      status: "approved",
      duration: "2h",
    },
    {
      id: 4,
      date: "2024-01-13",
      type: "leave",
      action: "sick_leave",
      time: "Cả ngày",
      description: "Nghỉ ốm có đơn bác sĩ",
      status: "approved",
      duration: "8h",
    },
    {
      id: 5,
      date: "2024-01-12",
      type: "training",
      action: "training",
      time: "14:00-16:00",
      description: "Đào tạo quy trình phục vụ mới",
      status: "completed",
      duration: "2h",
    },
    {
      id: 6,
      date: "2024-01-11",
      type: "shift",
      action: "late",
      time: "08:15",
      description: "Đến muộn 15 phút - Kẹt xe",
      status: "warning",
      duration: "8h 15m",
    },
    {
      id: 7,
      date: "2024-01-10",
      type: "bonus",
      action: "performance",
      time: "-",
      description: "Thưởng hiệu suất tháng 12/2023",
      status: "completed",
      amount: "500,000 VNĐ",
    },
    {
      id: 8,
      date: "2024-01-09",
      type: "shift",
      action: "check_in",
      time: "08:00",
      description: "Bắt đầu ca làm việc",
      status: "completed",
      duration: "8h",
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setHistory(workHistory.length > 0 ? workHistory : sampleHistory);
        setIsLoading(false);
      }, 1000);
    }
  }, [isOpen, workHistory]);

  const getTypeIcon = (type) => {
    switch (type) {
      case "shift":
        return "⏰";
      case "overtime":
        return "⏳";
      case "leave":
        return "🏖️";
      case "training":
        return "📚";
      case "bonus":
        return "💰";
      case "warning":
        return "⚠️";
      default:
        return "📝";
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case "shift":
        return "Ca làm việc";
      case "overtime":
        return "Làm thêm";
      case "leave":
        return "Nghỉ phép";
      case "training":
        return "Đào tạo";
      case "bonus":
        return "Thưởng";
      case "warning":
        return "Cảnh báo";
      default:
        return "Khác";
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "approved":
        return "info";
      case "pending":
        return "warning";
      case "rejected":
        return "danger";
      case "warning":
        return "warning";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "completed":
        return "Hoàn thành";
      case "approved":
        return "Đã duyệt";
      case "pending":
        return "Chờ duyệt";
      case "rejected":
        return "Từ chối";
      case "warning":
        return "Cảnh báo";
      default:
        return status;
    }
  };

  const filteredHistory = history.filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.date) - new Date(a.date);
    }
    if (sortBy === "type") {
      return a.type.localeCompare(b.type);
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedHistory.length / itemsPerPage);
  const paginatedHistory = sortedHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getWorkSummary = () => {
    const totalShifts = history.filter(
      (h) => h.type === "shift" && h.action === "check_in"
    ).length;
    const totalOvertime = history.filter((h) => h.type === "overtime").length;
    const totalLeave = history.filter((h) => h.type === "leave").length;
    const totalWarnings = history.filter((h) => h.status === "warning").length;

    return { totalShifts, totalOvertime, totalLeave, totalWarnings };
  };

  const summary = getWorkSummary();

  const renderSummaryCards = () => (
    <div className="summary-cards">
      <div className="summary-card">
        <div className="card-icon">⏰</div>
        <div className="card-content">
          <div className="card-value">{summary.totalShifts}</div>
          <div className="card-label">Ca làm việc</div>
        </div>
      </div>

      <div className="summary-card">
        <div className="card-icon">⏳</div>
        <div className="card-content">
          <div className="card-value">{summary.totalOvertime}</div>
          <div className="card-label">Làm thêm giờ</div>
        </div>
      </div>

      <div className="summary-card">
        <div className="card-icon">🏖️</div>
        <div className="card-content">
          <div className="card-value">{summary.totalLeave}</div>
          <div className="card-label">Ngày nghỉ</div>
        </div>
      </div>

      <div className="summary-card">
        <div className="card-icon">⚠️</div>
        <div className="card-content">
          <div className="card-value">{summary.totalWarnings}</div>
          <div className="card-label">Cảnh báo</div>
        </div>
      </div>
    </div>
  );

  const renderFilters = () => (
    <div className="history-filters">
      <div className="filter-group">
        <label className="filter-label">Lọc theo loại:</label>
        <select
          className="filter-select"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">Tất cả</option>
          <option value="shift">Ca làm việc</option>
          <option value="overtime">Làm thêm</option>
          <option value="leave">Nghỉ phép</option>
          <option value="training">Đào tạo</option>
          <option value="bonus">Thưởng</option>
          <option value="warning">Cảnh báo</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Sắp xếp:</label>
        <select
          className="filter-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="date">Theo ngày</option>
          <option value="type">Theo loại</option>
        </select>
      </div>
    </div>
  );

  const renderHistoryList = () => (
    <div className="history-list">
      {paginatedHistory.map((item) => (
        <div key={item.id} className="history-item">
          <div className="item-icon">{getTypeIcon(item.type)}</div>

          <div className="item-content">
            <div className="item-header">
              <div className="item-title">
                <span className="item-type">{getTypeLabel(item.type)}</span>
                <Badge variant={getStatusVariant(item.status)} size="small">
                  {getStatusLabel(item.status)}
                </Badge>
              </div>
              <div className="item-date">{item.date}</div>
            </div>

            <div className="item-description">{item.description}</div>

            <div className="item-details">
              {item.time && <span className="detail-item">🕐 {item.time}</span>}
              {item.duration && (
                <span className="detail-item">⏱️ {item.duration}</span>
              )}
              {item.amount && (
                <span className="detail-item amount">💰 {item.amount}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="pagination">
        <button
          className="pagination-btn"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          ← Trước
        </button>

        <span className="pagination-info">
          Trang {currentPage} / {totalPages}
        </span>

        <button
          className="pagination-btn"
          onClick={() =>
            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
          }
          disabled={currentPage === totalPages}
        >
          Sau →
        </button>
      </div>
    );
  };

  if (!employee) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="large"
      className="work-history-modal"
    >
      <div className="modal-header">
        <h2 className="modal-title">📊 Lịch Sử Làm Việc</h2>
        <div className="modal-subtitle">
          Theo dõi hoạt động của {employee.name}
        </div>
      </div>

      <div className="modal-body">
        {isLoading ? (
          <div className="loading-container">
            <LoadingSpinner size="large" />
            <div className="loading-text">Đang tải lịch sử làm việc...</div>
          </div>
        ) : (
          <>
            {renderSummaryCards()}
            {renderFilters()}

            {sortedHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <div className="empty-title">Chưa có lịch sử làm việc</div>
                <div className="empty-description">
                  Lịch sử làm việc sẽ được ghi lại khi nhân viên bắt đầu làm
                  việc.
                </div>
              </div>
            ) : (
              <>
                {renderHistoryList()}
                {renderPagination()}
              </>
            )}
          </>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn btn--secondary" onClick={onClose}>
          ✅ Đóng
        </button>
        <button className="btn btn--primary">📊 Xuất Báo Cáo</button>
      </div>
    </Modal>
  );
};

export default WorkHistoryModal;
