import { isForbiddenError, isUnauthenticatedError } from "@/utils/graphqlErrorUtils";

export const CORRECTION_STATUS_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "applied", label: "Đã áp dụng" },
  { key: "rejected", label: "Từ chối" },
  { key: "cancelled", label: "Đã hủy" },
];

export const CORRECTION_TYPES = [
  { value: "missing_check_in", label: "Quên check-in" },
  { value: "missing_check_out", label: "Quên check-out" },
  { value: "wrong_check_in", label: "Sai giờ check-in" },
  { value: "wrong_check_out", label: "Sai giờ check-out" },
  { value: "wrong_check_in_out", label: "Sai cả check-in/out" },
  { value: "off_schedule_work", label: "Làm ngoài lịch" },
  { value: "other", label: "Khác" },
];

const REVIEW_ROLES = new Set(["admin", "manager", "hr"]);
const STAFF_ROLE = "staff";

export const normalizeRole = (value) => String(value || "").toLowerCase();

export const getUserId = (user) => user?.id || user?._id || user?.userId || null;

export const getRoleName = (user) =>
  normalizeRole(
    user?.roleName || user?.role?.slug || user?.userType || user?.role,
  );

export const canReviewCorrection = (user) => REVIEW_ROLES.has(getRoleName(user));

export const canCancelCorrection = (user, request) => {
  if (!request || request.status !== "pending") return false;
  if (canReviewCorrection(user)) return true;

  const userId = getUserId(user);
  const roleName = getRoleName(user);

  return (
    roleName === STAFF_ROLE &&
    userId &&
    (String(request.requestedBy || "") === String(userId) ||
      String(request.employeeId || "") === String(userId))
  );
};

export const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

export const toDatetimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
};

export const fromDatetimeLocalToIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};

export const formatTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateTime = (value) => {
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

export const getCorrectionTypeLabel = (value) =>
  CORRECTION_TYPES.find((item) => item.value === value)?.label || value || "--";

export const getAttendanceActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) {
    return "Bạn không có quyền thực hiện thao tác chấm công/chỉnh công này.";
  }
  if (isUnauthenticatedError(error)) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.";
  }
  return fallback;
};

export const getAvatarColor = (name = "?") => {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return colors[name.length % colors.length];
};

export const getDefaultCorrectionType = (record) => {
  if (!record?.actualCheckInAt) return "missing_check_in";
  if (!record?.actualCheckOutAt) return "missing_check_out";
  return "wrong_check_in_out";
};

export const hasValidObjectIdLike = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export const resolveTimesheetId = (record) => {
  if (hasValidObjectIdLike(record?.timesheetId)) return record.timesheetId;
  if (hasValidObjectIdLike(record?.timesheet?.id)) return record.timesheet.id;
  if (hasValidObjectIdLike(record?.timesheet?._id)) return record.timesheet._id;

  // Legacy attendance rows sometimes used `id` as the Timesheet id. Keep this
  // only as a last-resort fallback so non-Timesheet attendance ids are not sent
  // ahead of an explicit timesheetId.
  if (hasValidObjectIdLike(record?.id)) return record.id;
  return undefined;
};

export const buildCorrectionInitialForm = (record, selectedDate) => ({
  correctionType: getDefaultCorrectionType(record),
  requestedCheckInAt: toDatetimeLocalValue(record?.actualCheckInAt),
  requestedCheckOutAt: toDatetimeLocalValue(record?.actualCheckOutAt),
  reason: "",
  evidenceNote: "",
  evidenceUrlsText: "",
  workDate: toDateInputValue(record?.workDate) || selectedDate,
});

export const validateCorrectionForm = (form) => {
  if (!form?.reason?.trim() || form.reason.trim().length < 5) {
    return "Vui lòng nhập lý do chỉnh công tối thiểu 5 ký tự.";
  }

  if (!form.requestedCheckInAt && !form.requestedCheckOutAt) {
    return "Cần nhập ít nhất một giờ check-in hoặc check-out đề xuất.";
  }

  const requestedCheckInAt = fromDatetimeLocalToIso(form.requestedCheckInAt);
  const requestedCheckOutAt = fromDatetimeLocalToIso(form.requestedCheckOutAt);

  if (
    requestedCheckInAt &&
    requestedCheckOutAt &&
    new Date(requestedCheckOutAt) <= new Date(requestedCheckInAt)
  ) {
    return "Giờ check-out đề xuất phải lớn hơn giờ check-in đề xuất.";
  }

  return null;
};

export const getCorrectionStatusMeta = (status) => {
  const config = {
    pending: { label: "Chờ duyệt", className: "warning", icon: "⏳" },
    approved: { label: "Đã duyệt", className: "info", icon: "✅" },
    applied: { label: "Đã áp dụng", className: "success", icon: "✅" },
    rejected: { label: "Từ chối", className: "danger", icon: "⛔" },
    cancelled: { label: "Đã hủy", className: "neutral", icon: "🚫" },
  };

  return config[status] || {
    label: status || "--",
    className: "neutral",
    icon: "•",
  };
};
