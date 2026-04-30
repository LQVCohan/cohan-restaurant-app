import { AvailabilityWindow, StaffAvailabilitySubmission } from "../../../models/index.js";
import { requireAuth, requireRestaurantScope, requireRoles } from "../../guards.js";

const MANAGER_ROLES = ["admin", "manager"];

export default {
  availabilityWindow: async (_, { restaurantId, periodStart, periodEnd }, ctx) => {
    requireAuth(ctx);
    requireRestaurantScope(ctx, restaurantId);
    return AvailabilityWindow.findOne({ restaurantId, periodStart, periodEnd });
  },
  availabilityWindows: async (_, { restaurantId, from, to, status }, ctx) => {
    requireAuth(ctx);
    requireRestaurantScope(ctx, restaurantId);
    const query = { restaurantId };
    if (status) query.status = status;
    if (from || to) query.periodStart = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    return AvailabilityWindow.find(query).sort({ periodStart: 1 });
  },
  staffAvailabilitySubmission: async (_, { windowId, employeeId }, ctx) => {
    requireAuth(ctx);
    const windowDoc = await AvailabilityWindow.findById(windowId);
    if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
    requireRestaurantScope(ctx, windowDoc.restaurantId);

    const currentUserId = ctx?.user?.id || ctx?.user?._id;
    const isManager = (ctx.user.roles || []).some((r) => MANAGER_ROLES.includes(r));
    if (!isManager && String(currentUserId) !== String(employeeId)) throw new Error("FORBIDDEN");

    return StaffAvailabilitySubmission.findOne({ availabilityWindowId: windowId, employeeId });
  },
  staffAvailabilitySubmissions: async (_, { windowId, restaurantId, status, employmentType }, ctx) => {
    requireRoles(ctx, MANAGER_ROLES);
    requireRestaurantScope(ctx, restaurantId);
    const query = { availabilityWindowId: windowId, restaurantId };
    if (status) query.status = status;
    if (employmentType) query.employmentType = employmentType;
    return StaffAvailabilitySubmission.find(query);
  },
};
