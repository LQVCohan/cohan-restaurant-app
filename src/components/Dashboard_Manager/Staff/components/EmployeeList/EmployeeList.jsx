import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Users,
  ChevronLeft,
  ChevronRight,
  SearchX,
} from "lucide-react";
import EmployeeItem from "./EmployeeItem";
import "./EmployeeList.scss";

const EmployeeList = ({ employees, selectedEmployee, onEmployeeSelect }) => {
  const dataSource = employees || [];
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // --- LOGIC LỌC ---
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
    currentPage * itemsPerPage,
  );

  // Reset về trang 1 khi filter đổi
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, statusFilter]);

  // --- HANDLERS ---
  const handleActionClick = (e, type) => {
    // Logic xử lý Edit/Delete gọi từ Item lên
    console.log(`Action: ${type}`);
    // Thực tế bạn sẽ gọi props onEdit/onDelete từ cha truyền xuống
  };

  return (
    <div className="employee-list-card fade-in">
      {/* 1. HEADER & SEARCH BAR */}
      <div className="list-header-wrapper">
        <div className="header-title-box">
          <div className="icon-box">
            <Users size={20} />
          </div>
          <div>
            <h3 className="title">Danh sách nhân sự</h3>
            <p className="subtitle">{dataSource.length} hồ sơ nhân viên</p>
          </div>
        </div>

        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Tìm theo tên, mã NV..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 2. FILTERS TOOLBAR */}
      <div className="filters-toolbar">
        {/* Tabs Status */}
        <div className="status-tabs">
          {[
            { key: "all", label: "Tất cả" },
            { key: "active", label: "Đang làm" },
            { key: "break", label: "Nghỉ" },
            { key: "inactive", label: "Vắng" },
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

        {/* Dept Filter Dropdown */}
        <div className="filter-select-wrapper">
          <Filter size={16} className="filter-icon" />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="custom-select"
          >
            <option value="all">Tất cả bộ phận</option>
            <option value="kitchen">Bếp</option>
            <option value="service">Phục vụ</option>
            <option value="cashier">Thu ngân</option>
            <option value="management">Quản lý</option>
          </select>
        </div>
      </div>

      {/* 3. TABLE HEADER (Grid aligned with Item) */}
      <div className="table-header-row">
        <div className="th col-main">Thông tin nhân viên</div>
        <div className="th col-role">Vị trí</div>
        <div className="th col-contact">Liên hệ</div>
        <div className="th col-actions"></div>
      </div>

      {/* 4. LIST CONTENT */}
      <div className="list-body custom-scrollbar">
        {paginatedEmployees.length > 0 ? (
          paginatedEmployees.map((employee) => (
            <EmployeeItem
              key={employee.id}
              employee={employee}
              isSelected={selectedEmployee?.id === employee.id}
              onClick={() => onEmployeeSelect(employee)}
              onAction={handleActionClick}
            />
          ))
        ) : (
          <div className="empty-state">
            <div className="icon-wrapper">
              <SearchX size={48} />
            </div>
            <h4>Không tìm thấy kết quả</h4>
            <p>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
          </div>
        )}
      </div>

      {/* 5. PAGINATION */}
      {totalPages > 1 && (
        <div className="list-footer">
          <span className="page-info">
            Trang <strong>{currentPage}</strong> / {totalPages}
          </span>
          <div className="pagination-controls">
            <button
              className="pagi-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="pagi-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
