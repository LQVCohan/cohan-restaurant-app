import { AvailabilityWindow, StaffAvailabilitySubmission } from "../../../models/index.js";
import { requireAuth, requireRestaurantScope, requireRoles } from "../../guards.js";
import { createOrGetAvailabilityWindow, isAvailabilityWindowOpen, lockSubmissionsForClosedWindow, getStaffEmploymentType } from "../../../src/services/availability/availabilityWindow.service.js";

const MANAGER_ROLES = ["admin", "manager"];

export default {
  createAvailabilityWindow: async (_, { input }, ctx) => {
    requireRoles(ctx, MANAGER_ROLES);
    requireRestaurantScope(ctx, input.restaurantId);
    return createOrGetAvailabilityWindow(input, ctx.user.id);
  },
  openAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, MANAGER_ROLES);
    const doc = await AvailabilityWindow.findByIdAndUpdate(id, { $set: { status: "open" } }, { new: true });
    if (!doc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    return doc;
  },
  closeAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, MANAGER_ROLES);
    const doc = await AvailabilityWindow.findByIdAndUpdate(id, { $set: { status: "closed", closedBy: ctx.user.id, closeAt: new Date() } }, { new: true });
    if (!doc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    await lockSubmissionsForClosedWindow(id, new Date());
    return doc;
  },
  cancelAvailabilityWindow: async (_, { id, reason }, ctx) => {
    requireRoles(ctx, MANAGER_ROLES);
    return AvailabilityWindow.findByIdAndUpdate(id, { $set: { status: "cancelled", cancelledBy: ctx.user.id, cancelReason: reason || "" } }, { new: true });
  },
  submitStaffAvailability: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const isManager = (ctx.user.roles || []).some((r) => MANAGER_ROLES.includes(r));
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
    requireRoles(ctx, MANAGER_ROLES);
    return StaffAvailabilitySubmission.findByIdAndUpdate(
      input.id,
      { $set: { status: input.status, reviewNote: input.reviewNote || "", reviewedAt: new Date(), reviewedBy: ctx.user.id } },
      { new: true },
    );
  },
};
