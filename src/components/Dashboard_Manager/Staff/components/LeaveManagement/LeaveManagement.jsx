import React, { useState } from "react";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveRequestsList from "./LeaveRequestsList";
import { useLeaveManagement } from "../../../../../hooks/useLeaveManagement";
import "./LeaveManagement.scss";

const LeaveManagement = () => {
  const { leaveRequests, submitLeaveRequest, approveLeave, rejectLeave } =
    useLeaveManagement();

  return (
    <div className="leave-management-page">
      <LeaveRequestForm onSubmit={submitLeaveRequest} />
      <LeaveRequestsList
        requests={leaveRequests}
        onApprove={approveLeave}
        onReject={rejectLeave}
      />
    </div>
  );
};

export default LeaveManagement;
