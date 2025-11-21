import React, { useState, useMemo } from "react";
import EmployeeItem from "./EmployeeItem";
import "./EmployeeList.scss";

// --- DATA MẪU (Sẽ hiển thị khi chưa có dữ liệu từ API) ---
const MOCK_EMPLOYEES = [
  {
    id: 1,
    code: "NV001",
    name: "Nguyễn Nhật Minh",
    role: "Cửa hàng trưởng",
    department: "management",
    status: "active",
    email: "minh.nguyen@foodhub.vn",
    phone: "0909.123.456",
    address: "123 Nguyễn Huệ, Q.1, TP.HCM",
    avatar: "https://i.pravatar.cc/150?img=11",
    startDate: "2022-01-15",
    salary: 15000000,
    shift: "FULL",
    performance: "Xuất sắc (98/100)",
  },
  {
    id: 2,
    code: "NV002",
    name: "Trần Thị Thu Hà",
    role: "Bếp chính",
    department: "kitchen",
    status: "active",
    email: "ha.tran@foodhub.vn",
    phone: "0912.345.678",
    address: "45 Lê Lợi, Q.1, TP.HCM",
    avatar: "https://i.pravatar.cc/150?img=5",
    startDate: "2022-03-10",
    salary: 12000000,
    shift: "MORNING",
    performance: "Tốt (85/100)",
  },
  {
    id: 3,
    code: "NV003",
    name: "Lê Văn Cường",
    role: "Phục vụ",
    department: "service",
    status: "break",
    email: "cuong.le@foodhub.vn",
    phone: "0933.444.555",
    address: "88 Trần Hưng Đạo, Q.5, TP.HCM",
    avatar: null, // Test avatar chữ cái
    startDate: "2023-06-01",
    salary: 7000000,
    shift: "AFTERNOON",
    performance: "Khá (78/100)",
  },
  {
    id: 4,
    code: "NV004",
    name: "Phạm Hoàng Yến",
    role: "Thu ngân",
    department: "cashier",
    status: "active",
    email: "yen.pham@foodhub.vn",
    phone: "0944.555.666",
    address: "12 Nguyễn Trãi, Q.5, TP.HCM",
    avatar: "https://i.pravatar.cc/150?img=9",
    startDate: "2023-02-20",
    salary: 8500000,
    shift: "FULL",
    performance: "Giỏi (90/100)",
  },
  {
    id: 5,
    code: "NV005",
    name: "Đỗ Minh Tuấn",
    role: "Phụ bếp",
    department: "kitchen",
    status: "inactive",
    email: "tuan.do@foodhub.vn",
    phone: "0988.777.666",
    address: "Khu dân cư Trung Sơn, Bình Chánh",
    avatar: null,
    startDate: "2023-11-05",
    salary: 6000000,
    shift: "EVENING",
    performance: "Trung bình (65/100)",
  },
  {
    id: 6,
    code: "NV006",
    name: "Vũ Thị Mai",
    role: "Tạp vụ / Vệ sinh",
    department: "cleaning",
    status: "active",
    email: "mai.vu@foodhub.vn",
    phone: "0905.111.222",
    address: "Hẻm 50 Quang Trung, Gò Vấp",
    avatar: "https://i.pravatar.cc/150?img=24",
    startDate: "2021-10-10",
    salary: 6500000,
    shift: "MORNING",
    performance: "Tốt (88/100)",
  },
  {
    id: 7,
    code: "NV007",
    name: "Huỳnh Tấn Tài",
    role: "Phục vụ Part-time",
    department: "service",
    status: "active",
    email: "tai.huynh@foodhub.vn",
    phone: "0368.999.888",
    address: "Ký túc xá ĐHQG, Thủ Đức",
    avatar: null,
    startDate: "2024-01-01",
    salary: 3500000,
    shift: "PART_TIME",
    performance: "Mới vào",
  },
  {
    id: 8,
    code: "NV008",
    name: "Ngô Bảo Châu",
    role: "Pha chế (Bartender)",
    department: "kitchen",
    status: "break",
    email: "chau.ngo@foodhub.vn",
    phone: "0914.567.890",
    address: "Chung cư Masteri, Q.2",
    avatar: "https://i.pravatar.cc/150?img=32",
    startDate: "2022-12-12",
    salary: 9000000,
    shift: "EVENING",
    performance: "Xuất sắc (95/100)",
  },
];

const EmployeeList = ({ employees, selectedEmployee, onEmployeeSelect }) => {
  // 🔥 LOGIC QUAN TRỌNG: Nếu employees từ API rỗng (hoặc chưa load), dùng Mock Data
  const dataSource =
    employees && employees.length > 0 ? employees : MOCK_EMPLOYEES;

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
