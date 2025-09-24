import React from "react";
import EmployeeList from "../EmployeeList/EmployeeList";
import EmployeeDetail from "../EmployeeDetail/EmployeeDetail";
import QuickActions from "../QuickActions/QuickActions";
import "./EmployeeDashboard.scss";

const EmployeeDashboard = ({
  employees,
  selectedEmployee,
  onEmployeeSelect,
  onEditEmployee,
  onViewHistory,
  onDeleteEmployee,
  onPageChange,
}) => {
  const handleCalculateSalary = () => {
    alert("💰 Tính lương tháng cho nhân viên...\n(Tính năng demo)");
  };

  return (
    <div className="employee-dashboard">
      <QuickActions onPageChange={onPageChange} />

      <div className="main-grid">
        <EmployeeList
          employees={employees}
          selectedEmployee={selectedEmployee}
          onEmployeeSelect={onEmployeeSelect}
        />

        <EmployeeDetail
          employee={selectedEmployee}
          onEdit={onEditEmployee}
          onViewHistory={onViewHistory}
          onCalculateSalary={handleCalculateSalary}
          onDelete={onDeleteEmployee}
        />
      </div>
    </div>
  );
};

export default EmployeeDashboard;
