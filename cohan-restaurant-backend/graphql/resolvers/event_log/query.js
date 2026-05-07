import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import EventLog from "../../../models/event-log.model.js";
import { requireRestaurantAccess, requireRoles } from "../../guards.js";

function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

export default {
  async eventLogs(_, { filter = {}, limit = 50, skip = 0 }, ctx) {
    const restaurantId = filter?.restaurantId;
    if (restaurantId) {
      if (!mongoose.isValidObjectId(restaurantId)) {
        throw badInput("Invalid restaurantId");
      }
      await requireRestaurantAccess(ctx, restaurantId);
    } else {
      await requireRoles(ctx, ["ADMIN"]);
    }

    const q = {};

    if (filter.restaurantId) q.restaurantId = filter.restaurantId;
    if (filter.floorId) q.floorId = filter.floorId;
    if (filter.tableId) q.tableId = filter.tableId;
    if (filter.orderId) q.orderId = filter.orderId;
    if (filter.actorUserId) q.actorUserId = filter.actorUserId;
    if (filter.verb) q.verb = filter.verb;
    if (filter.status) q.status = filter.status;

    // thời gian
    if (filter.from || filter.to) {
      q.at = {};
      if (filter.from) q.at.$gte = new Date(filter.from);
      if (filter.to) q.at.$lte = new Date(filter.to);
    }

    // text search
    if (filter.text) {
      q.$text = { $search: filter.text };
    }

    const [items, total] = await Promise.all([
      EventLog.find(q)
        .sort({ at: -1 })
        .skip(skip)
        .limit(Math.min(limit, 500))
        .lean({ virtuals: true }),
      EventLog.countDocuments(q),
    ]);

    return { total, items };
  },
};
