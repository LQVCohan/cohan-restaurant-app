import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faEye,
  faEdit,
  faTrash,
  faUsers,
  faUserCheck,
  faUserClock,
  faUserPlus,
  faBuilding,
  faPhone,
  faClock,
  faCalendar,
  faTimes,
  faSave,
  faThLarge,
  faList,
  faDownload,
  faPlus,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import "./StaffList.scss";

const StaffList = () => {
  // Sample staff data
  const [staffData] = useState([
    {
      id: 1,
      name: "Nguyễn Văn An",
      position: "Quản lý ca",
      department: "management",
      phone: "0901234567",
      email: "an.nguyen@restaurant.com",
      shift: "morning",
      status: "active",
      joinDate: "2023-01-15",
      avatar: null,
    },
    {
      id: 2,
      name: "Trần Thị Bình",
      position: "Phục vụ bàn",
      department: "service",
      phone: "0901234568",
      email: "binh.tran@restaurant.com",
      shift: "afternoon",
      status: "active",
      joinDate: "2023-02-20",
      avatar: null,
    },
    {
      id: 3,
      name: "Lê Minh Cường",
      position: "Đầu bếp chính",
      department: "kitchen",
      phone: "0901234569",
      email: "cuong.le@restaurant.com",
      shift: "morning",
      status: "break",
      joinDate: "2022-11-10",
      avatar: null,
    },
    {
      id: 4,
      name: "Phạm Thu Dung",
      position: "Thu ngân",
      department: "cashier",
      phone: "0901234570",
      email: "dung.pham@restaurant.com",
      shift: "afternoon",
      status: "active",
      joinDate: "2023-03-05",
      avatar: null,
    },
    {
      id: 5,
      name: "Hoàng Văn Em",
      position: "Phụ bếp",
      department: "kitchen",
      phone: "0901234571",
      email: "em.hoang@restaurant.com",
      shift: "morning",
      status: "inactive",
      joinDate: "2023-04-12",
      avatar: null,
    },
    {
      id: 6,
      name: "Vũ Thị Phương",
      position: "Phục vụ bàn",
      department: "service",
      phone: "0901234572",
      email: "phuong.vu@restaurant.com",
      shift: "night",
      status: "active",
      joinDate: "2023-05-18",
      avatar: null,
    },
  ]);

  const [currentView, setCurrentView] = useState("grid");
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Initialize filtered data
  useEffect(() => {
    setFilteredData(staffData);
  }, [staffData]);

  // Handle search and filters
  useEffect(() => {
    let filtered = staffData.filter((staff) => {
      const matchesSearch =
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.phone.includes(searchTerm) ||
        staff.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment =
        !departmentFilter || staff.department === departmentFilter;
      const matchesStatus = !statusFilter || staff.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });

    setFilteredData(filtered);
  }, [searchTerm, departmentFilter, statusFilter, staffData]);

  // Helper functions
  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getDepartmentName = (department) => {
    const departments = {
      kitchen: "Bếp",
      service: "Phục vụ",
      cashier: "Thu ngân",
      management: "Quản lý",
    };
    return departments[department] || department;
  };

  const getShiftName = (shift) => {
    const shifts = {
      morning: "Ca sáng",
      afternoon: "Ca chiều",
      night: "Ca tối",
    };
    return shifts[shift] || shift;
  };

  const getStatusName = (status) => {
    const statuses = {
      active: "Đang làm việc",
      inactive: "Nghỉ phép",
      break: "Nghỉ giải lao",
    };
    return statuses[status] || status;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  };

  // Modal functions
  const openAddModal = () => {
    setModalMode("add");
    setSelectedStaff(null);
    setIsModalOpen(true);
  };

  const openEditModal = (staff) => {
    setModalMode("edit");
    setSelectedStaff(staff);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedStaff(null);
  };

  // Action functions
  const handleViewStaff = (id) => {
    const staff = staffData.find((s) => s.id === id);
    alert(`Xem chi tiết nhân viên: ${staff.name}`);
  };

  const handleEditStaff = (id) => {
    const staff = staffData.find((s) => s.id === id);
    openEditModal(staff);
  };

  const handleDeleteStaff = (id) => {
    const staff = staffData.find((s) => s.id === id);
    if (window.confirm(`Bạn có chắc chắn muốn xóa nhân viên ${staff.name}?`)) {
      alert("Nhân viên đã được xóa!");
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    alert("Thông tin nhân viên đã được lưu!");
    closeModal();
  };

  const handleExportExcel = () => {
    alert("Xuất Excel thành công!");
  };

  // Calculate stats
  const stats = {
    total: staffData.length,
    active: staffData.filter((s) => s.status === "active").length,
    inactive: staffData.filter((s) => s.status === "inactive").length,
    new: staffData.filter((s) => {
      const joinDate = new Date(s.joinDate);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return joinDate > thirtyDaysAgo;
    }).length,
  };

  // Render staff card
  const renderStaffCard = (staff) => (
    <div key={staff.id} className="staff-card">
      <div className="staff-avatar">
        {staff.avatar ? (
          <img src={staff.avatar} alt={staff.name} />
        ) : (
          getInitials(staff.name)
        )}
        <div className={`status-indicator ${staff.status}`}></div>
      </div>
      <h3 className="staff-name">{staff.name}</h3>
      <p className="staff-position">{staff.position}</p>

      <div className="staff-info">
        <div className="info-row">
          <FontAwesomeIcon icon={faBuilding} className="info-icon" />
          <span>{getDepartmentName(staff.department)}</span>
        </div>
        <div className="info-row">
          <FontAwesomeIcon icon={faPhone} className="info-icon" />
          <span>{staff.phone}</span>
        </div>
        <div className="info-row">
          <FontAwesomeIcon icon={faClock} className="info-icon" />
          <span>{getShiftName(staff.shift)}</span>
        </div>
        <div className="info-row">
          <FontAwesomeIcon icon={faCalendar} className="info-icon" />
          <span>{formatDate(staff.joinDate)}</span>
        </div>
      </div>

      <div className="staff-actions">
        <button
          className="action-btn view"
          onClick={() => handleViewStaff(staff.id)}
          title="Xem chi tiết"
        >
          <FontAwesomeIcon icon={faEye} />
        </button>
        <button
          className="action-btn edit"
          onClick={() => handleEditStaff(staff.id)}
          title="Chỉnh sửa"
        >
          <FontAwesomeIcon icon={faEdit} />
        </button>
        <button
          className="action-btn delete"
          onClick={() => handleDeleteStaff(staff.id)}
          title="Xóa"
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    </div>
  );

  // Render table row
  const renderTableRow = (staff) => (
    <tr key={staff.id}>
      <td>
        <div className="employee-cell">
          <div className="table-avatar">
            {staff.avatar ? (
              <img src={staff.avatar} alt={staff.name} />
            ) : (
              getInitials(staff.name)
            )}
            <div className={`status-indicator ${staff.status}`}></div>
          </div>
          <div className="employee-info">
            <h4>{staff.name}</h4>
            <p>{staff.position}</p>
          </div>
        </div>
      </td>
      <td>{getDepartmentName(staff.department)}</td>
      <td>{staff.phone}</td>
      <td>{getShiftName(staff.shift)}</td>
      <td>
        <span className={`status-badge ${staff.status}`}>
          {getStatusName(staff.status)}
        </span>
      </td>
      <td>{formatDate(staff.joinDate)}</td>
      <td>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            className="action-btn view"
            onClick={() => handleViewStaff(staff.id)}
            title="Xem chi tiết"
          >
            <FontAwesomeIcon icon={faEye} />
          </button>
          <button
            className="action-btn edit"
            onClick={() => handleEditStaff(staff.id)}
            title="Chỉnh sửa"
          >
            <FontAwesomeIcon icon={faEdit} />
          </button>
          <button
            className="action-btn delete"
            onClick={() => handleDeleteStaff(staff.id)}
            title="Xóa"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </td>
    </tr>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="empty-state">
      <div className="empty-icon">
        <FontAwesomeIcon icon={faUsers} />
      </div>
      <h3>Không tìm thấy nhân viên</h3>
      <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
    </div>
  );

  return (
    <div className="staff-list-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <FontAwesomeIcon icon={faUsers} /> Quản Lý Nhân Viên
        </h1>
        <p className="page-subtitle">
          Theo dõi và quản lý thông tin nhân viên nhà hàng
        </p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <FontAwesomeIcon icon={faUsers} />
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Tổng nhân viên</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon active">
            <FontAwesomeIcon icon={faUserCheck} />
          </div>
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Đang làm việc</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon inactive">
            <FontAwesomeIcon icon={faUserClock} />
          </div>
          <div className="stat-value">{stats.inactive}</div>
          <div className="stat-label">Nghỉ phép</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon new">
            <FontAwesomeIcon icon={faUserPlus} />
          </div>
          <div className="stat-value">{stats.new}</div>
          <div className="stat-label">Nhân viên mới</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <div className="controls-left">
          <div className="search-container">
            <FontAwesomeIcon icon={faSearch} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm nhân viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">Tất cả bộ phận</option>
            <option value="kitchen">Bếp</option>
            <option value="service">Phục vụ</option>
            <option value="cashier">Thu ngân</option>
            <option value="management">Quản lý</option>
          </select>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang làm việc</option>
            <option value="inactive">Nghỉ phép</option>
            <option value="break">Nghỉ giải lao</option>
          </select>
        </div>

        <div className="controls-right">
          <div className="view-toggle">
            <button
              className={`view-btn ${currentView === "grid" ? "active" : ""}`}
              onClick={() => setCurrentView("grid")}
            >
              <FontAwesomeIcon icon={faThLarge} />
            </button>
            <button
              className={`view-btn ${currentView === "list" ? "active" : ""}`}
              onClick={() => setCurrentView("list")}
            >
              <FontAwesomeIcon icon={faList} />
            </button>
          </div>

          <button className="btn btn-secondary" onClick={handleExportExcel}>
            <FontAwesomeIcon icon={faDownload} />
            Xuất Excel
          </button>

          <button className="btn btn-primary" onClick={openAddModal}>
            <FontAwesomeIcon icon={faPlus} />
            Thêm nhân viên
          </button>
        </div>
      </div>

      {/* Staff Content */}
      <div id="staffContent">
        {currentView === "grid" ? (
          <div className="staff-grid">
            {filteredData.length === 0 ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <EmptyState />
              </div>
            ) : (
              filteredData.map(renderStaffCard)
            )}
          </div>
        ) : (
          <div className="staff-table-container">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Bộ phận</th>
                  <th>Số điện thoại</th>
                  <th>Ca làm việc</th>
                  <th>Trạng thái</th>
                  <th>Ngày vào làm</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  filteredData.map(renderTableRow)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button className="pagination-btn" disabled>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <button className="pagination-btn active">1</button>
        <button className="pagination-btn">2</button>
        <button className="pagination-btn">3</button>
        <button className="pagination-btn">
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div
          className="modal-overlay active"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === "add"
                  ? "Thêm nhân viên mới"
                  : "Chỉnh sửa thông tin nhân viên"}
              </h3>
              <button className="close-btn" onClick={closeModal}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleFormSubmit}>
                <div style={{ display: "grid", gap: "1rem" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontWeight: "500",
                      }}
                    >
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.5rem",
                      }}
                      placeholder="Nhập họ và tên"
                      defaultValue={selectedStaff?.name || ""}
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontWeight: "500",
                      }}
                    >
                      Bộ phận
                    </label>
                    <select
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.5rem",
                      }}
                      defaultValue={selectedStaff?.department || ""}
                      required
                    >
                      <option value="">Chọn bộ phận</option>
                      <option value="kitchen">Bếp</option>
                      <option value="service">Phục vụ</option>
                      <option value="cashier">Thu ngân</option>
                      <option value="management">Quản lý</option>
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontWeight: "500",
                      }}
                    >
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.5rem",
                      }}
                      placeholder="Nhập số điện thoại"
                      defaultValue={selectedStaff?.phone || ""}
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontWeight: "500",
                      }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.5rem",
                      }}
                      placeholder="Nhập email"
                      defaultValue={selectedStaff?.email || ""}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontWeight: "500",
                      }}
                    >
                      Ca làm việc
                    </label>
                    <select
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.5rem",
                      }}
                      defaultValue={selectedStaff?.shift || ""}
                      required
                    >
                      <option value="">Chọn ca làm việc</option>
                      <option value="morning">Ca sáng (6:00 - 14:00)</option>
                      <option value="afternoon">
                        Ca chiều (14:00 - 22:00)
                      </option>
                      <option value="night">Ca tối (22:00 - 6:00)</option>
                    </select>
                  </div>
                  <div
                    style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeModal}
                      style={{ flex: 1 }}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      <FontAwesomeIcon icon={faSave} />
                      Lưu
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffList;
