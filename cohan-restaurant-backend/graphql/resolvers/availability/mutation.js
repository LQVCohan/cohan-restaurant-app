import { AvailabilityRegistrationWindow, StaffAvailabilitySubmission } from "../../../models/index.js";
import { getSchedulingPolicy } from "../../../src/services/scheduling/schedulingPolicy.service.js";
import { requireAuth, requireRestaurantAccess, requireRoles } from "../../guards.js";
import { createOrGetAvailabilityRegistrationWindow, isAvailabilityRegistrationWindowOpen, getStaffEmploymentType } from "../../../src/services/availability/availabilityRegistrationWindow.service.js";
import { AVAILABILITY_WINDOW_ADMIN_ROLES, AVAILABILITY_REVIEW_ROLES, userHasAnyRole } from "../../../src/services/scheduling/schedulingPermission.service.js";
import { buildAvailabilityRegistrationSchedule, resolveAvailabilityWindowEffectiveStatus } from "../../../src/services/availability/availabilityRegistrationSchedule.service.js";

async function getScopedAvailabilityWindow(id, ctx) {
  const doc = await AvailabilityRegistrationWindow.findById(id);
  if (!doc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
  await requireRestaurantAccess(ctx, doc.restaurantId);
  return doc;
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

    return createOrGetAvailabilityRegistrationWindow({
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
    }, ctx.user.id);
  },
  openAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await getScopedAvailabilityWindow(id, ctx);
    return AvailabilityRegistrationWindow.findByIdAndUpdate(id, { $set: { status: "open" } }, { new: true });
  },
  closeAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await getScopedAvailabilityWindow(id, ctx);
    const now = new Date();
    return AvailabilityRegistrationWindow.findByIdAndUpdate(id, { $set: { status: "closed", closedBy: ctx.user.id, closedAt: now } }, { new: true });
  },
  cancelAvailabilityWindow: async (_, { id, reason }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await getScopedAvailabilityWindow(id, ctx);
    return AvailabilityRegistrationWindow.findByIdAndUpdate(id, { $set: { status: "cancelled", cancelledBy: ctx.user.id, cancelReason: reason || "" } }, { new: true });
  },
  submitStaffAvailability: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const isManager = userHasAnyRole(ctx.user, AVAILABILITY_WINDOW_ADMIN_ROLES);
    if (!isManager && String(ctx.user.id) !== String(input.employeeId)) throw new Error("FORBIDDEN");

    const windowDoc = await AvailabilityRegistrationWindow.findById(input.availabilityWindowId);
    if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    await requireRestaurantAccess(ctx, windowDoc.restaurantId);

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
    if (effectiveStatus === "used_for_schedule" || effectiveStatus === "locked") {
      throw new Error("AVAILABILITY_WINDOW_LOCKED_FOR_SCHEDULE");
    }
    if (effectiveStatus === "draft") {
      throw new Error("AVAILABILITY_WINDOW_NOT_OPEN");
    }
    const isEffectivelyClosed = effectiveStatus === "closed" || (effectiveStatus !== "open" && !isAvailabilityRegistrationWindowOpen(windowDoc));

    const employmentType = input.employmentType || (await getStaffEmploymentType(input.employeeId));
    const source = isManager ? "manager" : "employee";
    const now = new Date();

    if (isEffectivelyClosed) {
      if (!windowDoc.lateChangeRequiresApproval) throw new Error("AVAILABILITY_WINDOW_CLOSED");
      return StaffAvailabilitySubmission.findOneAndUpdate(
        { availabilityWindowId: input.availabilityWindowId, employeeId: input.employeeId },
        {
          $set: {
            availabilityWindowId: input.availabilityWindowId,
            employeeId: input.employeeId,
            restaurantId: windowDoc.restaurantId,
            periodStart: windowDoc.periodStart,
            periodEnd: windowDoc.periodEnd,
            employmentType,
            status: "late_change_requested",
            pendingSlots: input.slots || [],
            pendingSubmittedAt: now,
            pendingSubmissionType: input.submissionType,
            pendingSource: source,
            pendingNote: input.note || "",
            source,
          },
          $setOnInsert: {
            slots: [],
            submittedAt: null,
            submissionType: input.submissionType,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    return StaffAvailabilitySubmission.findOneAndUpdate(
      { availabilityWindowId: input.availabilityWindowId, employeeId: input.employeeId },
      {
        $set: {
          availabilityWindowId: input.availabilityWindowId,
          employeeId: input.employeeId,
          restaurantId: windowDoc.restaurantId,
          periodStart: windowDoc.periodStart,
          periodEnd: windowDoc.periodEnd,
          employmentType,
          submissionType: input.submissionType,
          slots: input.slots || [],
          submittedAt: now,
          source,
          status: input.status || "submitted",
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
    if (!existing) throw new Error("STAFF_AVAILABILITY_SUBMISSION_NOT_FOUND");
    await requireRestaurantAccess(ctx, existing.restaurantId);
    const now = new Date();
    const reviewBase = { reviewNote: input.reviewNote || "", reviewedAt: now, reviewedBy: ctx.user.id };

    if (String(existing.status || "").toLowerCase() === "late_change_requested") {
      if (input.status === "approved") {
        return StaffAvailabilitySubmission.findByIdAndUpdate(
          input.id,
          {
            $set: {
              ...reviewBase,
              status: "approved",
              slots: existing.pendingSlots || [],
              submissionType: existing.pendingSubmissionType || existing.submissionType,
              submittedAt: existing.pendingSubmittedAt || existing.submittedAt || now,
              pendingSlots: [],
              pendingSubmittedAt: null,
              pendingSubmissionType: null,
              pendingSource: null,
              pendingNote: "",
            },
          },
          { new: true },
        );
      }

      if (input.status === "rejected") {
        return StaffAvailabilitySubmission.findByIdAndUpdate(
          input.id,
          {
            $set: {
              ...reviewBase,
              status: "rejected",
              pendingSlots: [],
              pendingSubmittedAt: null,
              pendingSubmissionType: null,
              pendingSource: null,
              pendingNote: "",
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
