import { AvailabilityWindow, StaffAvailabilitySubmission } from "../../../models/index.js";
import { requireAuth, requireRestaurantScope } from "../../guards.js";

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
    return StaffAvailabilitySubmission.findOne({ availabilityWindowId: windowId, employeeId });
  },
  staffAvailabilitySubmissions: async (_, { windowId, restaurantId, status, employmentType }, ctx) => {
    requireAuth(ctx);
    requireRestaurantScope(ctx, restaurantId);
    const query = { availabilityWindowId: windowId, restaurantId };
    if (status) query.status = status;
    if (employmentType) query.employmentType = employmentType;
    return StaffAvailabilitySubmission.find(query);
  },
};
