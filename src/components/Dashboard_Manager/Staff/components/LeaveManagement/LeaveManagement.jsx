import React, { useState } from "react";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveRequestsList from "./LeaveRequestsList";
import { useLeaveManagement } from "../../../../../hooks/useLeaveManagement";
import "./LeaveManagement.scss";

const LeaveManagement = ({ restaurantId }) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  const closeCreateModal = () => setIsCreateModalOpen(false);

  return (
    <div className="leave-management-page leave-management-page--compact">
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
        headerAction={(
          <button
            type="button"
            className="leave-open-modal-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Tạo đơn nghỉ phép
          </button>
        )}
      />

      {isCreateModalOpen && (
        <div
          className="leave-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal();
          }}
        >
          <section
            className="leave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-create-modal-title"
          >
            <div className="leave-modal__header">
              <div>
                <span className="leave-modal__eyebrow">Đơn nghỉ phép</span>
                <h3 id="leave-create-modal-title">Tạo đơn mới</h3>
                <p>Điền thông tin nghỉ phép trong modal để giữ màn quản lý gọn hơn.</p>
              </div>
              <button
                type="button"
                className="leave-modal__close"
                aria-label="Đóng form tạo đơn nghỉ phép"
                onClick={closeCreateModal}
              >
                ×
              </button>
            </div>
            <LeaveRequestForm
              staffList={staffList}
              onSubmit={submitLeaveRequest}
              disabled={isMutating}
              loading={loading}
              error={error}
              compact
              title=""
              submitLabel="Gửi đơn"
              onCancel={closeCreateModal}
              onSubmitted={closeCreateModal}
            />
          </section>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
