import React, { useState, useMemo } from "react";
import EmployeeItem from "./EmployeeItem";
import "./EmployeeList.scss";

const EmployeeList = ({ employees, selectedEmployee, onEmployeeSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch =
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment =
        departmentFilter === "all" || employee.department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" || employee.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchQuery, departmentFilter, statusFilter]);

  return (
    <div className="employee-list-card">
      <div className="list-header">
        <h3 className="list-title">📋 Danh Sách Nhân Viên</h3>
        <div className="list-controls">
          <input
            type="text"
            className="search-box"
            placeholder="🔍 Tìm kiếm nhân viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="filter-select"
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

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">📊 Tất cả trạng thái</option>
            <option value="active">✅ Đang làm việc</option>
            <option value="break">☕ Nghỉ giải lao</option>
            <option value="inactive">❌ Vắng mặt</option>
          </select>
        </div>
      </div>

      <div className="employee-list">
        {filteredEmployees.map((employee) => (
          <EmployeeItem
            key={employee.id}
            employee={employee}
            isSelected={selectedEmployee?.id === employee.id}
            onClick={() => onEmployeeSelect(employee)}
          />
        ))}
      </div>
    </div>
  );
};

export default EmployeeList;
