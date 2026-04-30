import { AvailabilityWindow, StaffAvailabilitySubmission } from "../../../models/index.js";
import { requireAuth, requireRestaurantScope, requireRoles } from "../../guards.js";
import { createOrGetAvailabilityWindow, isAvailabilityWindowOpen, lockSubmissionsForClosedWindow, getStaffEmploymentType } from "../../../src/services/availability/availabilityWindow.service.js";
import { AVAILABILITY_WINDOW_ADMIN_ROLES, AVAILABILITY_REVIEW_ROLES, userHasAnyRole } from "../../../src/services/scheduling/schedulingPermission.service.js";

async function getScopedAvailabilityWindow(id, ctx) {
  const doc = await AvailabilityWindow.findById(id);
  if (!doc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
  requireRestaurantScope(ctx, doc.restaurantId);
  return doc;
}

export default {
  createAvailabilityWindow: async (_, { input }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    requireRestaurantScope(ctx, input.restaurantId);
    return createOrGetAvailabilityWindow(input, ctx.user.id);
  },
  openAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await getScopedAvailabilityWindow(id, ctx);
    return AvailabilityWindow.findByIdAndUpdate(id, { $set: { status: "open" } }, { new: true });
  },
  closeAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await getScopedAvailabilityWindow(id, ctx);
    const now = new Date();
    const doc = await AvailabilityWindow.findByIdAndUpdate(id, { $set: { status: "closed", closedBy: ctx.user.id, closedAt: now } }, { new: true });
    await lockSubmissionsForClosedWindow(id, now);
    return doc;
  },
  cancelAvailabilityWindow: async (_, { id, reason }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await getScopedAvailabilityWindow(id, ctx);
    return AvailabilityWindow.findByIdAndUpdate(id, { $set: { status: "cancelled", cancelledBy: ctx.user.id, cancelReason: reason || "" } }, { new: true });
  },
  submitStaffAvailability: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const isManager = userHasAnyRole(ctx.user, AVAILABILITY_WINDOW_ADMIN_ROLES);
    if (!isManager && String(ctx.user.id) !== String(input.employeeId)) throw new Error("FORBIDDEN");

    const windowDoc = await AvailabilityWindow.findById(input.availabilityWindowId);
    if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    requireRestaurantScope(ctx, windowDoc.restaurantId);

    if (!isAvailabilityWindowOpen(windowDoc)) {
      if (!windowDoc.lateChangeRequiresApproval) {
        throw new Error("AVAILABILITY_WINDOW_CLOSED");
      }
      input.status = "late_change_requested";
    } else {
      input.status = input.status || "submitted";
    }

    const employmentType = input.employmentType || (await getStaffEmploymentType(input.employeeId));
    const source = isManager ? "manager" : "employee";
    return StaffAvailabilitySubmission.findOneAndUpdate(
      { availabilityWindowId: input.availabilityWindowId, employeeId: input.employeeId },
      { $set: { ...input, employmentType, periodStart: windowDoc.periodStart, periodEnd: windowDoc.periodEnd, restaurantId: windowDoc.restaurantId, submittedAt: new Date(), source } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  },
  reviewStaffAvailabilitySubmission: async (_, { input }, ctx) => {
    requireRoles(ctx, AVAILABILITY_REVIEW_ROLES);
    const existing = await StaffAvailabilitySubmission.findById(input.id);
    if (!existing) throw new Error("STAFF_AVAILABILITY_SUBMISSION_NOT_FOUND");
    requireRestaurantScope(ctx, existing.restaurantId);
    return StaffAvailabilitySubmission.findByIdAndUpdate(
      input.id,
      { $set: { status: input.status, reviewNote: input.reviewNote || "", reviewedAt: new Date(), reviewedBy: ctx.user.id } },
      { new: true },
    );
  },
};
