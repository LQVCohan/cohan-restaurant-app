import React, { useState } from "react";
import "./StaffPayroll.scss";

const StaffPayroll = () => {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [filterDepartment, setFilterDepartment] = useState("all");

  // Mock payroll data
  const payrollData = [
    {
      id: 1,
      staffId: 1,
      name: "Nguyễn Văn A",
      position: "Bếp trưởng",
      department: "Bếp",
      avatar: "👨‍🍳",
      baseSalary: 15000000,
      workingDays: 26,
      totalDays: 26,
      overtimeHours: 12,
      overtimeRate: 50000,
      bonus: 2000000,
      deductions: 500000,
      insurance: 1200000,
      tax: 1800000,
      netSalary: 15510000,
      status: "paid",
    },
    {
      id: 2,
      staffId: 2,
      name: "Trần Thị B",
      position: "Phục vụ trưởng",
      department: "Phục vụ",
      avatar: "👩‍💼",
      baseSalary: 12000000,
      workingDays: 24,
      totalDays: 26,
      overtimeHours: 8,
      overtimeRate: 40000,
      bonus: 1000000,
      deductions: 200000,
      insurance: 960000,
      tax: 1200000,
      netSalary: 11160000,
      status: "pending",
    },
    {
      id: 3,
      staffId: 3,
      name: "Lê Văn C",
      position: "Thu ngân",
      department: "Thu ngân",
      avatar: "👨‍💼",
      baseSalary: 9000000,
      workingDays: 26,
      totalDays: 26,
      overtimeHours: 4,
      overtimeRate: 35000,
      bonus: 500000,
      deductions: 0,
      insurance: 720000,
      tax: 800000,
      netSalary: 8420000,
      status: "paid",
    },
    {
      id: 4,
      staffId: 4,
      name: "Phạm Thị D",
      position: "Phục vụ",
      department: "Phục vụ",
      avatar: "👩‍🍳",
      baseSalary: 8000000,
      workingDays: 22,
      totalDays: 26,
      overtimeHours: 0,
      overtimeRate: 30000,
      bonus: 300000,
      deductions: 100000,
      insurance: 640000,
      tax: 600000,
      netSalary: 6760000,
      status: "pending",
    },
  ];

  const departments = ["Tất cả", "Bếp", "Phục vụ", "Thu ngân", "Quản lý"];

  const payrollSummary = {
    totalStaff: payrollData.length,
    totalBaseSalary: payrollData.reduce((sum, p) => sum + p.baseSalary, 0),
    totalBonus: payrollData.reduce((sum, p) => sum + p.bonus, 0),
    totalDeductions: payrollData.reduce((sum, p) => sum + p.deductions, 0),
    totalNetSalary: payrollData.reduce((sum, p) => sum + p.netSalary, 0),
    paidCount: payrollData.filter((p) => p.status === "paid").length,
    pendingCount: payrollData.filter((p) => p.status === "pending").length,
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const getStatusConfig = (status) => {
    const configs = {
      paid: { label: "Đã trả", class: "success", icon: "fas fa-check-circle" },
      pending: { label: "Chờ trả", class: "warning", icon: "fas fa-clock" },
      processing: {
        label: "Đang xử lý",
        class: "info",
        icon: "fas fa-spinner",
      },
    };
    return (
      configs[status] || {
        label: status,
        class: "secondary",
        icon: "fas fa-question",
      }
    );
  };

  const calculateGrossSalary = (record) => {
    const dailySalary = record.baseSalary / record.totalDays;
    const workingSalary = dailySalary * record.workingDays;
    const overtimePay = record.overtimeHours * record.overtimeRate;
    return workingSalary + overtimePay + record.bonus;
  };

  const filteredPayroll = payrollData.filter((record) => {
    return filterDepartment === "all" || record.department === filterDepartment;
  });

  return (
    <div className="staff-payroll">
      {/* Header */}
      <div className="payroll-header">
        <div className="header-left">
          <h2>Bảng lương nhân viên</h2>
          <p>
            Quản lý lương và thưởng cho tháng{" "}
            {new Date(selectedMonth).toLocaleDateString("vi-VN", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="header-controls">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="month-picker"
          />
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="department-filter"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept === "Tất cả" ? "all" : dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="payroll-summary">
        <div className="summary-card summary-card--primary">
          <div className="summary-icon">
            <i className="fas fa-users" />
          </div>
          <div className="summary-content">
            <h3>{payrollSummary.totalStaff}</h3>
            <p>Tổng nhân viên</p>
          </div>
        </div>

        <div className="summary-card summary-card--success">
          <div className="summary-icon">
            <i className="fas fa-money-bill-wave" />
          </div>
          <div className="summary-content">
            <h3>{formatCurrency(payrollSummary.totalNetSalary)}</h3>
            <p>Tổng lương thực nhận</p>
          </div>
        </div>

        <div className="summary-card summary-card--warning">
          <div className="summary-icon">
            <i className="fas fa-gift" />
          </div>
          <div className="summary-content">
            <h3>{formatCurrency(payrollSummary.totalBonus)}</h3>
            <p>Tổng thưởng</p>
          </div>
        </div>

        <div className="summary-card summary-card--info">
          <div className="summary-icon">
            <i className="fas fa-check-circle" />
          </div>
          <div className="summary-content">
            <h3>
              {payrollSummary.paidCount}/{payrollSummary.totalStaff}
            </h3>
            <p>Đã thanh toán</p>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="payroll-table-container">
        <div className="table-header">
          <h3>Chi tiết bảng lương</h3>
          <div className="table-actions">
            <button className="btn btn--secondary">
              <i className="fas fa-file-excel" />
              Xuất Excel
            </button>
            <button className="btn btn--success">
              <i className="fas fa-calculator" />
              Tính lương
            </button>
            <button className="btn btn--primary">
              <i className="fas fa-credit-card" />
              Thanh toán hàng loạt
            </button>
          </div>
        </div>

        <div className="payroll-table">
          <table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Lương cơ bản</th>
                <th>Ngày công</th>
                <th>Tăng ca</th>
                <th>Thưởng</th>
                <th>Khấu trừ</th>
                <th>Bảo hiểm</th>
                <th>Thuế</th>
                <th>Thực nhận</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayroll.map((record) => {
                const statusConfig = getStatusConfig(record.status);
                const grossSalary = calculateGrossSalary(record);

                return (
                  <tr key={record.id}>
                    <td>
                      <div className="staff-info">
                        <span className="staff-avatar">{record.avatar}</span>
                        <div className="staff-details">
                          <span className="staff-name">{record.name}</span>
                          <span className="staff-position">
                            {record.position}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="salary-amount">
                        {formatCurrency(record.baseSalary)}
                      </span>
                    </td>
                    <td>
                      <div className="working-days">
                        <span className="days-worked">
                          {record.workingDays}
                        </span>
                        <span className="days-total">/{record.totalDays}</span>
                      </div>
                    </td>
                    <td>
                      <div className="overtime-info">
                        <span className="overtime-hours">
                          {record.overtimeHours}h
                        </span>
                        <span className="overtime-amount">
                          {formatCurrency(
                            record.overtimeHours * record.overtimeRate
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="bonus-amount">
                        {formatCurrency(record.bonus)}
                      </span>
                    </td>
                    <td>
                      <span className="deduction-amount">
                        {formatCurrency(record.deductions)}
                      </span>
                    </td>
                    <td>
                      <span className="insurance-amount">
                        {formatCurrency(record.insurance)}
                      </span>
                    </td>
                    <td>
                      <span className="tax-amount">
                        {formatCurrency(record.tax)}
                      </span>
                    </td>
                    <td>
                      <span className="net-salary">
                        {formatCurrency(record.netSalary)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-badge status-badge--${statusConfig.class}`}
                      >
                        <i className={statusConfig.icon} />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn" title="Xem chi tiết">
                          <i className="fas fa-eye" />
                        </button>
                        <button className="action-btn" title="Chỉnh sửa">
                          <i className="fas fa-edit" />
                        </button>
                        {record.status === "pending" && (
                          <button
                            className="action-btn action-btn--success"
                            title="Thanh toán"
                          >
                            <i className="fas fa-credit-card" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payroll Actions */}
      <div className="payroll-actions">
        <h3>Thao tác bảng lương</h3>
        <div className="action-grid">
          <button className="payroll-action-card">
            <i className="fas fa-calculator" />
            <div className="action-content">
              <h4>Tính lương tự động</h4>
              <p>Tính toán lương dựa trên chấm công</p>
            </div>
          </button>

          <button className="payroll-action-card">
            <i className="fas fa-plus-circle" />
            <div className="action-content">
              <h4>Thêm thưởng/phạt</h4>
              <p>Điều chỉnh thưởng và khấu trừ</p>
            </div>
          </button>

          <button className="payroll-action-card">
            <i className="fas fa-file-invoice" />
            <div className="action-content">
              <h4>Tạo phiếu lương</h4>
              <p>In phiếu lương cho nhân viên</p>
            </div>
          </button>

          <button className="payroll-action-card">
            <i className="fas fa-chart-bar" />
            <div className="action-content">
              <h4>Báo cáo lương</h4>
              <p>Thống kê chi phí nhân sự</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffPayroll;
