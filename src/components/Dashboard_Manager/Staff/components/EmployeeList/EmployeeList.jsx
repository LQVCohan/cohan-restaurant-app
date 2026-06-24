import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  Users,
  ChevronLeft,
  ChevronRight,
  SearchX,
  RotateCcw,
} from "lucide-react";
import EmployeeItem from "./EmployeeItem";
import { matchesEmployeeSearch } from "../../../../../utils/employeeSearch";
import { DEPARTMENT_OPTIONS } from "../../../../../utils/staffRoleOptions";
import "./EmployeeList.scss";

const EMPLOYEE_LIST_PAGE_SIZE = 14;

const EmployeeList = ({
  employees = [],
  selectedEmployee,
  focusedEmployeeId = "",
  onEmployeeSelect,
  onEmployeeAction,
  roleList = [],
  loading = false,
  error = null,
  onRetry,
}) => {
  const dataSource = employees;

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = EMPLOYEE_LIST_PAGE_SIZE;

  const filteredEmployees = useMemo(() => {
    return dataSource.filter((employee) => {
      const matchesSearch = matchesEmployeeSearch(employee, searchQuery);
      const matchesDepartment =
        departmentFilter === "all" || employee.department === departmentFilter;
      const matchesEmploymentStatus =
        employmentStatusFilter === "all" || employee.employmentStatus === employmentStatusFilter;
      const matchesAccountStatus =
        accountStatusFilter === "all" || employee.accountStatus === accountStatusFilter;
      const matchesVerification =
        verificationFilter === "all" || employee.verificationStatus === verificationFilter;
      const matchesRole =
        roleFilter === "all" || employee.roleId === roleFilter || employee.roleSlug === roleFilter;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesEmploymentStatus &&
        matchesAccountStatus &&
        matchesVerification &&
        matchesRole
      );
    });
  }, [
    dataSource,
    searchQuery,
    departmentFilter,
    employmentStatusFilter,
    accountStatusFilter,
    verificationFilter,
    roleFilter,
  ]);

  const hasActiveFilters = Boolean(
    searchQuery ||
      departmentFilter !== "all" ||
      employmentStatusFilter !== "all" ||
      accountStatusFilter !== "all" ||
      verificationFilter !== "all" ||
      roleFilter !== "all",
  );
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const rangeStart = filteredEmployees.length
    ? (currentPage - 1) * itemsPerPage + 1
    : 0;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filteredEmployees.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, employmentStatusFilter, accountStatusFilter, verificationFilter, roleFilter]);

  useEffect(() => {
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
      return;
    }
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const clearFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("all");
    setEmploymentStatusFilter("all");
    setAccountStatusFilter("all");
    setVerificationFilter("all");
    setRoleFilter("all");
  };

  return (
    <div className="employee-list-card fade-in">
      <div className="list-header-wrapper">
        <div className="header-title-box">
          <div className="icon-box">
            <Users size={20} />
          </div>
          <div>
            <h3 className="title">Danh sách nhân sự</h3>
            <p className="subtitle" aria-live="polite">
              {filteredEmployees.length === dataSource.length
                ? `${dataSource.length} hồ sơ nhân viên`
                : `${filteredEmployees.length}/${dataSource.length} hồ sơ phù hợp`}
            </p>
          </div>
        </div>

        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Tìm tên, SĐT, email..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Tìm nhân viên theo tên, số điện thoại hoặc email"
          />
        </div>
      </div>

      <div className="filters-toolbar">
        <div className="status-tabs" aria-label="Lọc theo trạng thái lao động">
          {[
            { key: "all", label: "Tất cả" },
            { key: "WORKING", label: "Đang làm" },
            { key: "ON_LEAVE", label: "Tạm nghỉ" },
            { key: "RESIGNED", label: "Nghỉ việc" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${employmentStatusFilter === tab.key ? "active" : ""}`}
              onClick={() => setEmploymentStatusFilter(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="filter-select-wrapper">
          <Filter size={16} className="filter-icon" />
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="custom-select"
            aria-label="Lọc theo bộ phận"
          >
            <option value="all">Bộ phận</option>
            {DEPARTMENT_OPTIONS.map((department) => (
              <option key={department.value} value={department.value}>
                {department.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-select-wrapper">
          <Filter size={16} className="filter-icon" />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="custom-select"
            aria-label="Lọc theo vai trò"
          >
            <option value="all">Vai trò</option>
            {roleList.map((role) => (
              <option key={role.id || role.slug} value={role.id || role.slug}>
                {role.name || role.slug}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-select-wrapper">
          <Filter size={16} className="filter-icon" />
          <select
            value={accountStatusFilter}
            onChange={(event) => setAccountStatusFilter(event.target.value)}
            className="custom-select"
            aria-label="Lọc theo trạng thái tài khoản"
          >
            <option value="all">Tài khoản</option>
            <option value="active">Đang hoạt động</option>
            <option value="blocked">Bị khóa</option>
            <option value="pending">Chờ xác minh</option>
          </select>
        </div>

        <div className="filter-select-wrapper">
          <Filter size={16} className="filter-icon" />
          <select
            value={verificationFilter}
            onChange={(event) => setVerificationFilter(event.target.value)}
            className="custom-select"
            aria-label="Lọc theo xác minh"
          >
            <option value="all">Xác minh</option>
            <option value="verified">Đã xác minh</option>
            <option value="pending">Chờ xác minh</option>
            <option value="unverified">Chưa xác minh</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="clear-filters-btn"
            onClick={clearFilters}
            title="Xóa toàn bộ bộ lọc"
            aria-label="Xóa toàn bộ bộ lọc"
          >
            <RotateCcw size={15} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      <div className="table-header-row">
        <div className="th col-main">Thông tin nhân viên</div>
        <div className="th col-role">Vị trí</div>
        <div className="th col-contact">Liên hệ</div>
        <div className="th col-actions">Thao tác</div>
      </div>

      <div className="list-body custom-scrollbar">
        {loading ? (
          <div className="list-skeleton" aria-label="Đang tải danh sách nhân viên">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div className="skeleton-row" key={item}>
                <span className="skeleton-avatar" />
                <span className="skeleton-line primary" />
                <span className="skeleton-line secondary" />
                <span className="skeleton-pill" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-state error-state">
            <div className="icon-wrapper">
              <SearchX size={48} />
            </div>
            <h4>Không tải được nhân viên</h4>
            <p>{error?.message || "Vui lòng kiểm tra kết nối hoặc thử lại."}</p>
            {onRetry && (
              <button type="button" className="retry-btn" onClick={() => onRetry()}>
                Thử lại
              </button>
            )}
          </div>
        ) : paginatedEmployees.length > 0 ? (
          paginatedEmployees.map((employee) => (
            <EmployeeItem
              key={employee.id || employee.email}
              employee={employee}
              isSelected={selectedEmployee?.id === employee.id}
              isFocusedFromSchedule={focusedEmployeeId === String(employee.id)}
              onClick={() => onEmployeeSelect?.(employee)}
              onAction={onEmployeeAction}
            />
          ))
        ) : (
          <div className="empty-state">
            <div className="icon-wrapper">
              <SearchX size={48} />
            </div>
            <h4>Không tìm thấy nhân viên</h4>
            <p>
              {hasActiveFilters
                ? "Thử đổi bộ lọc hoặc kiểm tra nhà hàng đang chọn."
                : "Nhà hàng này chưa có hồ sơ nhân viên đang hiển thị."}
            </p>
            {hasActiveFilters && (
              <button type="button" className="retry-btn" onClick={clearFilters}>
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </div>

      {filteredEmployees.length > 0 && (
        <div className="list-footer">
          <span className="page-info">
            Hiển thị {rangeStart}–{rangeEnd} / {filteredEmployees.length} nhân viên
          </span>
          {totalPages > 1 && (
            <div className="pagination-controls" aria-label="Chuyển trang danh sách nhân viên">
              <button
                className="pagi-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                type="button"
                aria-label="Trang trước"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="page-info">Trang {currentPage}/{totalPages}</span>
              <button
                className="pagi-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                type="button"
                aria-label="Trang sau"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
