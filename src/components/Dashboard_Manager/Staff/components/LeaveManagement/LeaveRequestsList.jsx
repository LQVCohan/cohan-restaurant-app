import React, { useState } from "react";
import LeaveRequestItem from "./LeaveRequestItem";

const LeaveRequestsList = ({ requests, onApprove, onReject }) => {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  const filteredRequests = requests.filter((request) => {
    if (filter === "all") return true;
    return request.status === filter;
  });

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    switch (sortBy) {
      case "date":
        return new Date(b.createdAt) - new Date(a.createdAt);
      case "employee":
        return a.employeeName.localeCompare(b.employeeName);
      case "startDate":
        return new Date(a.startDate) - new Date(b.startDate);
      default:
        return 0;
    }
  });

  const getStatusCount = (status) => {
    return requests.filter((req) => req.status === status).length;
  };

  return (
    <div className="leave-requests-list">
      <div className="list-header">
        <div className="header-left">
          <h3 className="list-title">📋 Danh Sách Đơn Nghỉ Phép</h3>
          <div className="list-subtitle">
            Quản lý và duyệt các đơn xin nghỉ phép
          </div>
        </div>

        <div className="list-controls">
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">📊 Tất cả ({requests.length})</option>
            <option value="pending">
              ⏳ Chờ duyệt ({getStatusCount("pending")})
            </option>
            <option value="approved">
              ✅ Đã duyệt ({getStatusCount("approved")})
            </option>
            <option value="rejected">
              ❌ Từ chối ({getStatusCount("rejected")})
            </option>
          </select>

          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date">📅 Sắp xếp theo ngày tạo</option>
            <option value="employee">👤 Sắp xếp theo tên</option>
            <option value="startDate">📆 Sắp xếp theo ngày nghỉ</option>
          </select>
        </div>
      </div>

      <div className="requests-stats">
        <div className="stat-item">
          <div className="stat-number">{getStatusCount("pending")}</div>
          <div className="stat-label">Chờ duyệt</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{getStatusCount("approved")}</div>
          <div className="stat-label">Đã duyệt</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{getStatusCount("rejected")}</div>
          <div className="stat-label">Từ chối</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{requests.length}</div>
          <div className="stat-label">Tổng cộng</div>
        </div>
      </div>

      <div className="requests-container">
        {sortedRequests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div className="empty-title">Không có đơn nghỉ phép nào</div>
            <div className="empty-subtitle">
              {filter === "all"
                ? "Chưa có đơn xin nghỉ phép nào được tạo"
                : `Không có đơn nghỉ phép nào ở trạng thái "${filter}"`}
            </div>
          </div>
        ) : (
          sortedRequests.map((request) => (
            <LeaveRequestItem
              key={request.id}
              request={request}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default LeaveRequestsList;
