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
  { step: "01", title: "Chọn loại nghỉ", copy: "Chọn hình thức nghỉ phù hợp với nhu cầu của bạn." },
  { step: "02", title: "Chọn thời gian", copy: "Hệ thống tự tính số ngày từ mốc thời gian đã chọn." },
  { step: "03", title: "Kiểm tra và gửi", copy: "Nhập lý do, xem lại thông tin rồi gửi quản lý duyệt." },
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
          <h1 id="staff-leave-title">Đăng ký nghỉ phép</h1>
          <p>Hoàn thành từng bước ngắn, gửi quản lý duyệt và theo dõi kết quả ngay trong lịch sử bên dưới.</p>
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
          <small>Tài khoản được chọn tự động.</small>
        </aside>
      </section>

      <section className="staff-leave-guide" aria-label="Ba bước gửi đơn nghỉ phép">
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
          title="Lịch sử đơn nghỉ phép"
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
