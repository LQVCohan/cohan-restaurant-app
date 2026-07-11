import React, { useContext, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import { AuthContext } from "@/context/AuthContext";
import LeaveRequestForm from "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveRequestForm";
import LeaveRequestsList from "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveRequestsList";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveManagement.scss";
import "./StaffLeavePage.scss";
import "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveModal.scss";
import "./StaffLeaveWizard.scss";

const resolveId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || value.restaurantId || "");
  }
  return String(value);
};

const getCurrentUserId = (user) => String(user?.id || user?._id || user?.userId || "");
const getDisplayName = (user) => user?.fullName || user?.name || user?.displayName || user?.username || "Nhân viên";

const buildSelfStaffOption = (user, restaurantId) => ({
  id: getCurrentUserId(user),
  fullName: getDisplayName(user),
  employeeCode: user?.employeeCode || "",
  positionTitle: user?.positionTitle || user?.roleName || "Nhân viên",
  roleName: user?.roleName || user?.role?.name || user?.role?.slug || "staff",
  department: user?.department || "",
  avatarUrl: user?.avatarUrl || user?.avatar || "",
  restaurantForStaff: restaurantId,
});

export default function StaffLeavePage() {
  const { user, restaurants } = useContext(AuthContext) || {};
  const [selectedDate, setSelectedDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const restaurantId = resolveId(user?.restaurantForStaff) || resolveId(user?.restaurant) || resolveId(restaurants?.[0]);
  const employeeId = getCurrentUserId(user);
  const selfStaffOption = useMemo(() => buildSelfStaffOption(user, restaurantId), [restaurantId, user]);

  const { leaveRequests, submitLeaveRequest, loading, error, isMutating } = useLeaveManagement({
    selectedDate,
    status: statusFilter,
    search,
    restaurantId,
    employeeId,
  });

  const formStaffList = useMemo(
    () => (employeeId ? [selfStaffOption] : []),
    [employeeId, selfStaffOption]
  );

  const closeCreateModal = () => setIsCreateModalOpen(false);

  if (!restaurantId || !employeeId) {
    return (
      <div className="staff-leave-page staff-page">
        <div className="staff-leave-empty-card" role="status">
          <strong>Không mở được khu vực nghỉ phép</strong>
          <span>Không xác định được nhà hàng hoặc tài khoản nhân viên. Vui lòng đăng nhập lại.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-leave-page staff-page" aria-label="Đăng ký và theo dõi nghỉ phép">
      <section className="staff-leave-panel staff-leave-panel--history" aria-label="Đơn nghỉ phép của tôi">
        <LeaveRequestsList
          requests={leaveRequests}
          onApprove={undefined}
          onReject={undefined}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchTerm={search}
          onSearchChange={setSearch}
          loading={loading}
          error={error}
          title="Đơn nghỉ phép của tôi"
          subtitle="Tạo đơn mới và theo dõi trạng thái duyệt"
          allowDecisionActions={false}
          showSearch={false}
          headerAction={
            <button type="button" className="leave-open-modal-btn" onClick={() => setIsCreateModalOpen(true)}>
              + Tạo đơn
            </button>
          }
        />
      </section>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Tạo đơn nghỉ phép"
        size="lg"
        className="leave-request-modal staff-leave-request-modal"
        autoWrapBody={false}
      >
        <Modal.Body className="leave-request-modal__body">
          <p className="leave-request-modal__intro">
            Hoàn thành lần lượt 3 bước. Thông tin đã nhập được giữ lại khi bạn quay về bước trước.
          </p>
          <LeaveRequestForm
            staffList={formStaffList}
            restaurantId={restaurantId}
            onSubmit={submitLeaveRequest}
            disabled={isMutating}
            loading={loading}
            error={error}
            selfServiceEmployeeId={employeeId}
            compact
            stepByStep
            title=""
            submitLabel="Gửi đơn"
            onCancel={closeCreateModal}
            onSubmitted={closeCreateModal}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
