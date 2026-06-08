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
  onSetResigned,
  onLockAccount,
  onUnlockAccount,
  onResendVerification,
  roleList = [],
  loading = false,
  error = null,
  onRetry,
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
          roleList={roleList}
          loading={loading}
          error={error}
          onRetry={onRetry}
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
          onSetResigned={onSetResigned}
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
