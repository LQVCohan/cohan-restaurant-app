import {
  AvailabilityRegistrationWindow,
  StaffAvailabilitySubmission,
  Staff,
} from "../../../models/index.js";
import { getSchedulingPolicy } from "../../../src/services/scheduling/schedulingPolicy.service.js";
import {
  requireAuth,
  requireRestaurantAccess,
  requireRoles,
} from "../../guards.js";
import {
  createOrGetAvailabilityRegistrationWindow,
  isAvailabilityRegistrationWindowOpen,
  lockSubmissionsForClosedWindow,
} from "../../../src/services/availability/availabilityRegistrationWindow.service.js";
import {
  AVAILABILITY_WINDOW_ADMIN_ROLES,
  AVAILABILITY_REVIEW_ROLES,
  userHasAnyRole,
} from "../../../src/services/scheduling/schedulingPermission.service.js";
import {
  buildAvailabilityRegistrationSchedule,
  resolveAvailabilityWindowEffectiveStatus,
} from "../../../src/services/availability/availabilityRegistrationSchedule.service.js";

const SCHEDULING_TIMEZONE = "Asia/Ho_Chi_Minh";
const PART_TIME_EMPLOYMENT_TYPES = new Set([
  "part_time",
  "seasonal",
  "probation",
  "contract",
]);

function normalizeEmploymentType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeShiftType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function dateKeyInSchedulingTimezone(value) {
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

function parseTimeToMinutes(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getTemplateDurationHours(template) {
  const start = parseTimeToMinutes(template?.startTime);
  const end = parseTimeToMinutes(template?.endTime);
  if (start == null || end == null) return 0;

  let durationMinutes = end - start;
  if (template?.allowCrossDay || durationMinutes <= 0) {
    durationMinutes += 24 * 60;
  }
  return durationMinutes > 0 ? durationMinutes / 60 : 0;
}

async function getScopedAvailabilityWindow(id, ctx) {
  const doc = await AvailabilityRegistrationWindow.findById(id);
  if (!doc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
  await requireRestaurantAccess(ctx, doc.restaurantId);
  return doc;
}

async function getCanonicalStaff(employeeId) {
  const query = Staff.findById(employeeId);
  const selected = query?.select
    ? query.select({ _id: 1, restaurantForStaff: 1, employmentType: 1 })
    : query;
  return selected?.lean ? selected.lean() : selected;
}

function getEmployeeRestaurantId(employee) {
  return (
    employee?.restaurantForStaff?._id ||
    employee?.restaurantForStaff?.id ||
    employee?.restaurantForStaff ||
    null
  );
}

function resolveAvailabilityRequirement({ policy, windowDoc, employmentType }) {
  const registrationPolicy = policy?.availabilityRegistrationPolicy || {};
  const targetEmploymentTypes = (
    windowDoc?.targetEmploymentTypes?.length
      ? windowDoc.targetEmploymentTypes
      : registrationPolicy.targetEmploymentTypes || []
  ).map(normalizeEmploymentType);
  const employmentPolicy = policy?.employmentTypePolicy?.[employmentType] || {};

  return {
    employmentPolicy,
    requiresWeeklyAvailability:
      PART_TIME_EMPLOYMENT_TYPES.has(employmentType) ||
      targetEmploymentTypes.includes(employmentType) ||
      employmentPolicy.requireAvailability === true,
  };
}

function validateSubmission({
  input,
  windowDoc,
  policy,
  requiresWeeklyAvailability,
  employmentPolicy,
}) {
  const expectedSubmissionType = requiresWeeklyAvailability
    ? "weekly_availability"
    : "unavailable_exception";
  const submissionType = String(input.submissionType || "").toLowerCase();

  if (submissionType !== expectedSubmissionType) {
    throw new Error("AVAILABILITY_SUBMISSION_TYPE_MISMATCH");
  }
  if (
    !requiresWeeklyAvailability &&
    windowDoc.allowFullTimeUnavailableException === false
  ) {
    throw new Error("AVAILABILITY_UNAVAILABLE_EXCEPTION_DISABLED");
  }

  const expectedSlotStatus = requiresWeeklyAvailability
    ? "available"
    : "unavailable";
  const enabledTemplates = (policy?.shiftTemplates || []).filter(
    (template) => template?.enabled !== false,
  );
  const templateByKey = new Map(
    enabledTemplates.map((template) => [
      normalizeShiftType(template?.key),
      template,
    ]),
  );
  if (!templateByKey.size) {
    throw new Error("AVAILABILITY_SHIFT_TEMPLATES_MISSING");
  }

  const periodStartKey = dateKeyInSchedulingTimezone(windowDoc.periodStart);
  const periodEndKey = dateKeyInSchedulingTimezone(windowDoc.periodEnd);
  const seenSlots = new Set();
  let selectedHours = 0;

  const slots = (input.slots || []).map((slot) => {
    const date = new Date(slot?.date);
    const dateKey = dateKeyInSchedulingTimezone(date);
    const shiftType = normalizeShiftType(slot?.shiftType);
    const status = String(slot?.status || "").toLowerCase();

    if (!dateKey || dateKey < periodStartKey || dateKey > periodEndKey) {
      throw new Error("AVAILABILITY_SLOT_OUTSIDE_PERIOD");
    }
    const template = templateByKey.get(shiftType);
    if (!template) throw new Error("AVAILABILITY_SHIFT_TYPE_INVALID");
    if (status !== expectedSlotStatus) {
      throw new Error("AVAILABILITY_SLOT_STATUS_MISMATCH");
    }

    const slotKey = `${dateKey}|${shiftType}`;
    if (seenSlots.has(slotKey)) {
      throw new Error("AVAILABILITY_DUPLICATE_SLOT");
    }
    seenSlots.add(slotKey);
    selectedHours += getTemplateDurationHours(template);

    return {
      date,
      shiftType,
      status,
      note: String(slot?.note || "").trim(),
    };
  });

  const minWeeklyHours = Number(employmentPolicy?.minWeeklyHours || 0);
  if (
    requiresWeeklyAvailability &&
    minWeeklyHours > 0 &&
    selectedHours + Number.EPSILON < minWeeklyHours
  ) {
    throw new Error("AVAILABILITY_MIN_WEEKLY_HOURS_NOT_MET");
  }

  return { slots, submissionType };
}

export default {
  createAvailabilityWindow: async (_, { input }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await requireRestaurantAccess(ctx, input.restaurantId);
    const policy = await getSchedulingPolicy({ restaurantId: input.restaurantId });
    const schedule = buildAvailabilityRegistrationSchedule({
      targetWeekStart: input.periodStart,
      targetWeekEnd: input.periodEnd,
      policy,
    });
    const availabilityPolicy = policy?.availabilityRegistrationPolicy || {};

    return createOrGetAvailabilityRegistrationWindow(
      {
        ...input,
        openAt: schedule.openAt,
        closeAt: schedule.closeAt,
        registrationModeSnapshot: schedule.mode,
        targetEmploymentTypes:
          input.targetEmploymentTypes ||
          availabilityPolicy.targetEmploymentTypes ||
          ["part_time", "seasonal"],
        allowFullTimeUnavailableException:
          input.allowFullTimeUnavailableException ??
          availabilityPolicy.allowFullTimeUnavailableException ??
          true,
        lateChangeRequiresApproval:
          input.lateChangeRequiresApproval ??
          availabilityPolicy.lateChangeRequiresApproval ??
          true,
      },
      ctx.user.id,
    );
  },
  openAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await getScopedAvailabilityWindow(id, ctx);
    return AvailabilityRegistrationWindow.findByIdAndUpdate(
      id,
      { $set: { status: "open" } },
      { new: true },
    );
  },
  closeAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    const windowDoc = await getScopedAvailabilityWindow(id, ctx);
    const now = new Date();
    const updatedWindow = await AvailabilityRegistrationWindow.findByIdAndUpdate(
      id,
      { $set: { status: "closed", closedBy: ctx.user.id, closedAt: now } },
      { new: true },
    );
    await lockSubmissionsForClosedWindow(windowDoc._id || id, now);
    return updatedWindow;
  },
  cancelAvailabilityWindow: async (_, { id, reason }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await getScopedAvailabilityWindow(id, ctx);
    return AvailabilityRegistrationWindow.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "cancelled",
          cancelledBy: ctx.user.id,
          cancelReason: reason || "",
        },
      },
      { new: true },
    );
  },
  submitStaffAvailability: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const isManager = userHasAnyRole(
      ctx.user,
      AVAILABILITY_WINDOW_ADMIN_ROLES,
    );
    if (!isManager && String(ctx.user.id) !== String(input.employeeId)) {
      throw new Error("FORBIDDEN");
    }

    const windowDoc = await AvailabilityRegistrationWindow.findById(
      input.availabilityWindowId,
    );
    if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    await requireRestaurantAccess(ctx, windowDoc.restaurantId);

    const employee = await getCanonicalStaff(input.employeeId);
    if (
      !employee ||
      String(getEmployeeRestaurantId(employee)) !==
        String(windowDoc.restaurantId)
    ) {
      throw new Error("EMPLOYEE_NOT_IN_RESTAURANT");
    }
    const employmentType = normalizeEmploymentType(employee.employmentType);
    if (!employmentType) throw new Error("STAFF_EMPLOYMENT_TYPE_MISSING");

    const windowStatus = String(windowDoc.status || "").toLowerCase();
    if (windowStatus === "used_for_schedule") {
      throw new Error("AVAILABILITY_WINDOW_LOCKED_FOR_SCHEDULE");
    }
    if (windowStatus === "cancelled") {
      throw new Error("AVAILABILITY_WINDOW_CANCELLED");
    }

    const effectiveStatus = resolveAvailabilityWindowEffectiveStatus(windowDoc);
    if (effectiveStatus === "cancelled") {
      throw new Error("AVAILABILITY_WINDOW_CANCELLED");
    }
    if (
      effectiveStatus === "used_for_schedule" ||
      effectiveStatus === "locked"
    ) {
      throw new Error("AVAILABILITY_WINDOW_LOCKED_FOR_SCHEDULE");
    }
    if (effectiveStatus === "draft") {
      throw new Error("AVAILABILITY_WINDOW_NOT_OPEN");
    }

    const policy = await getSchedulingPolicy({
      restaurantId: windowDoc.restaurantId,
    });
    const { employmentPolicy, requiresWeeklyAvailability } =
      resolveAvailabilityRequirement({ policy, windowDoc, employmentType });
    const validated = validateSubmission({
      input,
      windowDoc,
      policy,
      requiresWeeklyAvailability,
      employmentPolicy,
    });
    const isEffectivelyClosed =
      effectiveStatus === "closed" ||
      (effectiveStatus !== "open" &&
        !isAvailabilityRegistrationWindowOpen(windowDoc));
    const source = isManager ? "manager" : "employee";
    const now = new Date();

    if (isEffectivelyClosed) {
      if (!windowDoc.lateChangeRequiresApproval) {
        throw new Error("AVAILABILITY_WINDOW_CLOSED");
      }
      const existingQuery = StaffAvailabilitySubmission.findOne({
        availabilityWindowId: input.availabilityWindowId,
        employeeId: input.employeeId,
      });
      const existingSubmission = existingQuery?.lean
        ? await existingQuery.lean()
        : await existingQuery;
      const previousStatusBeforeLateChange =
        existingSubmission?.status === "late_change_requested"
          ? existingSubmission?.previousStatusBeforeLateChange || null
          : existingSubmission?.status || null;
      return StaffAvailabilitySubmission.findOneAndUpdate(
        {
          availabilityWindowId: input.availabilityWindowId,
          employeeId: input.employeeId,
        },
        {
          $set: {
            availabilityWindowId: input.availabilityWindowId,
            employeeId: input.employeeId,
            restaurantId: windowDoc.restaurantId,
            periodStart: windowDoc.periodStart,
            periodEnd: windowDoc.periodEnd,
            employmentType,
            status: "late_change_requested",
            pendingSlots: validated.slots,
            pendingSubmittedAt: now,
            pendingSubmissionType: validated.submissionType,
            pendingSource: source,
            pendingNote: String(input.note || "").trim(),
            previousStatusBeforeLateChange,
            source,
          },
          $setOnInsert: {
            slots: [],
            submittedAt: null,
            submissionType: validated.submissionType,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    return StaffAvailabilitySubmission.findOneAndUpdate(
      {
        availabilityWindowId: input.availabilityWindowId,
        employeeId: input.employeeId,
      },
      {
        $set: {
          availabilityWindowId: input.availabilityWindowId,
          employeeId: input.employeeId,
          restaurantId: windowDoc.restaurantId,
          periodStart: windowDoc.periodStart,
          periodEnd: windowDoc.periodEnd,
          employmentType,
          submissionType: validated.submissionType,
          slots: validated.slots,
          submittedAt: now,
          source,
          status: "submitted",
          pendingSlots: [],
          pendingSubmittedAt: null,
          pendingSubmissionType: null,
          pendingSource: null,
          pendingNote: "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  },
  reviewStaffAvailabilitySubmission: async (_, { input }, ctx) => {
    requireRoles(ctx, AVAILABILITY_REVIEW_ROLES);
    const existing = await StaffAvailabilitySubmission.findById(input.id);
    if (!existing) {
      throw new Error("STAFF_AVAILABILITY_SUBMISSION_NOT_FOUND");
    }
    await requireRestaurantAccess(ctx, existing.restaurantId);
    const now = new Date();
    const reviewBase = {
      reviewNote: input.reviewNote || "",
      reviewedAt: now,
      reviewedBy: ctx.user.id,
    };

    if (
      String(existing.status || "").toLowerCase() ===
      "late_change_requested"
    ) {
      if (input.status === "approved") {
        return StaffAvailabilitySubmission.findByIdAndUpdate(
          input.id,
          {
            $set: {
              ...reviewBase,
              status: "approved",
              slots: existing.pendingSlots || [],
              submissionType:
                existing.pendingSubmissionType || existing.submissionType,
              submittedAt:
                existing.pendingSubmittedAt || existing.submittedAt || now,
              pendingSlots: [],
              pendingSubmittedAt: null,
              pendingSubmissionType: null,
              pendingSource: null,
              pendingNote: "",
              previousStatusBeforeLateChange: null,
            },
          },
          { new: true },
        );
      }

      if (input.status === "rejected") {
        const previousStatus = String(
          existing.previousStatusBeforeLateChange || "",
        ).toLowerCase();
        const hasOfficialSlots =
          Array.isArray(existing.slots) && existing.slots.length > 0;
        const restoredStatus = ["submitted", "locked", "approved"].includes(
          previousStatus,
        )
          ? previousStatus
          : hasOfficialSlots
            ? "locked"
            : "rejected";
        return StaffAvailabilitySubmission.findByIdAndUpdate(
          input.id,
          {
            $set: {
              ...reviewBase,
              status: restoredStatus,
              pendingSlots: [],
              pendingSubmittedAt: null,
              pendingSubmissionType: null,
              pendingSource: null,
              pendingNote: "",
              previousStatusBeforeLateChange: null,
            },
          },
          { new: true },
        );
      }
    }

    return StaffAvailabilitySubmission.findByIdAndUpdate(
      input.id,
      { $set: { ...reviewBase, status: input.status } },
      { new: true },
    );
  },
};
