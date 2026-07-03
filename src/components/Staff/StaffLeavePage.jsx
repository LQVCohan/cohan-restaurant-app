import React, { useContext, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import { AuthContext } from "@/context/AuthContext";
import LeaveRequestForm from "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveRequestForm";
import LeaveRequestsList from "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveRequestsList";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveManagement.scss";
import "./StaffLeavePage.scss";
import "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveModal.scss";

const resolveId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || value.restaurantId || "");
  }
  return String(value);
};

const getCurrentUserId = (user) => String(user?.id || user?._id || user?.userId || "");
const getDisplayName = (user) => user?.fullName || user?.name || user?.displayName || user?.username || "Nhân viên";

const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NV";
  return parts.slice(-2).map((part) => part.charAt(0).toUpperCase()).join("");
};

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

const leaveGuide = [
  { step: "01", title: "Chọn đúng loại nghỉ", copy: "Hệ thống tự tính số ngày dự kiến để quản lý duyệt và đồng bộ dữ liệu lương." },
  { step: "02", title: "Ghi lý do rõ ràng", copy: "Lý do ngắn gọn giúp quản lý xử lý nhanh hơn." },
  { step: "03", title: "Theo dõi trạng thái", copy: "Đơn đã gửi sẽ nằm ở lịch sử bên dưới." },
];

export default function StaffLeavePage() {
  const { user, restaurants } = useContext(AuthContext) || {};
  const [selectedDate, setSelectedDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const staffName = getDisplayName(user);
  const initials = getInitials(staffName);
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

  const leaveStats = useMemo(
    () => ({
      total: leaveRequests.length,
      pending: leaveRequests.filter((request) => request.status === "PENDING").length,
      approved: leaveRequests.filter((request) => request.status === "APPROVED").length,
    }),
    [leaveRequests],
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
    <div className="staff-leave-page staff-page" aria-labelledby="staff-leave-title">
      <section className="staff-leave-hero staff-leave-hero--compact" aria-label="Tổng quan nghỉ phép">
        <div className="staff-leave-hero__copy">
          <span className="staff-leave-badge">Nghỉ phép nhân viên</span>
          <h1 id="staff-leave-title">Xin nghỉ phép trong vài bước</h1>
          <p>Gửi đơn trong modal, theo dõi trạng thái duyệt và giữ lịch sử ngay trong khu vực nhân viên.</p>
          <div className="staff-leave-hero__actions">
            <button type="button" className="staff-leave-primary-btn" onClick={() => setIsCreateModalOpen(true)}>
              + Tạo đơn nghỉ phép
            </button>
          </div>
          <div className="staff-leave-hero__stats" aria-label="Thống kê đơn nghỉ phép">
            <div className="staff-leave-stat-card"><span>Tổng đơn</span><strong>{leaveStats.total}</strong></div>
            <div className="staff-leave-stat-card staff-leave-stat-card--pending"><span>Chờ duyệt</span><strong>{leaveStats.pending}</strong></div>
            <div className="staff-leave-stat-card staff-leave-stat-card--approved"><span>Đã duyệt</span><strong>{leaveStats.approved}</strong></div>
          </div>
        </div>

        <aside className="staff-leave-identity-card" aria-label="Tài khoản gửi đơn">
          <div className="staff-leave-identity-card__avatar" aria-hidden="true">{initials}</div>
          <span>Người làm đơn</span>
          <strong>{staffName}</strong>
          <small>Form sẽ tự chọn tài khoản hiện tại.</small>
        </aside>
      </section>

      <section className="staff-leave-guide" aria-label="Hướng dẫn gửi đơn nghỉ phép">
        {leaveGuide.map((item) => (
          <article className="staff-leave-guide__item" key={item.step}>
            <span>{item.step}</span>
            <div><strong>{item.title}</strong><p>{item.copy}</p></div>
          </article>
        ))}
      </section>

      <section className="staff-leave-panel staff-leave-panel--history" aria-label="Lịch sử đơn nghỉ phép">
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
          title="📋 Lịch sử đơn nghỉ phép"
          subtitle="Theo dõi trạng thái các đơn bạn đã gửi"
          allowDecisionActions={false}
          showSearch={false}
          headerAction={<button type="button" className="leave-open-modal-btn" onClick={() => setIsCreateModalOpen(true)}>+ Tạo đơn</button>}
        />
      </section>

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
            Tài khoản của bạn được chọn tự động. Hãy nhập thời gian và lý do nghỉ trước khi gửi.
          </p>
          <LeaveRequestForm
            staffList={formStaffList}
            onSubmit={submitLeaveRequest}
            disabled={isMutating}
            loading={loading}
            error={error}
            selfServiceEmployeeId={employeeId}
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
}
