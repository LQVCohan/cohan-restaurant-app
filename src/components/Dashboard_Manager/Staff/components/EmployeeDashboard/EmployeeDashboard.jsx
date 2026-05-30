import React from "react";
import EmployeeList from "../EmployeeList/EmployeeList"; // Kiểm tra lại đường dẫn import của bạn nếu cần
import EmployeeDetail from "../EmployeeDetail/EmployeeDetail";
import "./EmployeeDashboard.scss";

const EmployeeDashboard = ({
  employees,
  selectedEmployee,
  focusedEmployeeId,
  onEmployeeSelect,
  onEditEmployee,
  onViewHistory,
  onDeleteEmployee,
  onCalculateSalary,
  onSetOnLeave,
  onSetWorking,
  onLockAccount,
  onUnlockAccount,
  onResendVerification,
  loading = false,
}) => {
  return (
    <div className="employee-dashboard">
      {/* CỘT TRÁI: Danh sách (Chiếm 40%) */}
      <div className="dashboard-left">
        <EmployeeList
          employees={employees}
          selectedEmployee={selectedEmployee}
          focusedEmployeeId={focusedEmployeeId}
          onEmployeeSelect={onEmployeeSelect}
          loading={loading}
        />
      </div>

      {/* CỘT PHẢI: Chi tiết (Chiếm 60%) */}
      <div className="dashboard-right">
        <EmployeeDetail
          employee={selectedEmployee}
          onEdit={onEditEmployee}
          onViewHistory={onViewHistory}
          onDelete={onDeleteEmployee}
          onSetOnLeave={onSetOnLeave}
          onSetWorking={onSetWorking}
          onLockAccount={onLockAccount}
          onUnlockAccount={onUnlockAccount}
          onCalculateSalary={onCalculateSalary}
          onResendVerification={onResendVerification}
        />
      </div>
    </div>
  );
};

export default React.memo(EmployeeDashboard);
