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

// --- DỮ LIỆU MẪU ĐỂ TEST GIAO DIỆN ---
const SAMPLE_DATA = [
  {
    id: 1,
    code: "NV001",
    name: "Nguyễn Nhật Minh",
    role: "Bếp Trưởng",
    department: "kitchen",
    status: "active",
    phone: "0901234567",
    email: "minh.nguyen@restaurant.com",
    avatar: "https://i.pravatar.cc/150?img=11",
    startDate: "2022-01-15",
    salary: 15000000,
    address: "Q1, TP.HCM",
    shift: "Ca gãy (10:00 - 14:00 & 17:00 - 22:00)",
  },
  {
    id: 2,
    code: "NV002",
    name: "Trần Thị Thu Hà",
    role: "Quản Lý Nhà Hàng",
    department: "management",
    status: "active",
    phone: "0909888777",
    email: "ha.tran@restaurant.com",
    avatar: "https://i.pravatar.cc/150?img=5",
    startDate: "2021-05-20",
    salary: 20000000,
    address: "Q3, TP.HCM",
    shift: "Hành chính",
  },
  {
    id: 3,
    code: "NV003",
    name: "Phạm Văn Long",
    role: "Phục Vụ",
    department: "service",
    status: "break",
    phone: "0933444555",
    email: "long.pham@restaurant.com",
    avatar: null, // Test trường hợp không có avatar
    startDate: "2023-03-10",
    salary: 6000000,
    address: "Q.Bình Thạnh, TP.HCM",
    shift: "Ca sáng (06:00 - 14:00)",
  },
  {
    id: 4,
    code: "NV004",
    name: "Lê Tuyết Mai",
    role: "Thu Ngân",
    department: "cashier",
    status: "active",
    phone: "0912333444",
    email: "mai.le@restaurant.com",
    avatar: "https://i.pravatar.cc/150?img=9",
    startDate: "2023-06-01",
    salary: 7000000,
    address: "Q.Tân Bình, TP.HCM",
    shift: "Ca chiều (14:00 - 22:00)",
  },
  {
    id: 5,
    code: "NV005",
    name: "Hoàng Văn Nam",
    role: "Phụ Bếp",
    department: "kitchen",
    status: "active",
    phone: "0987654321",
    email: "nam.hoang@restaurant.com",
    avatar: "https://i.pravatar.cc/150?img=13",
    startDate: "2023-08-15",
    salary: 5500000,
    address: "Q12, TP.HCM",
    shift: "Full-time",
  },
  {
    id: 6,
    code: "NV006",
    name: "Đỗ Thị Bích",
    role: "Tạp Vụ",
    department: "cleaning",
    status: "inactive",
    phone: "0911222333",
    email: "bich.do@email.com",
    avatar: null,
    startDate: "2022-11-01",
    salary: 5000000,
    address: "Hóc Môn, TP.HCM",
    shift: "Ca sáng",
  },
  {
    id: 7,
    code: "NV007",
    name: "Vũ Tuấn Anh",
    role: "Phục Vụ",
    department: "service",
    status: "active",
    phone: "0944555666",
    email: "anh.vu@restaurant.com",
    avatar: "https://i.pravatar.cc/150?img=60",
    startDate: "2023-09-05",
    salary: 6000000,
    address: "Q4, TP.HCM",
    shift: "Ca tối",
  },
  {
    id: 8,
    code: "NV008",
    name: "Ngô Thanh Vân",
    role: "Pha Chế (Bartender)",
    department: "service",
    status: "break",
    phone: "0977888999",
    email: "van.ngo@restaurant.com",
    avatar: "https://i.pravatar.cc/150?img=32",
    startDate: "2023-02-20",
    salary: 8000000,
    address: "Q7, TP.HCM",
    shift: "Ca tối",
  },
];

const EmployeeList = ({ employees, selectedEmployee, onEmployeeSelect }) => {
  // Ưu tiên dùng props, nếu không có thì dùng SAMPLE_DATA
  const dataSource =
    employees && employees.length > 0 ? employees : SAMPLE_DATA;

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // --- LOGIC LỌC ---
  const filteredEmployees = useMemo(() => {
    return dataSource.filter((employee) => {
      const searchLower = searchQuery.toLowerCase();
      // Tìm kiếm an toàn (null check)
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
    console.log(`Action clicked: ${type}`);
    // Thực tế sẽ gọi onEdit / onDelete từ props
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
            <option value="cleaning">Vệ sinh</option>
          </select>
        </div>
      </div>

      {/* 3. TABLE HEADER */}
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
