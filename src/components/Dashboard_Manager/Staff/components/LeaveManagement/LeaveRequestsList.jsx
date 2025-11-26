import React, { useState, useMemo } from "react";
import "./LeaveRequestsList.scss"; // Import file SCSS mới

const LeaveRequestsList = ({ requests = [], onApprove, onReject }) => {
  const [filterStatus, setFilterStatus] = useState("all"); // all | pending | approved | rejected
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  // --- FILTER & SEARCH LOGIC ---
  const filteredData = useMemo(() => {
    return requests.filter((req) => {
      const matchesStatus =
        filterStatus === "all" || req.status === filterStatus;
      const matchesSearch = req.employeeName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [requests, filterStatus, searchTerm]);

  // --- PAGINATION ---
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- HELPER: Badge Status ---
  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <span className="status-badge pending">⏳ Chờ duyệt</span>;
      case "approved":
        return <span className="status-badge approved">✅ Đã duyệt</span>;
      case "rejected":
        return <span className="status-badge rejected">❌ Từ chối</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  return (
    <div className="leave-list-container">
      {/* 1. HEADER & STATS CARDS */}
      <div className="dashboard-header">
        <div className="header-title">
          <h3>📋 Quản Lý Nghỉ Phép</h3>
          <p>Theo dõi và xử lý các yêu cầu nghỉ phép của nhân viên</p>
        </div>

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
      </div>

      {/* 2. CONTROLS (TABS & SEARCH) */}
      <div className="controls-bar">
        <div className="tabs">
          {[
            { key: "all", label: "Tất cả" },
            { key: "pending", label: "Chờ duyệt", count: stats.pending },
            { key: "approved", label: "Đã duyệt" },
            { key: "rejected", label: "Từ chối" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${filterStatus === tab.key ? "active" : ""}`}
              onClick={() => {
                setFilterStatus(tab.key);
                setCurrentPage(1);
              }}
            >
              {tab.label}{" "}
              {tab.count > 0 && (
                <span className="badge-count">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Tìm nhân viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* 3. DATA TABLE */}
      <div className="table-container">
        <table className="leave-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>Nhân viên</th>
              <th style={{ width: "15%" }}>Loại nghỉ</th>
              <th style={{ width: "20%" }}>Thời gian</th>
              <th style={{ width: "10%" }}>Số ngày</th>
              <th style={{ width: "15%" }}>Trạng thái</th>
              <th style={{ width: "15%", textAlign: "right" }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {currentData.length > 0 ? (
              currentData.map((req) => (
                <tr key={req.id} className="hover-row">
                  <td>
                    <div className="employee-cell">
                      <div className="avatar">{req.employeeName.charAt(0)}</div>
                      <div className="info">
                        <div className="name">{req.employeeName}</div>
                        <div className="date-sub">
                          Tạo ngày:{" "}
                          {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="leave-type">{req.leaveType}</span>
                  </td>
                  <td>
                    <div className="date-range">
                      <span>
                        {new Date(req.startDate).toLocaleDateString("vi-VN")}
                      </span>
                      <span className="arrow">➝</span>
                      <span>
                        {new Date(req.endDate).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{req.daysCount}</strong> ngày
                  </td>
                  <td>{getStatusBadge(req.status)}</td>
                  <td className="actions-cell">
                    {req.status === "pending" && (
                      <div className="action-buttons">
                        <button
                          className="btn-icon approve"
                          title="Duyệt"
                          onClick={() => onApprove(req.id)}
                        >
                          ✓
                        </button>
                        <button
                          className="btn-icon reject"
                          title="Từ chối"
                          onClick={() => onReject(req.id)}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {req.status !== "pending" && (
                      <span className="text-muted">---</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty-row">
                  <div className="empty-content">
                    <span className="icon">📭</span>
                    <p>Không tìm thấy đơn nào.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. PAGINATION */}
      {totalPages > 1 && (
        <div className="pagination-footer">
          <span className="page-info">
            Trang <b>{currentPage}</b> / {totalPages}
          </span>
          <div className="page-nav">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              ←
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequestsList;
