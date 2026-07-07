import React, { useMemo, useState } from "react";
import useAttendanceManagement from "@/hooks/useAttendanceManagement";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";
import {
  isForbiddenError,
  isUnauthenticatedError,
} from "@/utils/graphqlErrorUtils";

const REVIEW_ROLES = new Set(["admin", "manager", "hr"]);
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const OVERTIME_TYPES = [
  ["weekday", "Ngày thường"],
  ["weekend", "Cuối tuần"],
  ["holiday", "Ngày lễ"],
  ["night", "Ca đêm"],
  ["emergency", "Khẩn cấp"],
  ["other", "Khác"],
];

const OVERTIME_STATUS_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Từ chối" },
];

const OVERTIME_ACTION_ERROR_MESSAGES = {
  ATTENDANCE_OVERTIME_ALREADY_REVIEWED:
    "⚠️ Bản ghi tăng ca này đã được review trước đó. Vui lòng tải lại danh sách.",
  ATTENDANCE_OVERTIME_PAYROLL_PERIOD_LOCKED:
    "⚠️ Kỳ lương đã chốt/khóa/thanh toán, không thể thay đổi tăng ca.",
};

const normalizeRole = (value) => String(value || "").trim().toLowerCase();
const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id ?? value._id ?? value.restaurantId ?? "").trim();
  }
  return String(value).trim();
};
const isValidObjectId = (value) => OBJECT_ID_PATTERN.test(normalizeId(value));
const getRoleName = (user) =>
  normalizeRole(user?.roleName || user?.role?.slug || user?.userType || user?.role);
const canReviewOvertime = (user) => REVIEW_ROLES.has(getRoleName(user));
const toLocalIso = (date, time) =>
  date && time ? `${date}T${time}:00.000+07:00` : null;

const getRestaurantIdFromUrl = () => {
  if (typeof window === "undefined") return "";
  return normalizeId(
    new URLSearchParams(window.location.search || "").get("restaurantId"),
  );
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

const formatMinutes = (value) => {
  const minutes = Number(value || 0);
  if (!minutes) return "0 phút";
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours && remain) return `${hours}h ${remain}p`;
  if (hours) return `${hours}h`;
  return `${remain}p`;
};

const getAvatarColor = (name = "?") => {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return colors[name.length % colors.length];
};

const getOvertimeStatus = (record) => {
  const status = String(record?.overtimeApprovalStatus || "").toLowerCase();
  if (status) return status;
  return Number(record?.overtimeMinutes || 0) > 0 ? "pending" : "not_required";
};

const REQUEST_STATUS_LABELS = {
  pending_approval: { label: "Chờ quản lý duyệt", className: "warning", icon: "⏳" },
  pending_employee_confirmation: { label: "Chờ nhân viên xác nhận", className: "warning", icon: "👤" },
  approved: { label: "Đã duyệt", className: "success", icon: "✅" },
  rejected: { label: "Từ chối", className: "danger", icon: "⛔" },
  cancelled: { label: "Đã hủy", className: "neutral", icon: "•" },
  completed: { label: "Hoàn tất", className: "success", icon: "🏁" },
};

const getRequestStatusBadge = (status) => {
  const current = REQUEST_STATUS_LABELS[status] || {
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

const getOvertimeTypeLabel = (value) =>
  OVERTIME_TYPES.find(([key]) => key === value)?.[1] || value || "--";

const getOvertimeStatusBadge = (status) => {
  const config = {
    pending: { label: "Chờ duyệt", className: "warning", icon: "⏳" },
    approved: { label: "Đã duyệt", className: "success", icon: "✅" },
    rejected: { label: "Từ chối", className: "danger", icon: "⛔" },
    not_required: { label: "Không cần duyệt", className: "neutral", icon: "•" },
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

const getOvertimeErrorMessages = (error) =>
  [
    error?.graphQLErrors?.[0]?.message,
    error?.networkError?.result?.errors?.[0]?.message,
    error?.message,
  ]
    .filter(Boolean)
    .map(String);

const getOvertimePolicyLimitMessage = (error) => {
  const message = getOvertimeErrorMessages(error).find((item) =>
    item.includes("ATTENDANCE_OVERTIME_LIMIT_EXCEEDED"),
  );
  if (!message) return "";
  const [, rawMaxMinutes, roleGroupLabel] = message.split("|");
  const maxMinutes = Number(rawMaxMinutes);
  const maxLabel = Number.isFinite(maxMinutes)
    ? formatMinutes(maxMinutes)
    : "mức đã cấu hình";
  return `⚠️ Số phút tăng ca được duyệt vượt giới hạn của ${roleGroupLabel || "nhóm vai trò này"}. Tối đa hiện tại: ${maxLabel}/ngày.`;
};

export const getOvertimeActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) {
    return "❌ Bạn không có quyền thực hiện thao tác này.";
  }
  if (isUnauthenticatedError(error)) {
    return "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  const policyMessage = getOvertimePolicyLimitMessage(error);
  if (policyMessage) return policyMessage;
  const messages = getOvertimeErrorMessages(error);
  const code = Object.keys(OVERTIME_ACTION_ERROR_MESSAGES).find((candidate) =>
    messages.some((message) => message.includes(candidate)),
  );
  return code ? OVERTIME_ACTION_ERROR_MESSAGES[code] : fallback;
};

const getOvertimeLoadErrorMessage = (error) => {
  if (!error) return "";
  if (isForbiddenError(error)) {
    return "Không có quyền xem dữ liệu tăng ca của nhà hàng đang chọn.";
  }
  if (isUnauthenticatedError(error)) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  return error.message || "Không tải được dữ liệu tăng ca.";
};

const getAttendanceStatus = (record) => {
  const status = String(record?.status || "").toLowerCase();
  if (status === "missed_checkout") return status;
  if (!record?.actualCheckInAt) {
    return record?.isOffSchedule ? "unscheduled_absent" : "scheduled_absent";
  }
  if (!record?.actualCheckOutAt) {
    return record?.isOffSchedule ? "unscheduled_checkin" : "checked_in";
  }
  return status;
};

const canShowAction = (user, record) => {
  if (!canReviewOvertime(user)) return false;
  if (Number(record?.overtimeMinutes || 0) <= 0) return false;
  if (getOvertimeStatus(record) !== "pending") return false;
  return !["scheduled_absent", "missed_checkout", "checked_in"].includes(
    getAttendanceStatus(record),
  );
};

const shiftLabel = (record) => {
  if (record?.plannedStartTime && record?.plannedEndTime) {
    return `${formatTime(record.plannedStartTime)} - ${formatTime(record.plannedEndTime)}`;
  }
  return record?.isOffSchedule ? "Ngoài lịch" : "Chưa phân ca";
};

const buildDefaultDialog = (mode, record) => ({
  mode,
  record,
  approvedMinutes:
    mode === "approve" ? String(Number(record?.overtimeMinutes || 0)) : "0",
  note: mode === "approve" ? "Đã đối chiếu giờ tan ca thực tế." : "",
  error: "",
});

const OvertimePanel = ({ user, selectedDate, searchQuery, restaurantId }) => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [requestActionFeedback, setRequestActionFeedback] = useState(null);
  const [createForm, setCreateForm] = useState({
    employeeId: "",
    startTime: "",
    endTime: "",
    overtimeType: "weekday",
    reason: "",
  });

  const effectiveRestaurantId = useMemo(() => {
    const candidates = [
      restaurantId,
      getRestaurantIdFromUrl(),
      user?.restaurantForStaff,
      user?.restaurantId,
    ];
    return candidates.map(normalizeId).find(isValidObjectId) || "";
  }, [restaurantId, user?.restaurantForStaff, user?.restaurantId]);

  const {
    employees,
    records,
    loading,
    error,
    refreshAttendanceViews,
    approveAttendanceOvertime,
    rejectAttendanceOvertime,
    approveOvertimeState,
    rejectOvertimeState,
  } = useAttendanceManagement({
    selectedDate,
    status: "all",
    search: searchQuery,
    restaurantId: effectiveRestaurantId || undefined,
  });

  const {
    overtimeRequests,
    loading: requestsLoading,
    error: requestsError,
    createOvertimeRequest,
    approveOvertimeRequest,
    rejectOvertimeRequest,
    completeOvertimeRequest,
    createState,
    approveState: approveRequestState,
    rejectState: rejectRequestState,
    completeState: completeRequestState,
  } = useOvertimeManagement({
    selectedDate,
    status: "all",
    search: searchQuery,
    restaurantId: effectiveRestaurantId || undefined,
  });

  const canManage = canReviewOvertime(user);
  const isBusy = approveOvertimeState.loading || rejectOvertimeState.loading;
  const isRequestBusy =
    createState.loading ||
    approveRequestState.loading ||
    rejectRequestState.loading ||
    completeRequestState.loading;

  const allOvertimeRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          Number(record?.overtimeMinutes || 0) > 0 ||
          ["pending", "approved", "rejected"].includes(getOvertimeStatus(record)),
      ),
    [records],
  );

  const overtimeRecords = useMemo(() => {
    const filtered = allOvertimeRecords.filter(
      (record) => statusFilter === "all" || getOvertimeStatus(record) === statusFilter,
    );
    return filtered.sort(
      (left, right) =>
        Number(getOvertimeStatus(left) !== "pending") -
          Number(getOvertimeStatus(right) !== "pending") ||
        new Date(right.workDate || 0) - new Date(left.workDate || 0),
    );
  }, [allOvertimeRecords, statusFilter]);

  const stats = useMemo(
    () => ({
      total: allOvertimeRecords.length,
      pending: allOvertimeRecords.filter(
        (record) => getOvertimeStatus(record) === "pending",
      ).length,
      rawMinutes: allOvertimeRecords.reduce(
        (sum, record) => sum + Number(record?.overtimeMinutes || 0),
        0,
      ),
      approvedMinutes: allOvertimeRecords.reduce(
        (sum, record) => sum + Number(record?.approvedOvertimeMinutes || 0),
        0,
      ),
    }),
    [allOvertimeRecords],
  );

  const updateCreateForm = (field, value) =>
    setCreateForm((current) => ({ ...current, [field]: value }));

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    setRequestActionFeedback(null);
    if (!canManage) return;
    try {
      await createOvertimeRequest({
        employeeId: createForm.employeeId,
        restaurantId: effectiveRestaurantId,
        workDate: `${selectedDate}T00:00:00.000+07:00`,
        plannedStartTime: toLocalIso(selectedDate, createForm.startTime),
        plannedEndTime: toLocalIso(selectedDate, createForm.endTime),
        overtimeType: createForm.overtimeType,
        reason: createForm.reason.trim(),
        employeeConfirmationRequired: true,
      });
      setCreateForm({
        employeeId: "",
        startTime: "",
        endTime: "",
        overtimeType: "weekday",
        reason: "",
      });
      setRequestActionFeedback({
        type: "success",
        message: "Đã tạo yêu cầu và gửi nhân viên xác nhận.",
      });
    } catch (actionError) {
      setRequestActionFeedback({
        type: "error",
        message: getOvertimeActionErrorMessage(
          actionError,
          actionError?.message || "Không thể tạo yêu cầu tăng ca.",
        ),
      });
    }
  };

  const handleApproveRequest = async (request) => {
    try {
      await approveOvertimeRequest({
        requestId: request.id,
        approvedOvertimeMinutes: Number(
          request.approvedOvertimeMinutes || request.plannedOvertimeMinutes || 0,
        ),
        note: "Đã duyệt yêu cầu tăng ca.",
      });
      setRequestActionFeedback({ type: "success", message: "Đã duyệt yêu cầu tăng ca." });
    } catch (actionError) {
      setRequestActionFeedback({
        type: "error",
        message: getOvertimeActionErrorMessage(
          actionError,
          "Không thể xử lý yêu cầu tăng ca.",
        ),
      });
    }
  };

  const handleRejectRequest = async (request) => {
    try {
      await rejectOvertimeRequest({
        requestId: request.id,
        reason: "Quản lý từ chối yêu cầu tăng ca.",
      });
      setRequestActionFeedback({ type: "success", message: "Đã từ chối yêu cầu tăng ca." });
    } catch (actionError) {
      setRequestActionFeedback({
        type: "error",
        message: getOvertimeActionErrorMessage(
          actionError,
          "Không thể xử lý yêu cầu tăng ca.",
        ),
      });
    }
  };

  const handleCompleteRequest = async (request) => {
    try {
      await completeOvertimeRequest(request.id);
      setRequestActionFeedback({ type: "success", message: "Đã hoàn tất yêu cầu tăng ca." });
    } catch (actionError) {
      setRequestActionFeedback({
        type: "error",
        message: getOvertimeActionErrorMessage(
          actionError,
          "Không thể xử lý yêu cầu tăng ca.",
        ),
      });
    }
  };

  const closeDialog = () => {
    if (!isBusy) setDialog(null);
  };

  const handleTimesheetReview = async (event) => {
    event.preventDefault();
    if (!dialog?.record || !canManage) return;
    const overtimeMinutes = Number(dialog.record.overtimeMinutes || 0);
    try {
      if (dialog.mode === "approve") {
        const approvedMinutes = Number(dialog.approvedMinutes);
        if (!Number.isFinite(approvedMinutes) || approvedMinutes < 0) {
          throw new Error("Số phút duyệt không hợp lệ.");
        }
        if (approvedMinutes > overtimeMinutes) {
          throw new Error("Số phút duyệt không được vượt quá overtime thực tế.");
        }
        await approveAttendanceOvertime({
          variables: {
            input: {
              timesheetId: dialog.record.id,
              approvedOvertimeMinutes: approvedMinutes,
              reviewNote: dialog.note.trim() || undefined,
            },
          },
        });
      } else {
        if (!dialog.note.trim()) throw new Error("Lý do từ chối là bắt buộc.");
        await rejectAttendanceOvertime({
          variables: {
            input: {
              timesheetId: dialog.record.id,
              reviewNote: dialog.note.trim(),
            },
          },
        });
      }
      await refreshAttendanceViews();
      closeDialog();
    } catch (actionError) {
      setDialog((current) => ({
        ...current,
        error: getOvertimeActionErrorMessage(
          actionError,
          actionError?.message || "Không thể xử lý duyệt tăng ca.",
        ),
      }));
    }
  };

  return (
    <div className="overtime-panel">
      <div className="overtime-summary-grid">
        <div className="overtime-stat-card">
          <span className="label">Bản ghi tăng ca</span>
          <strong>{stats.total}</strong>
          <small>Timesheet có overtime trong ngày</small>
        </div>
        <div className="overtime-stat-card warning">
          <span className="label">Chờ duyệt</span>
          <strong>{stats.pending}</strong>
          <small>Admin, Manager hoặc HR xử lý</small>
        </div>
        <div className="overtime-stat-card info">
          <span className="label">Overtime thực tế</span>
          <strong>{formatMinutes(stats.rawMinutes)}</strong>
          <small>Dựa trên planned end và check-out thực tế</small>
        </div>
        <div className="overtime-stat-card success">
          <span className="label">Được duyệt</span>
          <strong>{formatMinutes(stats.approvedMinutes)}</strong>
          <small>Payroll chỉ dùng số phút đã duyệt</small>
        </div>
      </div>

      {canManage && (
        <div className="table-section overtime-section">
          <div className="section-heading">
            <h3>Tạo yêu cầu tăng ca cho nhân viên</h3>
          </div>
          <form className="correction-form" onSubmit={handleCreateRequest}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="manager-overtime-employee">Nhân viên</label>
                <select
                  id="manager-overtime-employee"
                  value={createForm.employeeId}
                  onChange={(event) => updateCreateForm("employeeId", event.target.value)}
                  required
                >
                  <option value="">Chọn nhân viên</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} {employee.employeeCode ? `• ${employee.employeeCode}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="manager-overtime-start">Bắt đầu tăng ca</label>
                <input
                  id="manager-overtime-start"
                  type="time"
                  value={createForm.startTime}
                  onChange={(event) => updateCreateForm("startTime", event.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="manager-overtime-end">Kết thúc tăng ca</label>
                <input
                  id="manager-overtime-end"
                  type="time"
                  value={createForm.endTime}
                  onChange={(event) => updateCreateForm("endTime", event.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="manager-overtime-type">Loại tăng ca</label>
                <select
                  id="manager-overtime-type"
                  value={createForm.overtimeType}
                  onChange={(event) => updateCreateForm("overtimeType", event.target.value)}
                >
                  {OVERTIME_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="manager-overtime-reason">Lý do</label>
              <textarea
                id="manager-overtime-reason"
                value={createForm.reason}
                onChange={(event) => updateCreateForm("reason", event.target.value)}
                minLength={5}
                required
                placeholder="Ví dụ: Hỗ trợ đóng ca hoặc xử lý phát sinh vận hành."
              />
            </div>
            <div className="form-actions">
              <small>Yêu cầu do quản lý tạo sẽ chờ nhân viên xác nhận trước khi duyệt.</small>
              <button
                type="submit"
                className="btn-primary"
                disabled={isRequestBusy || !effectiveRestaurantId}
              >
                Gửi nhân viên xác nhận
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-section overtime-section">
        <div className="section-heading"><h3>Tăng ca phát sinh từ bảng công</h3></div>
        <div className="table-toolbar">
          <div className="tabs">
            {OVERTIME_STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`tab-btn ${statusFilter === tab.key ? "active" : ""}`}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {!effectiveRestaurantId && (
          <div className="empty-state">⚠️ Chưa xác định được nhà hàng.</div>
        )}
        {error && (
          <div className="empty-state">❌ {getOvertimeLoadErrorMessage(error)}</div>
        )}
        <div className="table-container">
          <table className="attendance-table overtime-table">
            <thead>
              <tr>
                <th>Nhân viên</th><th>Ngày công</th><th>Ca làm</th><th>Check-out</th>
                <th>Overtime</th><th>Được duyệt</th><th>Trạng thái</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !overtimeRecords.length && (
                <tr><td colSpan={8} className="text-center">Không có bản ghi tăng ca trong ngày đã chọn.</td></tr>
              )}
              {overtimeRecords.map((record) => {
                const displayName = record.employeeName || "Nhân viên";
                const status = getOvertimeStatus(record);
                return (
                  <tr key={record.id}>
                    <td>
                      <div className="employee-cell">
                        <div
                          className="avatar"
                          style={{ backgroundColor: getAvatarColor(displayName) }}
                        >
                          {displayName.charAt(0)}
                        </div>
                        <div className="info">
                          <div className="name">{displayName}</div>
                          <div className="role">{record.employeeCode || "--"} • {record.employeeRole || "--"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(record.workDate)}</td>
                    <td>{shiftLabel(record)}</td>
                    <td>{formatDateTime(record.actualCheckOutAt)}</td>
                    <td>{formatMinutes(record.overtimeMinutes)}</td>
                    <td>{formatMinutes(record.approvedOvertimeMinutes)}</td>
                    <td>{getOvertimeStatusBadge(status)}</td>
                    <td className="text-right">
                      {canShowAction(user, record) && (
                        <>
                          <button type="button" className="action-btn approve" title="Duyệt tăng ca" disabled={isBusy} onClick={() => setDialog(buildDefaultDialog("approve", record))}>✅</button>
                          <button type="button" className="action-btn reject" title="Từ chối tăng ca" disabled={isBusy} onClick={() => setDialog(buildDefaultDialog("reject", record))}>⛔</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-section overtime-section">
        <div className="section-heading"><h3>Yêu cầu tăng ca</h3></div>
        {requestActionFeedback && (
          <div
            className={`empty-state ${requestActionFeedback.type}`}
            role={requestActionFeedback.type === "error" ? "alert" : "status"}
          >
            {requestActionFeedback.message}
          </div>
        )}
        {requestsLoading && !requestsError && <div className="empty-state">Đang tải yêu cầu tăng ca...</div>}
        {requestsError && <div className="empty-state">❌ {getOvertimeLoadErrorMessage(requestsError)}</div>}
        <div className="table-container">
          <table className="attendance-table overtime-table">
            <thead>
              <tr>
                <th>Nhân viên</th><th>Ngày công</th><th>Giờ dự kiến</th><th>Số phút</th>
                <th>Loại</th><th>Lý do</th><th>Trạng thái</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!requestsLoading && !overtimeRequests.length && (
                <tr><td colSpan={8} className="text-center">Không có yêu cầu tăng ca trong ngày đã chọn.</td></tr>
              )}
              {overtimeRequests.map((request) => {
                const displayName = request.employeeName || "Nhân viên";
                return (
                  <tr key={request.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="avatar" style={{ backgroundColor: getAvatarColor(displayName) }}>{displayName.charAt(0)}</div>
                        <div className="info">
                          <div className="name">{displayName}</div>
                          <div className="role">{request.employeeCode || "--"} • {request.employeeRole || "--"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(request.workDate)}</td>
                    <td>{formatTime(request.plannedStartTime)} - {formatTime(request.plannedEndTime)}</td>
                    <td>{formatMinutes(request.plannedOvertimeMinutes)}</td>
                    <td>{getOvertimeTypeLabel(request.overtimeType)}</td>
                    <td>{request.reason || "--"}</td>
                    <td>{getRequestStatusBadge(request.status)}</td>
                    <td className="text-right">
                      {canManage && request.status === "pending_approval" && (
                        <>
                          <button type="button" className="action-btn approve" title="Duyệt yêu cầu tăng ca" disabled={isRequestBusy} onClick={() => handleApproveRequest(request)}>✅</button>
                          <button type="button" className="action-btn reject" title="Từ chối yêu cầu tăng ca" disabled={isRequestBusy} onClick={() => handleRejectRequest(request)}>⛔</button>
                        </>
                      )}
                      {canManage && request.status === "approved" && (
                        <button type="button" className="action-btn approve" title="Hoàn tất yêu cầu tăng ca" disabled={isRequestBusy} onClick={() => handleCompleteRequest(request)}>🏁</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {dialog?.record && (
        <div className="attendance-modal-overlay" onMouseDown={closeDialog}>
          <div className="attendance-correction-modal overtime-review-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{dialog.mode === "approve" ? "Duyệt tăng ca từ bảng công" : "Từ chối tăng ca từ bảng công"}</h3>
                <p>{dialog.record.employeeName || "Nhân viên"} • {formatDate(dialog.record.workDate)}</p>
              </div>
              <button type="button" className="modal-close" onClick={closeDialog} disabled={isBusy}>×</button>
            </div>
            <form className="correction-form" onSubmit={handleTimesheetReview}>
              {dialog.error && <div className="form-alert error">{dialog.error}</div>}
              {dialog.mode === "approve" && (
                <div className="form-group">
                  <label htmlFor="approved-overtime-minutes">Số phút được duyệt</label>
                  <input
                    id="approved-overtime-minutes"
                    type="number"
                    min="0"
                    max={Number(dialog.record.overtimeMinutes || 0)}
                    value={dialog.approvedMinutes}
                    onChange={(event) => setDialog((current) => ({ ...current, approvedMinutes: event.target.value, error: "" }))}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="overtime-review-note">{dialog.mode === "approve" ? "Ghi chú" : "Lý do từ chối"}</label>
                <textarea
                  id="overtime-review-note"
                  value={dialog.note}
                  onChange={(event) => setDialog((current) => ({ ...current, note: event.target.value, error: "" }))}
                  required={dialog.mode === "reject"}
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={closeDialog} disabled={isBusy}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={isBusy}>
                  {dialog.mode === "approve" ? "Duyệt" : "Từ chối"}
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
