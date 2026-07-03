import React, { useState } from "react";
import Modal from "@/components/common/Modal";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveRequestsList from "./LeaveRequestsList";
import { useLeaveManagement } from "../../../../../hooks/useLeaveManagement";
import "./LeaveManagement.scss";
import "./LeaveModal.scss";

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

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Tạo đơn nghỉ phép"
        size="lg"
        className="leave-request-modal"
        autoWrapBody={false}
      >
        <Modal.Body className="leave-request-modal__body">
          <p className="leave-request-modal__intro">
            Chọn nhân viên, thời gian và lý do nghỉ. Đơn sẽ được lưu để quản lý theo dõi và duyệt.
          </p>
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
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default LeaveManagement;
