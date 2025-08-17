import React, { useState } from "react";
import "./StaffList.scss";

const StaffList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Mock data
  const staffData = [
    {
      id: 1,
      name: "Nguyễn Văn A",
      email: "nguyenvana@email.com",
      phone: "0123456789",
      position: "Bếp trưởng",
      department: "Bếp",
      status: "active",
      salary: 15000000,
      startDate: "2023-01-15",
      avatar: "👨‍🍳",
    },
    {
      id: 2,
      name: "Trần Thị B",
      email: "tranthib@email.com",
      phone: "0987654321",
      position: "Phục vụ trưởng",
      department: "Phục vụ",
      status: "active",
      salary: 12000000,
      startDate: "2023-02-20",
      avatar: "👩‍💼",
    },
    {
      id: 3,
      name: "Lê Văn C",
      email: "levanc@email.com",
      phone: "0369852147",
      position: "Thu ngân",
      department: "Thu ngân",
      status: "inactive",
      salary: 9000000,
      startDate: "2023-03-10",
      avatar: "👨‍💼",
    },
    {
      id: 4,
      name: "Phạm Thị D",
      email: "phamthid@email.com",
      phone: "0147258369",
      position: "Phục vụ",
      department: "Phục vụ",
      status: "active",
      salary: 8000000,
      startDate: "2023-04-05",
      avatar: "👩‍🍳",
    },
    {
      id: 5,
      name: "Hoàng Văn E",
      email: "hoangvane@email.com",
      phone: "0258147369",
      position: "Bếp phó",
      department: "Bếp",
      status: "leave",
      salary: 11000000,
      startDate: "2023-05-12",
      avatar: "👨‍🍳",
    },
  ];

  const departments = ["Tất cả", "Bếp", "Phục vụ", "Thu ngân", "Quản lý"];
  const statuses = [
    { value: "all", label: "Tất cả" },
    { value: "active", label: "Đang làm việc" },
    { value: "inactive", label: "Nghỉ việc" },
    { value: "leave", label: "Nghỉ phép" },
  ];

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: "Đang làm việc", class: "success" },
      inactive: { label: "Nghỉ việc", class: "danger" },
      leave: { label: "Nghỉ phép", class: "warning" },
    };
    return statusConfig[status] || { label: status, class: "secondary" };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN");
  };

  // Filter staff data
  const filteredStaff = staffData.filter((staff) => {
    const matchesSearch =
      staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.phone.includes(searchTerm);
    const matchesStatus =
      filterStatus === "all" || staff.status === filterStatus;
    const matchesDepartment =
      filterDepartment === "all" || staff.department === filterDepartment;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  return (
    <div className="staff-list">
      {/* Header */}
      <div className="staff-list__header">
        <div className="header-left">
          <h2>Danh sách nhân viên</h2>
          <p>Quản lý thông tin chi tiết của {staffData.length} nhân viên</p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => setShowAddModal(true)}
        >
          <i className="fas fa-plus" />
          Thêm nhân viên
        </button>
      </div>

      {/* Filters */}
      <div className="staff-list__filters">
        <div className="filter-group">
          <div className="search-box">
            <i className="fas fa-search" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, email hoặc số điện thoại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="filter-select"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept === "Tất cả" ? "all" : dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="staff-grid">
        {filteredStaff.map((staff) => (
          <div key={staff.id} className="staff-card">
            <div className="staff-card__header">
              <div className="staff-avatar">{staff.avatar}</div>
              <div className="staff-info">
                <h3 className="staff-name">{staff.name}</h3>
                <p className="staff-position">{staff.position}</p>
                <span
                  className={`status-badge status-badge--${
                    getStatusBadge(staff.status).class
                  }`}
                >
                  {getStatusBadge(staff.status).label}
                </span>
              </div>
              <div className="staff-actions">
                <button className="action-btn" title="Chỉnh sửa">
                  <i className="fas fa-edit" />
                </button>
                <button className="action-btn" title="Xem chi tiết">
                  <i className="fas fa-eye" />
                </button>
                <button className="action-btn action-btn--danger" title="Xóa">
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>

            <div className="staff-card__body">
              <div className="info-row">
                <i className="fas fa-envelope" />
                <span>{staff.email}</span>
              </div>
              <div className="info-row">
                <i className="fas fa-phone" />
                <span>{staff.phone}</span>
              </div>
              <div className="info-row">
                <i className="fas fa-building" />
                <span>{staff.department}</span>
              </div>
              <div className="info-row">
                <i className="fas fa-money-bill-wave" />
                <span>{formatCurrency(staff.salary)}</span>
              </div>
              <div className="info-row">
                <i className="fas fa-calendar-alt" />
                <span>Bắt đầu: {formatDate(staff.startDate)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="empty-state">
          <i className="fas fa-users" />
          <h3>Không tìm thấy nhân viên</h3>
          <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
        </div>
      )}

      {/* Add Staff Modal Placeholder */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm nhân viên mới</h3>
              <button
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              <p>Form thêm nhân viên sẽ được implement ở đây...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffList;
