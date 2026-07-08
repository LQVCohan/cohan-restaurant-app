import {
  AvailabilityRegistrationWindow,
  StaffAvailabilitySubmission,
} from "../../../models/index.js";
import { isFirstOperationalWeek } from "./schedulingPolicy.service.js";

export const AVAILABILITY_RULE_CODES = {
  PART_TIME_AVAILABILITY_REQUIRED: "PART_TIME_AVAILABILITY_REQUIRED",
  OUTSIDE_SUBMITTED_AVAILABILITY: "OUTSIDE_SUBMITTED_AVAILABILITY",
  FULL_TIME_UNAVAILABLE_EXCEPTION: "FULL_TIME_UNAVAILABLE_EXCEPTION",
  AVAILABILITY_PENDING_SUBMISSION: "AVAILABILITY_PENDING_SUBMISSION",
  LATE_AVAILABILITY_CHANGE_PENDING: "LATE_AVAILABILITY_CHANGE_PENDING",
  FIRST_WEEK_GRACE_MISSING_AVAILABILITY:
    "FIRST_WEEK_GRACE_MISSING_AVAILABILITY",
};

const ACTIVE_SUBMISSION_STATUSES = new Set([
  "submitted",
  "locked",
  "approved",
]);
const INACTIVE_SUBMISSION_STATUSES = new Set(["rejected", "cancelled"]);
const SCHEDULING_TIMEZONE = "Asia/Ho_Chi_Minh";

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeekMonday(value) {
  const d = startOfDay(value);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function endOfWeekMonday(value) {
  const start = startOfWeekMonday(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function dateKeyInSchedulingTimezone(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const raw = value.trim();
    const dateOnlyMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateOnlyMatch && !raw.includes("T")) return dateOnlyMatch[0];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function normalizeShiftType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "ca_sang") return "morning";
  if (normalized === "ca_chieu") return "afternoon";
  if (normalized === "ca_toi") return "evening";
  return normalized;
}

function normalizeEmploymentType(value) {
  return String(value || "full_time")
    .trim()
    .toLowerCase();
}

function isWindowClosed(windowDoc, now = new Date()) {
  if (!windowDoc) return false;
  const status = String(windowDoc.status || "").toLowerCase();
  return (
    ["closed", "used_for_schedule"].includes(status) ||
    now > new Date(windowDoc.closeAt)
  );
}

function isWindowOpenOrPending(windowDoc, now = new Date()) {
  if (!windowDoc) return true;
  if (isWindowClosed(windowDoc, now)) return false;
  return String(windowDoc.status || "").toLowerCase() !== "cancelled";
}

function toIssue({ code, severity, message, suggestedAction }) {
  return {
    code,
    severity,
    message,
    suggestedAction: suggestedAction || "",
  };
}

function findSlot(slots = [], date, shiftType, status) {
  const dateKey = dateKeyInSchedulingTimezone(date);
  const typeKey = normalizeShiftType(shiftType);

  return (slots || []).find((slot) => {
    if (!slot?.date) return false;
    if (status && String(slot?.status || "").toLowerCase() !== status) {
      return false;
    }

    return (
      dateKeyInSchedulingTimezone(slot?.date) === dateKey &&
      normalizeShiftType(slot?.shiftType) === typeKey
    );
  });
}

function getEmploymentPolicy(policy, employmentType) {
  return (
    policy?.employmentTypePolicy?.[employmentType] ||
    policy?.employmentTypePolicy?.full_time ||
    {}
  );
}

function requiresSubmittedAvailability({ policy, employmentType, windowDoc }) {
  const registrationPolicy = policy?.availabilityRegistrationPolicy || {};
  const targets = Array.isArray(registrationPolicy.targetEmploymentTypes)
    ? registrationPolicy.targetEmploymentTypes.map(normalizeEmploymentType)
    : [];

  if (targets.includes(employmentType)) return true;
  if (
    Array.isArray(windowDoc?.targetEmploymentTypes) &&
    windowDoc.targetEmploymentTypes
      .map(normalizeEmploymentType)
      .includes(employmentType)
  ) {
    return true;
  }

  return Boolean(
    getEmploymentPolicy(policy, employmentType).requireAvailability,
  );
}

function shouldRespectAvailability(policy) {
  return policy?.availabilityRegistrationPolicy?.enabled !== false;
}

async function leanOne(query) {
  if (!query) return null;
  if (typeof query.lean === "function") return query.lean();
  return query;
}

export async function findAvailabilityWindowForShift({
  restaurantId,
  shiftDate,
}) {
  const weekStart = startOfWeekMonday(shiftDate);
  const weekEnd = endOfWeekMonday(shiftDate);

  const query = AvailabilityRegistrationWindow.findOne({
    restaurantId,
    status: { $ne: "cancelled" },
    periodStart: { $lte: endOfDay(weekStart) },
    periodEnd: { $gte: startOfDay(weekEnd) },
  });

  if (query && typeof query.sort === "function") {
    return query.sort({ periodStart: -1 }).lean();
  }

  return leanOne(query);
}

async function findSubmission({ availabilityWindowId, employeeId }) {
  if (!availabilityWindowId) return null;
  return leanOne(
    StaffAvailabilitySubmission.findOne({
      availabilityWindowId,
      employeeId,
    }),
  );
}

export async function resolveStaffAvailabilityForShift({
  restaurantId,
  employeeId,
  staff,
  shiftDate,
  shiftType,
  policy,
  now = new Date(),
}) {
  if (!shouldRespectAvailability(policy)) {
    return {
      status: "not_applicable",
      issues: [],
      window: null,
      submission: null,
    };
  }

  const employmentType = normalizeEmploymentType(staff?.employmentType);
  const windowDoc = await findAvailabilityWindowForShift({
    restaurantId,
    shiftDate,
  });
  const requiresSubmission = requiresSubmittedAvailability({
    policy,
    employmentType,
    windowDoc,
  });

  if (!windowDoc) {
    if (!requiresSubmission) {
      return {
        status: "default_available",
        issues: [],
        window: null,
        submission: null,
      };
    }

    return {
      status: "pending_submission",
      issues: [
        toIssue({
          code: AVAILABILITY_RULE_CODES.AVAILABILITY_PENDING_SUBMISSION,
          severity: "info",
          message: "Availability chua dong, du lieu con cho cap nhat.",
          suggestedAction:
            "Cho den khi window availability dong hoac yeu cau nhan vien dang ky ca.",
        }),
      ],
      window: null,
      submission: null,
    };
  }

  const submission = await findSubmission({
    availabilityWindowId: windowDoc._id,
    employeeId,
  });
  const submissionStatus = String(submission?.status || "").toLowerCase();
  const lateChangePending = submissionStatus === "late_change_requested";
  const windowClosed = isWindowClosed(windowDoc, now);
  const windowStillOpen = isWindowOpenOrPending(windowDoc, now);
  const issues = [];

  if (lateChangePending) {
    issues.push(
      toIssue({
        code: AVAILABILITY_RULE_CODES.LATE_AVAILABILITY_CHANGE_PENDING,
        severity: "warning",
        message: "Thay doi availability sau han dang cho quan ly duyet.",
        suggestedAction:
          "Chi xep ca neu quan ly chap nhan rui ro hoac duyet thay doi availability.",
      }),
    );
  }

  if (requiresSubmission) {
    const hasUsableSubmission =
      submission &&
      !INACTIVE_SUBMISSION_STATUSES.has(submissionStatus) &&
      ACTIVE_SUBMISSION_STATUSES.has(submissionStatus);

    if (!hasUsableSubmission) {
      if (windowClosed) {
        const firstWeekGrace = isFirstOperationalWeek(policy, shiftDate);
        if (firstWeekGrace.active) {
          return {
            status: "missing_required_submission_first_week_grace",
            issues: [
              ...issues,
              toIssue({
                code: AVAILABILITY_RULE_CODES.FIRST_WEEK_GRACE_MISSING_AVAILABILITY,
                severity: "info",
                message:
                  "Nhân viên chưa có đăng ký availability do tuần đầu sử dụng hệ thống.",
                suggestedAction:
                  "Có thể xếp tạm trong tuần đầu, nhưng nên mở đăng ký lịch cho tuần sau ngay.",
              }),
            ],
            window: windowDoc,
            submission,
          };
        }
        return {
          status: "missing_required_submission",
          issues: [
            ...issues,
            toIssue({
              code: AVAILABILITY_RULE_CODES.PART_TIME_AVAILABILITY_REQUIRED,
              severity: "risk",
              message:
                "Nhan vien thuoc nhom bat buoc chua dang ky availability cho ky nay.",
              suggestedAction:
                "Chon nhan vien da dang ky ca, hoac override voi ly do neu van can xep.",
            }),
          ],
          window: windowDoc,
          submission,
        };
      }

      return {
        status: "pending_submission",
        issues: [
          ...issues,
          toIssue({
            code: AVAILABILITY_RULE_CODES.AVAILABILITY_PENDING_SUBMISSION,
            severity: "info",
            message: "Availability chua dong, du lieu con cho cap nhat.",
            suggestedAction:
              "Co the tao lich nhap, nhung nen kiem tra lai sau khi window dong.",
          }),
        ],
        window: windowDoc,
        submission,
      };
    }

    if (findSlot(submission.slots, shiftDate, shiftType, "available")) {
      return {
        status: "available",
        issues,
        window: windowDoc,
        submission,
      };
    }

    if (windowClosed) {
      return {
        status: "outside_submitted_availability",
        issues: [
          ...issues,
          toIssue({
            code: AVAILABILITY_RULE_CODES.OUTSIDE_SUBMITTED_AVAILABILITY,
            severity: "risk",
            message: "Nhan vien chua dang ky available cho ca nay.",
            suggestedAction:
              "Uu tien nhan vien da dang ky available cho ca nay; neu bat buoc xep thi can override co ly do.",
          }),
        ],
        window: windowDoc,
        submission,
      };
    }

    if (windowStillOpen) {
      return {
        status: "pending_submission",
        issues: [
          ...issues,
          toIssue({
            code: AVAILABILITY_RULE_CODES.AVAILABILITY_PENDING_SUBMISSION,
            severity: "info",
            message: "Availability chua dong, du lieu con cho cap nhat.",
            suggestedAction:
              "Chua xem slot thieu dang ky la unavailable truoc khi window dong.",
          }),
        ],
        window: windowDoc,
        submission,
      };
    }
  }

  if (
    submission &&
    submission.submissionType === "unavailable_exception" &&
    !INACTIVE_SUBMISSION_STATUSES.has(submissionStatus) &&
    findSlot(submission.slots, shiftDate, shiftType, "unavailable")
  ) {
    return {
      status: "unavailable_exception",
      issues: [
        ...issues,
        toIssue({
          code: AVAILABILITY_RULE_CODES.FULL_TIME_UNAVAILABLE_EXCEPTION,
          severity: "warning",
          message: "Nhan vien da bao khong kha dung.",
          suggestedAction:
            "Chon nhan vien khac hoac override co ly do neu van can xep ca.",
        }),
      ],
      window: windowDoc,
      submission,
    };
  }

  return {
    status: issues.length ? "late_change_pending" : "default_available",
    issues,
    window: windowDoc,
    submission,
  };
}
