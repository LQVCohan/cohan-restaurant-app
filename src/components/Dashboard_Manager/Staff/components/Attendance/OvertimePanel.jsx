import React, { useMemo, useState } from "react";
import useAttendanceManagement from "@/hooks/useAttendanceManagement";
import {
  isForbiddenError,
  isUnauthenticatedError,
} from "@/utils/graphqlErrorUtils";

const REVIEW_ROLES = new Set(["admin", "manager", "hr"]);
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

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

const getRestaurantIdFromUrl = () => {
  if (typeof window === "undefined") return "";
  return normalizeId(new URLSearchParams(window.location.search || "").get("restaurantId"));
};

const getRoleName = (user) =>
  normalizeRole(user?.roleName || user?.role?.slug || user?.userType || user?.role);

const canReviewOvertime = (user) => REVIEW_ROLES.has(getRoleName(user));

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
  ].filter(Boolean).map((message) => String(message));

const getOvertimePolicyLimitMessage = (error) => {
  const message = getOvertimeErrorMessages(error).find((item) =>
    item.includes("ATTENDANCE_OVERTIME_LIMIT_EXCEEDED"),
  );
  if (!message) return "";

  const [, rawMaxMinutes, roleGroupLabel] = message.split("|");
  const maxMinutes = Number(rawMaxMinutes);
  const maxLabel = Number.isFinite(maxMinutes) ? formatMinutes(maxMinutes) : "mức đã cấu hình";
  const groupLabel = roleGroupLabel || "nhóm vai trò này";

  return `⚠️ Số phút tăng ca được duyệt vượt giới hạn của ${groupLabel}. Tối đa hiện tại: ${maxLabel}/ngày. Hãy giảm số phút duyệt hoặc chỉnh chính sách tại Cài đặt hệ thống.`;
};

const extractOvertimeActionErrorCode = (error) => {
  const candidates = getOvertimeErrorMessages(error);

  return Object.keys(OVERTIME_ACTION_ERROR_MESSAGES).find((code) =>
    candidates.some((message) => String(message).includes(code)),
  );
};

export const getOvertimeActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) {
    return "❌ Bạn không có quyền thực hiện thao tác này.";
  }
  if (isUnauthenticatedError(error)) {
    return "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }

  const policyLimitMessage = getOvertimePolicyLimitMessage(error);
  if (policyLimitMessage) return policyLimitMessage;

  const overtimeErrorCode = extractOvertimeActionErrorCode(error);
  if (overtimeErrorCode) {
    return OVERTIME_ACTION_ERROR_MESSAGES[overtimeErrorCode];
  }

  return fallback;
};

const getOvertimeLoadErrorMessage = (error) => {
  if (!error) return "";
  if (isForbiddenError(error)) {
    return "Không có quyền xem dữ liệu chấm công/tăng ca của nhà hàng đang chọn. Hãy kiểm tra lại nhà hàng hoặc quyền Manager/HR/Admin.";
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
  const attendanceStatus = getAttendanceStatus(record);
  if (["scheduled_absent", "missed_checkout", "checked_in"].includes(attendanceStatus)) {
    return false;
  }
  return true;
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
  approvedMinutes: mode === "approve" ? String(Number(record?.overtimeMinutes || 0)) : "0",
  note: mode === "approve" ? "Đã đối chiếu giờ tan ca thực tế." : "",
  error: "",
});

const OvertimePanel = ({ user, selectedDate, searchQuery, restaurantId }) => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialog, setDialog] = useState(null);

  const effectiveRestaurantId = useMemo(() => {
    const candidates = [
      restaurantId,
      getRestaurantIdFromUrl(),
      user?.restaurantForStaff,
      user?.restaurantId,
    ];
    const valid = candidates.map(normalizeId).find(isValidObjectId);
    return valid || "";
  }, [restaurantId, user?.restaurantForStaff, user?.restaurantId]);

  const {
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

  const isBusy = approveOvertimeState.loading || rejectOvertimeState.loading;

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
    const filtered = allOvertimeRecords.filter((record) => {
      if (statusFilter === "all") return true;
      return getOvertimeStatus(record) === statusFilter;
    });

    return filtered.sort((left, right) => {
      const leftPending = getOvertimeStatus(left) === "pending" ? 0 : 1;
      const rightPending = getOvertimeStatus(right) === "pending" ? 0 : 1;
      if (leftPending !== rightPending) return leftPending - rightPending;
      return new Date(right.workDate || 0).getTime() - new Date(left.workDate || 0).getTime();
    });
  }, [allOvertimeRecords, statusFilter]);

  const stats = useMemo(() => {
    const total = allOvertimeRecords.length;
    const pending = allOvertimeRecords.filter((record) => getOvertimeStatus(record) === "pending").length;
    const approved = allOvertimeRecords.filter((record) => getOvertimeStatus(record) === "approved").length;
    const rejected = allOvertimeRecords.filter((record) => getOvertimeStatus(record) === "rejected").length;
    const rawMinutes = allOvertimeRecords.reduce((sum, record) => sum + Number(record?.overtimeMinutes || 0), 0);
    const approvedMinutes = allOvertimeRecords.reduce((sum, record) => sum + Number(record?.approvedOvertimeMinutes || 0), 0);

    return { total, pending, approved, rejected, rawMinutes, approvedMinutes };
  }, [allOvertimeRecords]);

  const openDialog = (mode, record) => setDialog(buildDefaultDialog(mode, record));

  const closeDialog = () => {
    if (isBusy) return;
    setDialog(null);
  };

  const updateDialog = (field, value) => {
    setDialog((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
            error: "",
          }
        : prev,
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!dialog?.record) return;

    const overtimeMinutes = Number(dialog.record?.overtimeMinutes || 0);

    try {
      if (dialog.mode === "approve") {
        const approvedMinutes = Number(dialog.approvedMinutes);
        if (!Number.isFinite(approvedMinutes)) {
          throw new Error("Số phút duyệt không hợp lệ.");
        }
        if (approvedMinutes < 0) {
          throw new Error("Số phút duyệt không được âm.");
        }
        if (approvedMinutes > overtimeMinutes) {
          throw new Error("Số phút duyệt không được vượt quá overtime thực tế.");
        }

        await approveAttendanceOvertime({
          variables: {
            input: {
              timesheetId: dialog.record.id,
              approvedOvertimeMinutes: approvedMinutes,
              reviewNote: dialog.note?.trim() || undefined,
            },
          },
        });
      }

      if (dialog.mode === "reject") {
        if (!dialog.note?.trim()) {
          throw new Error("Lý do từ chối là bắt buộc.");
        }

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
    } catch (err) {
      setDialog((prev) =>
        prev
          ? {
              ...prev,
              error: getOvertimeActionErrorMessage(
                err,
                err?.message || "Không thể xử lý duyệt tăng ca.",
              ),
            }
          : prev,
      );
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
          <small>Cần manager/admin/hr xử lý</small>
        </div>
        <div className="overtime-stat-card info">
          <span className="label">Overtime thực tế</span>
          <strong>{formatMinutes(stats.rawMinutes)}</strong>
          <small>Dựa trên planned end và check-out thực tế</small>
        </div>
        <div className="overtime-stat-card success">
          <span className="label">Được duyệt</span>
          <strong>{formatMinutes(stats.approvedMinutes)}</strong>
          <small>Payroll sau này chỉ dùng số phút này</small>
        </div>
      </div>

      <div className="table-section overtime-section">
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
          <div className="empty-state">
            ⚠️ Chưa xác định được nhà hàng để tải dữ liệu tăng ca. Hãy chọn nhà hàng ở bộ lọc phía trên.
          </div>
        )}

        {error && (
          <div className="empty-state">
            ❌ Không tải được dữ liệu tăng ca từ bảng công: {getOvertimeLoadErrorMessage(error)}
          </div>
        )}

        <div className="table-container">
          <table className="attendance-table overtime-table">
            <thead>
              <tr>
                <th width="18%">Nhân viên</th>
                <th width="10%">Ngày công</th>
                <th width="14%">Ca làm</th>
                <th width="12%">Check-out</th>
                <th width="12%">Overtime</th>
                <th width="12%">Được duyệt</th>
                <th width="14%">Trạng thái</th>
                <th width="8%" className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading && overtimeRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center">
                    Không có bản ghi tăng ca trong ngày đã chọn.
                  </td>
                </tr>
              )}

              {overtimeRecords.map((record) => {
                const displayName = record.employeeName || "Nhân viên";
                const status = getOvertimeStatus(record);
                const canAction = canShowAction(user, record);

                return (
                  <tr key={record.id}>
                    <td>
                      <div className="employee-cell">
                        <div
                          className="avatar"
                          style={{
                            backgroundImage: record.employeeAvatar ? `url(${record.employeeAvatar})` : "none",
                            backgroundColor: !record.employeeAvatar ? getAvatarColor(displayName) : "transparent",
                          }}
                        >
                          {!record.employeeAvatar && displayName.charAt(0)}
                        </div>
                        <div className="info">
                          <div className="name">{displayName}</div>
                          <div className="role">{record.employeeCode || "--"} • {record.employeeRole || "--"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(record.workDate)}</td>
                    <td>
                      <div className="compact-stack">
                        <strong>{shiftLabel(record)}</strong>
                        <span>{formatTime(record.plannedEndTime)} planned end</span>
                      </div>
                    </td>
                    <td>
                      <div className="compact-stack">
                        <strong>{formatTime(record.actualCheckOutAt)}</strong>
                        <span>{formatDateTime(record.actualCheckOutAt)}</span>
                      </div>
                    </td>
                    <td>{formatMinutes(record.overtimeMinutes)}</td>
                    <td><span className="overtime-approved-minutes">{formatMinutes(record.approvedOvertimeMinutes)}</span></td>
                    <td>
                      {getOvertimeStatusBadge(status)}
                      <div className="small-muted overtime-status-note">
                        {record.overtimeReviewNote ||
                          (status === "pending"
                            ? "Chưa review"
                            : record.overtimeReviewedAt
                              ? `Review lúc ${formatDateTime(record.overtimeReviewedAt)}`
                              : "--")}
                      </div>
                    </td>
                    <td className="text-right">
                      {canAction && (
                        <>
                          <button
                            type="button"
                            className="action-btn approve"
                            title="Duyệt tăng ca"
                            disabled={isBusy}
                            onClick={() => openDialog("approve", record)}
                          >
                            ✅
                          </button>
                          <button
                            type="button"
                            className="action-btn reject"
                            title="Từ chối tăng ca"
                            disabled={isBusy}
                            onClick={() => openDialog("reject", record)}
                          >
                            ⛔
                          </button>
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

      {dialog?.record && (
        <div className="attendance-modal-overlay" onMouseDown={closeDialog}>
          <div
            className="attendance-correction-modal overtime-review-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>{dialog.mode === "approve" ? "Duyệt tăng ca từ bảng công" : "Từ chối tăng ca từ bảng công"}</h3>
                <p>{dialog.record.employeeName || "Nhân viên"} • {formatDate(dialog.record.workDate)}</p>
              </div>
              <button type="button" className="modal-close" onClick={closeDialog} disabled={isBusy}>×</button>
            </div>

            <form className="correction-form" onSubmit={handleSubmit}>
              <div className="overtime-modal-summary">
                <div>
                  <span className="label">Ca làm</span>
                  <strong>{shiftLabel(dialog.record)}</strong>
                </div>
                <div>
                  <span className="label">Check-out thực tế</span>
                  <strong>{formatDateTime(dialog.record.actualCheckOutAt)}</strong>
                </div>
                <div>
                  <span className="label">Overtime thực tế</span>
                  <strong>{formatMinutes(dialog.record.overtimeMinutes)}</strong>
                </div>
                <div>
                  <span className="label">Trạng thái hiện tại</span>
                  {getOvertimeStatusBadge(getOvertimeStatus(dialog.record))}
                </div>
              </div>

              {dialog.error && <div className="form-alert error">{dialog.error}</div>}

              {dialog.mode === "approve" && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Số phút được duyệt</label>
                    <input
                      type="number"
                      min="0"
                      max={Number(dialog.record.overtimeMinutes || 0)}
                      value={dialog.approvedMinutes}
                      onChange={(event) => updateDialog("approvedMinutes", event.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Ghi chú review</label>
                    <textarea
                      value={dialog.note}
                      onChange={(event) => updateDialog("note", event.target.value)}
                      placeholder="Ghi chú nếu cần..."
                    />
                  </div>
                </div>
              )}

              {dialog.mode === "reject" && (
                <div className="form-group full-width">
                  <label>Lý do từ chối</label>
                  <textarea
                    value={dialog.note}
                    onChange={(event) => updateDialog("note", event.target.value)}
                    placeholder="Nêu rõ vì sao overtime này không được duyệt..."
                    required
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeDialog} disabled={isBusy}>Đóng</button>
                <button type="submit" className={`btn ${dialog.mode === "reject" ? "btn-danger" : "btn-primary"}`} disabled={isBusy}>
                  {dialog.mode === "approve" && (approveOvertimeState.loading ? "Đang duyệt..." : "Xác nhận duyệt")}
                  {dialog.mode === "reject" && (rejectOvertimeState.loading ? "Đang từ chối..." : "Xác nhận từ chối")}
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
