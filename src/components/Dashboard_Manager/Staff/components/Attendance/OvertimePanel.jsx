import React, { useMemo, useState } from "react";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";
import {
  isForbiddenError,
  isUnauthenticatedError,
} from "@/utils/graphqlErrorUtils";

const REVIEW_ROLES = new Set(["admin", "manager", "hr"]);
const STAFF_ROLE = "staff";

const OVERTIME_STATUS_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "pending_employee_confirmation", label: "Chờ NV xác nhận" },
  { key: "pending_approval", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "completed", label: "Hoàn tất" },
  { key: "rejected", label: "Từ chối" },
  { key: "cancelled", label: "Đã hủy" },
];

const OVERTIME_TYPES = [
  { value: "weekday", label: "Ngày thường" },
  { value: "weekend", label: "Cuối tuần" },
  { value: "holiday", label: "Ngày lễ" },
  { value: "night", label: "Ban đêm" },
  { value: "emergency", label: "Khẩn cấp" },
  { value: "other", label: "Khác" },
];

const normalizeRole = (value) => String(value || "").toLowerCase();

const getRoleName = (user) =>
  normalizeRole(
    user?.roleName || user?.role?.slug || user?.userType || user?.role,
  );

const getUserId = (user) => user?.id || user?._id || user?.userId || null;

const canReviewOvertime = (user) => REVIEW_ROLES.has(getRoleName(user));

const canConfirmOvertime = (user, request) => {
  const userId = getUserId(user);
  if (!request || request.status !== "pending_employee_confirmation")
    return false;
  if (canReviewOvertime(user)) return true;
  return userId && String(userId) === String(request.employeeId);
};

const canCancelOvertime = (user, request) => {
  if (!request) return false;
  if (
    !["pending_employee_confirmation", "pending_approval"].includes(
      request.status,
    )
  ) {
    return false;
  }

  if (canReviewOvertime(user)) return true;

  const userId = getUserId(user);
  return userId && String(userId) === String(request.requestedBy);
};

const canCreateForAnyEmployee = (user) => canReviewOvertime(user);

const toDatetimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
};

const fromDatetimeLocalToIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};

const formatTime = (value) => {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const minutesToText = (minutes) => {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const remain = total % 60;

  if (!total) return "0 phút";
  if (hours && remain) return `${hours}h ${remain}p`;
  if (hours) return `${hours}h`;
  return `${remain}p`;
};

const getOvertimeTypeLabel = (value) =>
  OVERTIME_TYPES.find((item) => item.value === value)?.label || value || "--";

const getOvertimeStatusBadge = (status) => {
  const config = {
    pending_employee_confirmation: {
      label: "Chờ NV xác nhận",
      className: "warning",
      icon: "🙋",
    },
    pending_approval: {
      label: "Chờ duyệt",
      className: "warning",
      icon: "⏳",
    },
    approved: {
      label: "Đã duyệt",
      className: "info",
      icon: "✅",
    },
    rejected: {
      label: "Từ chối",
      className: "danger",
      icon: "⛔",
    },
    cancelled: {
      label: "Đã hủy",
      className: "neutral",
      icon: "🚫",
    },
    completed: {
      label: "Hoàn tất",
      className: "success",
      icon: "✅",
    },
    payroll_locked: {
      label: "Đã khóa lương",
      className: "neutral",
      icon: "🔒",
    },
  };

  const current = config[status] || {
    label: status || "--",
    className: "neutral",
    icon: "•",
  };

  return (
    <span className={`status-badge ${current.className}`}>
      {current.icon} {current.label}
    </span>
  );
};

const getAvatarColor = (name = "?") => {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return colors[name.length % colors.length];
};

const getDefaultForm = ({ selectedDate, employees, user, restaurantId }) => {
  const role = getRoleName(user);
  const userId = getUserId(user);

  const defaultEmployeeId =
    role === STAFF_ROLE ? userId : employees?.[0]?.id || "";

  const date = selectedDate || new Date().toISOString().split("T")[0];

  return {
    employeeId: defaultEmployeeId || "",
    restaurantId: restaurantId || "",
    workDate: date,
    plannedStartTime: `${date}T18:00`,
    plannedEndTime: `${date}T20:00`,
    overtimeType: "weekday",
    employeeConfirmationRequired: role !== STAFF_ROLE,
    reason: "",
  };
};

export const getOvertimeActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) {
    return "❌ Bạn không có quyền thực hiện thao tác này.";
  }
  if (isUnauthenticatedError(error)) {
    return "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  return fallback;
};

const OvertimePanel = ({
  user,
  employees = [],
  selectedDate,
  searchQuery,
  restaurantId,
}) => {
  const [status, setStatus] = useState("all");
  const [overtimeType, setOvertimeType] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(() =>
    getDefaultForm({ selectedDate, employees, user, restaurantId }),
  );

  const {
    overtimeRequests,
    stats,
    loading,
    error,
    createOvertimeRequest,
    confirmOvertimeRequest,
    approveOvertimeRequest,
    rejectOvertimeRequest,
    cancelOvertimeRequest,
    completeOvertimeRequest,
    createState,
    confirmState,
    approveState,
    rejectState,
    cancelState,
    completeState,
  } = useOvertimeManagement({
    selectedDate,
    status,
    overtimeType,
    restaurantId,
    search: searchQuery,
  });

  const isReviewer = canReviewOvertime(user);
  const isStaff = getRoleName(user) === STAFF_ROLE;
  const isBusy =
    createState.loading ||
    confirmState.loading ||
    approveState.loading ||
    rejectState.loading ||
    cancelState.loading ||
    completeState.loading;

  const employeeOptions = useMemo(() => {
    if (!isStaff) return employees;
    const userId = getUserId(user);
    return employees.filter((item) => String(item.id) === String(userId));
  }, [employees, isStaff, user]);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openCreateModal = () => {
    setForm(getDefaultForm({ selectedDate, employees, user, restaurantId }));
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    const selectedEmployee =
      employees.find((item) => String(item.id) === String(form.employeeId)) ||
      null;

    const effectiveRestaurantId =
      form.restaurantId ||
      restaurantId ||
      null;

    if (!form.employeeId) {
      alert("⚠️ Vui lòng chọn nhân viên.");
      return;
    }

    if (!effectiveRestaurantId) {
      alert("❌ Không xác định được nhà hàng cho yêu cầu tăng ca.");
      return;
    }

    if (!form.reason?.trim() || form.reason.trim().length < 5) {
      alert("⚠️ Lý do tăng ca phải có ít nhất 5 ký tự.");
      return;
    }

    const plannedStartTime = fromDatetimeLocalToIso(form.plannedStartTime);
    const plannedEndTime = fromDatetimeLocalToIso(form.plannedEndTime);

    if (!plannedStartTime || !plannedEndTime) {
      alert("⚠️ Vui lòng nhập giờ bắt đầu và kết thúc tăng ca.");
      return;
    }

    if (new Date(plannedEndTime) <= new Date(plannedStartTime)) {
      alert("⚠️ Giờ kết thúc tăng ca phải lớn hơn giờ bắt đầu.");
      return;
    }

    try {
      await createOvertimeRequest({
        variables: {
          input: {
            employeeId: form.employeeId,
            restaurantId: effectiveRestaurantId,
            workDate: `${form.workDate}T00:00:00.000Z`,
            plannedStartTime,
            plannedEndTime,
            overtimeType: form.overtimeType,
            reason: form.reason.trim(),
            employeeConfirmationRequired: Boolean(
              form.employeeConfirmationRequired,
            ),
          },
        },
      });

      alert("✅ Đã tạo yêu cầu tăng ca.");
      closeCreateModal();
    } catch (err) {
      alert(
        getOvertimeActionErrorMessage(
          err,
          `❌ Không thể tạo yêu cầu tăng ca: ${err.message}`,
        ),
      );
    }
  };

  const handleConfirm = async (request) => {
    const note = window.prompt("Xác nhận đồng ý tăng ca?", "Tôi xác nhận.");
    if (note === null) return;

    try {
      await confirmOvertimeRequest({
        variables: {
          input: {
            requestId: request.id,
            note: note || undefined,
          },
        },
      });
      alert("✅ Đã xác nhận tăng ca.");
    } catch (err) {
      alert(
        getOvertimeActionErrorMessage(
          err,
          `❌ Xác nhận tăng ca thất bại: ${err.message}`,
        ),
      );
    }
  };

  const handleApprove = async (request) => {
    const defaultMinutes = request.plannedOvertimeMinutes || 0;
    const minutesText = window.prompt(
      "Nhập số phút tăng ca được duyệt:",
      String(defaultMinutes),
    );

    if (minutesText === null) return;

    const approvedOvertimeMinutes = Number(minutesText);
    if (
      !Number.isFinite(approvedOvertimeMinutes) ||
      approvedOvertimeMinutes <= 0
    ) {
      alert("⚠️ Số phút duyệt phải lớn hơn 0.");
      return;
    }

    const note = window.prompt(
      "Ghi chú duyệt tăng ca:",
      "Đã kiểm tra nhu cầu vận hành.",
    );
    if (note === null) return;

    try {
      await approveOvertimeRequest({
        variables: {
          input: {
            requestId: request.id,
            approvedOvertimeMinutes,
            note: note || undefined,
          },
        },
      });
      alert("✅ Đã duyệt yêu cầu tăng ca.");
    } catch (err) {
      alert(
        getOvertimeActionErrorMessage(
          err,
          `❌ Duyệt tăng ca thất bại: ${err.message}`,
        ),
      );
    }
  };

  const handleReject = async (request) => {
    const reason = window.prompt(
      `Nhập lý do từ chối yêu cầu tăng ca của ${request.employeeName || "nhân viên"}:`,
    );

    if (reason === null) return;
    if (!reason.trim()) {
      alert("⚠️ Lý do từ chối là bắt buộc.");
      return;
    }

    try {
      await rejectOvertimeRequest({
        variables: {
          input: {
            requestId: request.id,
            reason: reason.trim(),
          },
        },
      });
      alert("✅ Đã từ chối yêu cầu tăng ca.");
    } catch (err) {
      alert(
        getOvertimeActionErrorMessage(
          err,
          `❌ Từ chối tăng ca thất bại: ${err.message}`,
        ),
      );
    }
  };

  const handleCancel = async (request) => {
    const reason = window.prompt(
      "Lý do hủy yêu cầu tăng ca:",
      "Không còn nhu cầu tăng ca.",
    );
    if (reason === null) return;

    try {
      await cancelOvertimeRequest({
        variables: {
          input: {
            requestId: request.id,
            reason: reason || undefined,
          },
        },
      });
      alert("✅ Đã hủy yêu cầu tăng ca.");
    } catch (err) {
      alert(
        getOvertimeActionErrorMessage(
          err,
          `❌ Hủy tăng ca thất bại: ${err.message}`,
        ),
      );
    }
  };

  const handleComplete = async (request) => {
    const actualText = window.prompt(
      "Nhập số phút tăng ca thực tế từ bảng công:",
      String(
        request.actualOvertimeMinutes ||
          request.approvedOvertimeMinutes ||
          request.plannedOvertimeMinutes ||
          0,
      ),
    );

    if (actualText === null) return;

    const actualOvertimeMinutes = Number(actualText);
    if (!Number.isFinite(actualOvertimeMinutes) || actualOvertimeMinutes < 0) {
      alert("⚠️ Số phút tăng ca thực tế không hợp lệ.");
      return;
    }

    const approvedText = window.prompt(
      "Nhập số phút tăng ca được tính lương:",
      String(
        Math.min(
          request.approvedOvertimeMinutes ||
            request.plannedOvertimeMinutes ||
            0,
          actualOvertimeMinutes,
        ),
      ),
    );

    if (approvedText === null) return;

    const approvedOvertimeMinutes = Number(approvedText);
    if (
      !Number.isFinite(approvedOvertimeMinutes) ||
      approvedOvertimeMinutes < 0
    ) {
      alert("⚠️ Số phút tăng ca tính lương không hợp lệ.");
      return;
    }

    const note = window.prompt(
      "Ghi chú hoàn tất tăng ca:",
      "Đã đối chiếu bảng công thực tế.",
    );

    if (note === null) return;

    try {
      await completeOvertimeRequest({
        variables: {
          input: {
            requestId: request.id,
            actualOvertimeMinutes,
            approvedOvertimeMinutes,
            note: note || undefined,
          },
        },
      });
      alert("✅ Đã hoàn tất tăng ca và cập nhật bảng công.");
    } catch (err) {
      alert(
        getOvertimeActionErrorMessage(
          err,
          `❌ Hoàn tất tăng ca thất bại: ${err.message}`,
        ),
      );
    }
  };

  return (
    <div className="overtime-panel">
      <div className="overtime-summary-grid">
        <div className="overtime-stat-card">
          <span className="label">Yêu cầu tăng ca</span>
          <strong>{stats.total}</strong>
          <small>Tổng yêu cầu trong ngày</small>
        </div>
        <div className="overtime-stat-card warning">
          <span className="label">Chờ xử lý</span>
          <strong>
            {stats.pendingEmployeeConfirmation + stats.pendingApproval}
          </strong>
          <small>Chờ xác nhận / chờ duyệt</small>
        </div>
        <div className="overtime-stat-card info">
          <span className="label">Đã duyệt</span>
          <strong>{stats.approved}</strong>
          <small>Cần đối chiếu sau ca</small>
        </div>
        <div className="overtime-stat-card success">
          <span className="label">Giờ tính lương</span>
          <strong>{stats.approvedHours}h</strong>
          <small>Từ yêu cầu đã hoàn tất</small>
        </div>
      </div>

      <div className="table-section overtime-section">
        <div className="table-toolbar">
          <div className="tabs">
            {OVERTIME_STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`tab-btn ${status === tab.key ? "active" : ""}`}
                type="button"
                onClick={() => setStatus(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="overtime-toolbar-actions">
            <select
              value={overtimeType}
              onChange={(event) => setOvertimeType(event.target.value)}
            >
              <option value="all">Tất cả loại tăng ca</option>
              {OVERTIME_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
            >
              + Tạo yêu cầu tăng ca
            </button>
          </div>
        </div>

        {error && (
          <div className="empty-state">
            ❌ Không tải được yêu cầu tăng ca: {error.message}
          </div>
        )}

        <div className="table-container">
          <table className="attendance-table overtime-table">
            <thead>
              <tr>
                <th width="18%">Nhân viên</th>
                <th width="12%">Ngày</th>
                <th width="16%">Khung tăng ca</th>
                <th width="12%">Loại</th>
                <th width="12%">Dự kiến</th>
                <th width="12%">Được duyệt</th>
                <th width="11%">Trạng thái</th>
                <th width="7%" className="text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && overtimeRequests.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center">
                    Không có yêu cầu tăng ca trong ngày đã chọn.
                  </td>
                </tr>
              )}

              {overtimeRequests.map((request) => {
                const name = request.employeeName || "Nhân viên";

                return (
                  <tr key={request.id}>
                    <td>
                      <div className="employee-cell">
                        <div
                          className="avatar"
                          style={{
                            backgroundImage: request.employeeAvatar
                              ? `url(${request.employeeAvatar})`
                              : "none",
                            backgroundColor: !request.employeeAvatar
                              ? getAvatarColor(name)
                              : "transparent",
                          }}
                        >
                          {!request.employeeAvatar && name.charAt(0)}
                        </div>
                        <div className="info">
                          <div className="name">{name}</div>
                          <div className="role">
                            {request.employeeCode || "--"} •{" "}
                            {request.employeeRole || "--"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>{formatDate(request.workDate)}</td>

                    <td>
                      <div className="overtime-time-range">
                        <strong>
                          {formatTime(request.plannedStartTime)} -{" "}
                          {formatTime(request.plannedEndTime)}
                        </strong>
                        <span>{request.reason}</span>
                      </div>
                    </td>

                    <td>
                      <span className="shift-badge">
                        {getOvertimeTypeLabel(request.overtimeType)}
                      </span>
                    </td>

                    <td>{minutesToText(request.plannedOvertimeMinutes)}</td>

                    <td>
                      <span className="overtime-approved-minutes">
                        {minutesToText(request.approvedOvertimeMinutes)}
                      </span>
                    </td>

                    <td>
                      {getOvertimeStatusBadge(request.status)}
                      <div className="small-muted">
                        {request.requestedByName
                          ? `Tạo bởi ${request.requestedByName}`
                          : formatDateTime(request.requestedAt)}
                      </div>
                    </td>

                    <td className="text-right">
                      {canConfirmOvertime(user, request) && (
                        <button
                          type="button"
                          className="action-btn approve"
                          title="Nhân viên xác nhận"
                          disabled={isBusy}
                          onClick={() => handleConfirm(request)}
                        >
                          🙋
                        </button>
                      )}

                      {request.status === "pending_approval" && isReviewer && (
                        <>
                          <button
                            type="button"
                            className="action-btn approve"
                            title="Duyệt tăng ca"
                            disabled={isBusy}
                            onClick={() => handleApprove(request)}
                          >
                            ✅
                          </button>
                          <button
                            type="button"
                            className="action-btn reject"
                            title="Từ chối tăng ca"
                            disabled={isBusy}
                            onClick={() => handleReject(request)}
                          >
                            ⛔
                          </button>
                        </>
                      )}

                      {request.status === "approved" && isReviewer && (
                        <button
                          type="button"
                          className="action-btn complete"
                          title="Hoàn tất và cập nhật bảng công"
                          disabled={isBusy}
                          onClick={() => handleComplete(request)}
                        >
                          🧾
                        </button>
                      )}

                      {canCancelOvertime(user, request) && (
                        <button
                          type="button"
                          className="action-btn cancel"
                          title="Hủy yêu cầu"
                          disabled={isBusy}
                          onClick={() => handleCancel(request)}
                        >
                          🚫
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <div
          className="attendance-modal-overlay"
          onMouseDown={closeCreateModal}
        >
          <div
            className="attendance-correction-modal overtime-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Tạo yêu cầu tăng ca</h3>
                <p>
                  Tăng ca chỉ được tính vào payroll sau khi được duyệt và hoàn
                  tất đối chiếu bảng công.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeCreateModal}
              >
                ×
              </button>
            </div>

            <form className="correction-form" onSubmit={handleCreate}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nhân viên</label>
                  <select
                    value={form.employeeId}
                    onChange={(event) =>
                      updateForm("employeeId", event.target.value)
                    }
                    disabled={!canCreateForAnyEmployee(user)}
                    required
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {employeeOptions.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        [{emp.employeeCode || "--"}] {emp.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Ngày tăng ca</label>
                  <input
                    type="date"
                    value={form.workDate}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      updateForm("workDate", nextDate);
                      updateForm("plannedStartTime", `${nextDate}T18:00`);
                      updateForm("plannedEndTime", `${nextDate}T20:00`);
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Bắt đầu tăng ca</label>
                  <input
                    type="datetime-local"
                    value={form.plannedStartTime}
                    onChange={(event) =>
                      updateForm("plannedStartTime", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Kết thúc tăng ca</label>
                  <input
                    type="datetime-local"
                    value={form.plannedEndTime}
                    onChange={(event) =>
                      updateForm("plannedEndTime", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Loại tăng ca</label>
                  <select
                    value={form.overtimeType}
                    onChange={(event) =>
                      updateForm("overtimeType", event.target.value)
                    }
                    required
                  >
                    {OVERTIME_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group checkbox-group">
                  <label>Yêu cầu nhân viên xác nhận</label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={Boolean(form.employeeConfirmationRequired)}
                      onChange={(event) =>
                        updateForm(
                          "employeeConfirmationRequired",
                          event.target.checked,
                        )
                      }
                    />
                    Cần nhân viên xác nhận trước khi duyệt
                  </label>
                </div>

                <div className="form-group full-width">
                  <label>Lý do tăng ca</label>
                  <textarea
                    value={form.reason}
                    onChange={(event) =>
                      updateForm("reason", event.target.value)
                    }
                    placeholder="VD: Khách đông, thiếu nhân sự ca tối, cần hỗ trợ đóng ca..."
                    minLength={5}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closeCreateModal}
                  disabled={createState.loading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createState.loading}
                >
                  {createState.loading ? "Đang tạo..." : "Tạo yêu cầu tăng ca"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OvertimePanel;
