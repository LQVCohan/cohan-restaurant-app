export const REVIEW_ROLES = new Set(["admin", "manager", "hr"]);
export const STAFF_ROLE = "staff";
export const MIN_CORRECTION_REASON_LENGTH = 5;

export const CORRECTION_TYPE_REQUIREMENTS = {
  missing_check_in: { requiresCheckIn: true, requiresCheckOut: false },
  missing_check_out: { requiresCheckIn: false, requiresCheckOut: true },
  wrong_check_in: { requiresCheckIn: true, requiresCheckOut: false },
  wrong_check_out: { requiresCheckIn: false, requiresCheckOut: true },
  wrong_check_in_out: { requiresCheckIn: true, requiresCheckOut: true },
  off_schedule_work: { requiresCheckIn: false, requiresCheckOut: false },
  other: { requiresCheckIn: false, requiresCheckOut: false },
};

export const normalizeRole = (value) => String(value || "").toLowerCase();

export const getUserId = (user) =>
  user?.id || user?._id || user?.userId || null;

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
    String(request.requestedBy || "") === String(userId)
  );
};

export const hasValidObjectIdLike = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export const buildEvidenceUrls = (value = "") =>
  String(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export const getCorrectionTimeRequirements = (correctionType) =>
  CORRECTION_TYPE_REQUIREMENTS[normalizeRole(correctionType)] ||
  CORRECTION_TYPE_REQUIREMENTS.other;

export const buildCreateCorrectionInput = ({
  record,
  form,
  restaurantId,
  workDate,
  requestedCheckInAt,
  requestedCheckOutAt,
}) => {
  const timesheetId =
    record?.timesheetId && hasValidObjectIdLike(record.timesheetId)
      ? record.timesheetId
      : hasValidObjectIdLike(record?.id)
        ? record.id
        : undefined;

  return {
    employeeId: record?.employeeId,
    restaurantId,
    timesheetId,
    shiftId: record?.shiftId || undefined,
    workDate,
    correctionType: form?.correctionType,
    requestedCheckInAt: requestedCheckInAt || undefined,
    requestedCheckOutAt: requestedCheckOutAt || undefined,
    reason: form?.reason?.trim(),
    evidenceNote: form?.evidenceNote?.trim() || undefined,
    evidenceUrls: buildEvidenceUrls(form?.evidenceUrlsText),
  };
};

export const validateCorrectionRequestForm = (form) => {
  const errors = {};
  const reason = form?.reason?.trim() || "";
  const requestedCheckInAt = form?.requestedCheckInAt;
  const requestedCheckOutAt = form?.requestedCheckOutAt;
  const requirements = getCorrectionTimeRequirements(form?.correctionType);

  if (reason.length < MIN_CORRECTION_REASON_LENGTH) {
    errors.reason = `Vui lòng nhập lý do chỉnh công tối thiểu ${MIN_CORRECTION_REASON_LENGTH} ký tự.`;
  }

  if (!requestedCheckInAt && !requestedCheckOutAt) {
    errors.requestedTime =
      "Cần nhập ít nhất một giờ check-in hoặc check-out đề xuất.";
  }

  if (requirements.requiresCheckIn && !requestedCheckInAt) {
    errors.requestedCheckInAt =
      "Loại chỉnh công này yêu cầu giờ check-in đề xuất.";
  }

  if (requirements.requiresCheckOut && !requestedCheckOutAt) {
    errors.requestedCheckOutAt =
      "Loại chỉnh công này yêu cầu giờ check-out đề xuất.";
  }

  if (requestedCheckInAt && requestedCheckOutAt) {
    const start = new Date(requestedCheckInAt);
    const end = new Date(requestedCheckOutAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      if (end <= start) {
        errors.requestedCheckOutAt =
          "Giờ check-out đề xuất phải lớn hơn giờ check-in đề xuất.";
      }
    }
  }

  return errors;
};