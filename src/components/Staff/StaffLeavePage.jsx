import React, { useContext, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import LeaveRequestForm from "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveRequestForm";
import LeaveRequestsList from "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveRequestsList";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveManagement.scss";

const resolveId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || value.restaurantId || "");
  }
  return String(value);
};

const getCurrentUserId = (user) =>
  String(user?.id || user?._id || user?.userId || "");

const getDisplayName = (user) =>
  user?.fullName || user?.name || user?.displayName || user?.username || "Nhân viên";

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

  const restaurantId =
    resolveId(user?.restaurantForStaff) ||
    resolveId(user?.restaurant) ||
    resolveId(restaurants?.[0]);
  const employeeId = getCurrentUserId(user);

  const {
    leaveRequests,
    staffList,
    submitLeaveRequest,
    loading,
    error,
    isMutating,
  } = useLeaveManagement({
    selectedDate,
    status: statusFilter,
    search,
    restaurantId,
    employeeId,
  });

  const selfStaffList = useMemo(() => {
    if (!employeeId) return [];
    const selfFromQuery = (staffList || []).find(
      (item) => String(item.id) === String(employeeId),
    );
    return [selfFromQuery || buildSelfStaffOption(user, restaurantId)].filter(
      (item) => item?.id,
    );
  }, [employeeId, restaurantId, staffList, user]);

  if (!restaurantId || !employeeId) {
    return (
      <div className="leave-management-page">
        <div className="leave-list-container">
          <div className="empty-row">
            Không xác định được nhà hàng hoặc tài khoản nhân viên. Vui lòng đăng nhập lại.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="leave-management-page">
      <div className="leave-list-container">
        <div className="dashboard-header">
          <div className="header-title">
            <h3>📝 Đơn nghỉ phép của tôi</h3>
            <p>Gửi đơn xin nghỉ phép và theo dõi trạng thái duyệt từ quản lý.</p>
          </div>
        </div>
      </div>

      <LeaveRequestForm
        staffList={selfStaffList}
        onSubmit={submitLeaveRequest}
        disabled={isMutating}
        loading={loading}
        error={error}
        selfServiceEmployeeId={employeeId}
      />

      <LeaveRequestsList
        requests={leaveRequests}
        onApprove={undefined}
        onReject={undefined}
        onConfirmReplacement={undefined}
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
      />
    </div>
  );
}
