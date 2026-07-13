import { Table } from "../../../models/index.js";
import publicTableSessionQuery from "./publicTableSessionQuery.js";

const ACTIVE = new Set(["PENDING", "ACKNOWLEDGED"]);

const mapRequest = (request) => ({
  requestId: request?.requestId || null,
  type: request?.type || null,
  status: request?.status || null,
  message: request?.message || null,
  createdAt: request?.createdAt || null,
  acknowledgedAt: request?.acknowledgedAt || null,
  resolvedAt: request?.resolvedAt || null,
});

export default {
  async publicActiveTableSessionOrders(parent, args, ctx, info) {
    const result = await publicTableSessionQuery.publicActiveTableSessionOrders(
      parent,
      args,
      ctx,
      info,
    );
    const table = await Table.findOne({
      _id: args.tableId,
      restaurantId: args.restaurantId,
    })
      .select({ customerRequests: 1 })
      .lean();
    const tableRequests = (table?.customerRequests || [])
      .filter((request) =>
        ACTIVE.has(String(request?.status || "").toUpperCase()),
      )
      .map(mapRequest);
    return {
      ...result,
      customerRequests: [
        ...(result?.customerRequests || []),
        ...tableRequests,
      ].sort(
        (a, b) =>
          new Date(b?.createdAt || 0).getTime() -
          new Date(a?.createdAt || 0).getTime(),
      ),
    };
  },
};
