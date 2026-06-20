import React from "react";
import EmployeeList from "../EmployeeList/EmployeeList";
import EmployeeDetail from "../EmployeeDetail/EmployeeDetail";
import "./EmployeeDashboard.scss";

const EmployeeDashboard = ({
  employees,
  selectedEmployee,
  focusedEmployeeId,
  onEmployeeSelect,
  onEmployeeAction,
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
      <div className="dashboard-left">
        <EmployeeList
          employees={employees}
          selectedEmployee={selectedEmployee}
          focusedEmployeeId={focusedEmployeeId}
          onEmployeeSelect={onEmployeeSelect}
          onEmployeeAction={onEmployeeAction}
          roleList={roleList}
          loading={loading}
          error={error}
          onRetry={onRetry}
        />
      </div>

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
