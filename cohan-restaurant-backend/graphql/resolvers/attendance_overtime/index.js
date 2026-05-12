import { Timesheet } from "../../../models/index.js";
import {
  approveAttendanceOvertime,
  rejectAttendanceOvertime,
} from "../../../src/services/attendance/attendanceOvertimeApproval.service.js";
import { buildAttendanceOvertimeState } from "../../../src/services/attendance/attendanceOvertimeState.service.js";

async function loadTimesheet(source) {
  if (source?.__attendanceOvertimeTimesheet) {
    return source.__attendanceOvertimeTimesheet;
  }

  const timesheetId = source?.id || source?._id || null;
  if (!timesheetId) return null;

  const timesheet = await Timesheet.findById(timesheetId)
    .select({
      overtimeMinutes: 1,
      approvedOvertimeMinutes: 1,
      overtimeApprovalStatus: 1,
      overtimeReviewNote: 1,
      overtimeReviewedBy: 1,
      overtimeReviewedAt: 1,
    })
    .lean();

  if (source && typeof source === "object") {
    source.__attendanceOvertimeTimesheet = timesheet;
  }

  return timesheet;
}

function buildResolvedOvertimeState(source, timesheet) {
  return buildAttendanceOvertimeState({
    overtimeMinutes:
      source?.overtimeMinutes ?? timesheet?.overtimeMinutes ?? 0,
    currentStatus:
      source?.overtimeApprovalStatus ??
      timesheet?.overtimeApprovalStatus ??
      "not_required",
    approvedOvertimeMinutes:
      source?.approvedOvertimeMinutes ?? timesheet?.approvedOvertimeMinutes ?? 0,
    reviewNote:
      source?.overtimeReviewNote ?? timesheet?.overtimeReviewNote ?? "",
    reviewedBy:
      source?.overtimeReviewedBy ?? timesheet?.overtimeReviewedBy ?? null,
    reviewedAt:
      source?.overtimeReviewedAt ?? timesheet?.overtimeReviewedAt ?? null,
  });
}

export default {
  Mutation: {
    approveAttendanceOvertime: async (_, { input }, ctx) =>
      approveAttendanceOvertime({ input, ctx }),
    rejectAttendanceOvertime: async (_, { input }, ctx) =>
      rejectAttendanceOvertime({ input, ctx }),
  },
  StaffAttendanceRecord: {
    approvedOvertimeMinutes: async (source) => {
      if (source?.approvedOvertimeMinutes != null && source?.overtimeApprovalStatus) {
        return Number(source.approvedOvertimeMinutes || 0);
      }
      const timesheet = await loadTimesheet(source);
      return buildResolvedOvertimeState(source, timesheet).approvedOvertimeMinutes;
    },
    overtimeApprovalStatus: async (source) => {
      if (source?.overtimeApprovalStatus) {
        return String(source.overtimeApprovalStatus);
      }
      const timesheet = await loadTimesheet(source);
      return buildResolvedOvertimeState(source, timesheet).overtimeApprovalStatus;
    },
    overtimeReviewNote: async (source) => {
      if (source?.overtimeReviewNote != null && source?.overtimeApprovalStatus) {
        return String(source.overtimeReviewNote || "");
      }
      const timesheet = await loadTimesheet(source);
      return buildResolvedOvertimeState(source, timesheet).overtimeReviewNote;
    },
    overtimeReviewedBy: async (source) => {
      if (source?.overtimeReviewedBy !== undefined && source?.overtimeApprovalStatus) {
        return source.overtimeReviewedBy ? String(source.overtimeReviewedBy) : null;
      }
      const timesheet = await loadTimesheet(source);
      return buildResolvedOvertimeState(source, timesheet).overtimeReviewedBy
        ? String(buildResolvedOvertimeState(source, timesheet).overtimeReviewedBy)
        : null;
    },
    overtimeReviewedAt: async (source) => {
      if (source?.overtimeReviewedAt !== undefined && source?.overtimeApprovalStatus) {
        return source.overtimeReviewedAt || null;
      }
      const timesheet = await loadTimesheet(source);
      return buildResolvedOvertimeState(source, timesheet).overtimeReviewedAt || null;
    },
  },
};
