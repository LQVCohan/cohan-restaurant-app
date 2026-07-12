function normalizeMinutes(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(Math.round(numeric), 0);
}

export function buildAttendanceOvertimeState({
  overtimeMinutes,
  currentStatus,
  approvedOvertimeMinutes,
  previousOvertimeMinutes = null,
  reviewNote = "",
  reviewedBy = null,
  reviewedAt = null,
  preserveApproved = false,
  forcePending = false,
}) {
  const overtime = normalizeMinutes(overtimeMinutes);
  const approved = normalizeMinutes(approvedOvertimeMinutes);
  const status = String(currentStatus || "").trim().toLowerCase();
  const changed =
    previousOvertimeMinutes !== null &&
    previousOvertimeMinutes !== undefined &&
    normalizeMinutes(previousOvertimeMinutes) !== overtime;

  if (!changed && status === "approved" && approved > overtime) {
    throw new Error("OVERTIME_APPROVED_MINUTES_EXCEED_ACTUAL");
  }

  if (overtime <= 0) {
    return {
      approvedOvertimeMinutes: 0,
      overtimeApprovalStatus: "not_required",
      overtimeReviewNote: "",
      overtimeReviewedBy: null,
      overtimeReviewedAt: null,
    };
  }

  if (forcePending) {
    return {
      approvedOvertimeMinutes: 0,
      overtimeApprovalStatus: "pending",
      overtimeReviewNote: "",
      overtimeReviewedBy: null,
      overtimeReviewedAt: null,
    };
  }

  if (
    preserveApproved &&
    !changed &&
    status === "approved" &&
    approved > 0 &&
    approved <= overtime
  ) {
    return {
      approvedOvertimeMinutes: approved,
      overtimeApprovalStatus: "approved",
      overtimeReviewNote: String(reviewNote || ""),
      overtimeReviewedBy: reviewedBy || null,
      overtimeReviewedAt: reviewedAt || null,
    };
  }

  if (!changed && status === "rejected" && approved === 0) {
    return {
      approvedOvertimeMinutes: 0,
      overtimeApprovalStatus: "rejected",
      overtimeReviewNote: String(reviewNote || ""),
      overtimeReviewedBy: reviewedBy || null,
      overtimeReviewedAt: reviewedAt || null,
    };
  }

  if (status === "approved" && approved <= overtime && !changed) {
    return {
      approvedOvertimeMinutes: approved,
      overtimeApprovalStatus: "approved",
      overtimeReviewNote: String(reviewNote || ""),
      overtimeReviewedBy: reviewedBy || null,
      overtimeReviewedAt: reviewedAt || null,
    };
  }

  if (status === "rejected" && !changed) {
    return {
      approvedOvertimeMinutes: 0,
      overtimeApprovalStatus: "rejected",
      overtimeReviewNote: String(reviewNote || ""),
      overtimeReviewedBy: reviewedBy || null,
      overtimeReviewedAt: reviewedAt || null,
    };
  }

  return {
    approvedOvertimeMinutes: 0,
    overtimeApprovalStatus: "pending",
    overtimeReviewNote: "",
    overtimeReviewedBy: null,
    overtimeReviewedAt: null,
  };
}

export function applyAttendanceOvertimeState(record, options = {}) {
  const nextState = buildAttendanceOvertimeState({
    overtimeMinutes: record?.overtimeMinutes,
    currentStatus: record?.overtimeApprovalStatus,
    approvedOvertimeMinutes: record?.approvedOvertimeMinutes,
    previousOvertimeMinutes: options.previousOvertimeMinutes,
    reviewNote: record?.overtimeReviewNote,
    reviewedBy: record?.overtimeReviewedBy,
    reviewedAt: record?.overtimeReviewedAt,
    preserveApproved: Boolean(options.preserveApproved),
    forcePending: Boolean(options.forcePending),
  });

  record.approvedOvertimeMinutes = nextState.approvedOvertimeMinutes;
  record.overtimeApprovalStatus = nextState.overtimeApprovalStatus;
  record.overtimeReviewNote = nextState.overtimeReviewNote;
  record.overtimeReviewedBy = nextState.overtimeReviewedBy;
  record.overtimeReviewedAt = nextState.overtimeReviewedAt;

  return record;
}
