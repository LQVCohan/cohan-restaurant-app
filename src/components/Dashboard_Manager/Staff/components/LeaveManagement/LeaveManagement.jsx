import React, { useState } from "react";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveRequestsList from "./LeaveRequestsList";
import { useLeaveManagement } from "../../../../../hooks/useLeaveManagement";
import "./LeaveManagement.scss";

const LeaveManagement = ({ restaurantId }) => {
  const [selectedDate, setSelectedDate] = useState(
    ""
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const {
    leaveRequests,
    staffList,
    submitLeaveRequest,
    approveLeave,
    rejectLeave,
    confirmReplacement,
    loading,
    error,
    isMutating,
  } = useLeaveManagement({
    selectedDate,
    status: statusFilter,
    search,
    restaurantId,
  });

  return (
    <div className="leave-management-page">
      <LeaveRequestForm
        staffList={staffList}
        onSubmit={submitLeaveRequest}
        disabled={isMutating}
        loading={loading}
        error={error}
      />
      <LeaveRequestsList
        requests={leaveRequests}
        staffList={staffList}
        onApprove={approveLeave}
        onReject={rejectLeave}
        onConfirmReplacement={confirmReplacement}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchTerm={search}
        onSearchChange={setSearch}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default LeaveManagement;
