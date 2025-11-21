import React from "react";
import EmployeeList from "../EmployeeList/EmployeeList"; // Kiểm tra lại đường dẫn import của bạn nếu cần
import EmployeeDetail from "../EmployeeDetail/EmployeeDetail";
import "./EmployeeDashboard.scss";

const EmployeeDashboard = ({
  employees,
  selectedEmployee,
  onEmployeeSelect,
  onEditEmployee,
  onViewHistory,
  onDeleteEmployee,
  // onPageChange: Không cần thiết nữa vì EmployeeList tự xử lý phân trang nội bộ
}) => {
  const handleCalculateSalary = () => {
    alert("💰 Tính lương tháng cho nhân viên...\n(Tính năng demo)");
  };

  return (
    <div className="employee-dashboard">
      {/* CỘT TRÁI: Danh sách (Chiếm 40%) */}
      <div className="dashboard-left">
        <EmployeeList
          employees={employees}
          selectedEmployee={selectedEmployee}
          onEmployeeSelect={onEmployeeSelect}
        />
      </div>

      {/* CỘT PHẢI: Chi tiết (Chiếm 60%) */}
      <div className="dashboard-right">
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
