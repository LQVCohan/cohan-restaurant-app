import { AvailabilityRegistrationWindow, StaffAvailabilitySubmission } from "../../../models/index.js";
import { requireAuth, requireRestaurantScope, requireRoles } from "../../guards.js";
import { AVAILABILITY_READ_ROLES, userHasAnyRole } from "../../../src/services/scheduling/schedulingPermission.service.js";

export default {
  availabilityWindow: async (_, { restaurantId, periodStart, periodEnd }, ctx) => {
    requireAuth(ctx);
    requireRestaurantScope(ctx, restaurantId);
    return AvailabilityRegistrationWindow.findOne({ restaurantId, periodStart, periodEnd });
  },
  availabilityWindows: async (_, { restaurantId, from, to, status }, ctx) => {
    requireAuth(ctx);
    requireRestaurantScope(ctx, restaurantId);
    const query = { restaurantId };
    if (status) query.status = status;
    if (from || to) query.periodStart = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    return AvailabilityRegistrationWindow.find(query).sort({ periodStart: 1 });
  },
  staffAvailabilitySubmission: async (_, { windowId, employeeId }, ctx) => {
    requireAuth(ctx);
    const windowDoc = await AvailabilityRegistrationWindow.findById(windowId);
    if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    requireRestaurantScope(ctx, windowDoc.restaurantId);

    const currentUserId = ctx?.user?.id || ctx?.user?._id;
    const canReadAll = userHasAnyRole(ctx.user, AVAILABILITY_READ_ROLES);
    if (!canReadAll && String(currentUserId) !== String(employeeId)) throw new Error("FORBIDDEN");

    return StaffAvailabilitySubmission.findOne({ availabilityWindowId: windowId, employeeId });
  },
  staffAvailabilitySubmissions: async (_, { windowId, restaurantId, status, employmentType }, ctx) => {
    requireRoles(ctx, AVAILABILITY_READ_ROLES);
    requireRestaurantScope(ctx, restaurantId);
    const query = { availabilityWindowId: windowId, restaurantId };
    if (status) query.status = status;
    if (employmentType) query.employmentType = employmentType;
    return StaffAvailabilitySubmission.find(query);
  },
};
