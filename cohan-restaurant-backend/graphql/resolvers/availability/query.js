import mongoose from "mongoose";
import { AvailabilityRegistrationWindow, StaffAvailabilitySubmission } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess, requireRoles } from "../../guards.js";
import { AVAILABILITY_READ_ROLES, userHasAnyRole } from "../../../src/services/scheduling/schedulingPermission.service.js";

async function findWindowRestaurantScope(windowId) {
  const base = await AvailabilityRegistrationWindow.findById(windowId);
  if (base?.select) {
    const selected = base.select({ restaurantId: 1 });
    if (selected?.lean) return selected.lean();
    return selected;
  }
  return base;
}

export default {
  availabilityWindow: async (_, { restaurantId, periodStart, periodEnd }, ctx) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    return AvailabilityRegistrationWindow.findOne({ restaurantId, periodStart, periodEnd });
  },
  availabilityWindows: async (_, { restaurantId, from, to, status }, ctx) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    const query = { restaurantId };
    if (status) query.status = status;
    if (from || to) query.periodStart = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    return AvailabilityRegistrationWindow.find(query).sort({ periodStart: 1 });
  },
  staffAvailabilitySubmission: async (_, { windowId, employeeId }, ctx) => {
    requireAuth(ctx);
    const windowDoc = await findWindowRestaurantScope(windowId);
    if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    await requireRestaurantAccess(ctx, windowDoc.restaurantId);

    const currentUserId = ctx?.user?.id || ctx?.user?._id;
    const canReadAll = userHasAnyRole(ctx.user, AVAILABILITY_READ_ROLES);
    if (!canReadAll && String(currentUserId) !== String(employeeId)) throw new Error("FORBIDDEN");

    return StaffAvailabilitySubmission.findOne({ availabilityWindowId: windowId, employeeId });
  },
  staffAvailabilitySubmissions: async (_, { windowId, restaurantId, status, employmentType }, ctx) => {
    requireRoles(ctx, AVAILABILITY_READ_ROLES);
    await requireRestaurantAccess(ctx, restaurantId);
    const windowDoc = await findWindowRestaurantScope(windowId);
    if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    if (
      windowDoc?.restaurantId != null &&
      mongoose.isValidObjectId(String(windowDoc.restaurantId)) &&
      mongoose.isValidObjectId(String(restaurantId)) &&
      String(windowDoc.restaurantId) !== String(restaurantId)
    ) {
      throw new Error("AVAILABILITY_WINDOW_RESTAURANT_MISMATCH");
    }
    const query = { availabilityWindowId: windowId, restaurantId };
    if (status) query.status = status;
    if (employmentType) query.employmentType = employmentType;
    return StaffAvailabilitySubmission.find(query);
  },
};
