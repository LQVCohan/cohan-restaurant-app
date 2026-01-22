import React, { useState, useMemo } from "react";
import EmployeeItem from "./EmployeeItem";
import "./EmployeeList.scss";

const EmployeeList = ({ employees, selectedEmployee, onEmployeeSelect }) => {
  const dataSource = employees || [];

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // Dùng cho Tabs
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Số lượng hiển thị mỗi trang

  // --- LOGIC LỌC DỮ LIỆU ---
  const filteredEmployees = useMemo(() => {
    return dataSource.filter((employee) => {
      const searchLower = searchQuery.toLowerCase();

      const matchesSearch =
        (employee.name && employee.name.toLowerCase().includes(searchLower)) ||
        (employee.role && employee.role.toLowerCase().includes(searchLower)) ||
        (employee.code && employee.code.toLowerCase().includes(searchLower));

      const matchesDepartment =
        departmentFilter === "all" || employee.department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" || employee.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [dataSource, searchQuery, departmentFilter, statusFilter]);

  // --- LOGIC PHÂN TRANG ---
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset trang về 1 khi filter thay đổi
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, statusFilter]);

  // --- HANDLERS ---
  const handleActionClick = (e, employee, action) => {
    e.stopPropagation(); // Ngăn chặn sự kiện click vào hàng
    alert(`Thao tác: ${action.toUpperCase()} trên nhân viên ${employee.name}`);
    // Ở đây bạn có thể gọi prop onEdit, onDelete truyền từ cha xuống
  };

  return (
    <div className="employee-list-card">
      {/* 1. HEADER: TITLE & SEARCH */}
      <div className="list-header-top">
        <div className="header-left">
          <h3 className="list-title">Danh Sách Nhân Sự</h3>
          <span className="list-subtitle">
            Quản lý {dataSource.length} hồ sơ nhân viên
          </span>
        </div>
        <div className="search-wrapper">
          <i className="search-icon">🔍</i>
          <input
            type="text"
            className="search-input"
            placeholder="Tìm tên, mã NV, chức vụ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 2. CONTROLS: TABS & DEPT FILTER */}
      <div className="list-controls-bar">
        <div className="status-tabs">
          {[
            { key: "all", label: "Tất cả" },
            { key: "active", label: "Đang làm" },
            { key: "break", label: "Nghỉ ngơi" },
            { key: "inactive", label: "Vắng mặt" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${statusFilter === tab.key ? "active" : ""}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          className="dept-select"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="all">🏢 Tất cả phòng ban</option>
          <option value="kitchen">👨‍🍳 Bếp</option>
          <option value="service">🍽️ Phục vụ</option>
          <option value="cashier">💰 Thu ngân</option>
          <option value="management">📊 Quản lý</option>
          <option value="cleaning">🧹 Vệ sinh</option>
        </select>
      </div>

      {/* 3. TABLE HEADER ROW */}
      <div className="table-header-row">
        <div className="col col-info">Nhân viên</div>
        <div className="col col-contact">Liên hệ</div>
        <div className="col col-dept">Bộ phận</div>
        <div className="col col-status">Trạng thái</div>
        <div className="col col-actions"></div>
      </div>

      {/* 4. LIST BODY (SCROLLABLE) */}
      <div className="employee-list-body">
        {paginatedEmployees.length > 0 ? (
          paginatedEmployees.map((employee) => (
            <EmployeeItem
              key={employee.id}
              employee={employee}
              isSelected={selectedEmployee?.id === employee.id}
              onClick={() => onEmployeeSelect(employee)}
              onAction={(e, action) => handleActionClick(e, employee, action)}
            />
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🕵️‍♀️</div>
            <p>Không tìm thấy nhân viên nào phù hợp với bộ lọc.</p>
          </div>
        )}
      </div>

      {/* 5. PAGINATION FOOTER */}
      {totalPages > 1 && (
        <div className="staff-pagination-footer">
          <div className="staff-pagination">
            <button
              className="staff-page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Trang trước"
            >
              ‹
            </button>

            <div className="staff-page-info">
              <span className="staff-page-number">{currentPage}</span>
              <span className="staff-page-sep">/</span>
              <span className="staff-page-number">{totalPages}</span>
            </div>

            <button
              className="staff-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Trang sau"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
