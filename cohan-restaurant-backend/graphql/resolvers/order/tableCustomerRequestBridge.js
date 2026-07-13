import mongoose from "mongoose";
import { Table } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

if (!Table.schema.path("customerRequests")) {
  Table.schema.add({
    customerRequests: {
      type: [
        {
          requestId: { type: String, required: true },
          type: { type: String, required: true },
          status: { type: String, default: "PENDING" },
          message: { type: String, trim: true, maxlength: 200 },
          source: { type: String, default: "CUSTOMER_TABLE_QR" },
          createdAt: { type: Date, default: Date.now },
          acknowledgedAt: { type: Date, default: null },
          resolvedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
  });
}

const objectId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const activeRequest = (request) =>
  ["PENDING", "ACKNOWLEDGED"].includes(
    String(request?.status || "").toUpperCase(),
  );

export async function createPreSessionTableStaffCall({
  restaurantId,
  tableId,
  message,
  ctx,
}) {
  const rid = objectId(restaurantId);
  const tid = objectId(tableId);
  if (!rid || !tid) return null;
  const table = await Table.findOne({ _id: tid, restaurantId: rid });
  if (!table) return null;

  const existing = (table.customerRequests || []).find(
    (request) => request?.type === "STAFF_CALL" && activeRequest(request),
  );
  if (existing) return existing;

  const request = {
    requestId: new mongoose.Types.ObjectId().toString(),
    type: "STAFF_CALL",
    status: "PENDING",
    message: String(message || "Khách cần hỗ trợ để mở bàn và gọi món.")
      .trim()
      .slice(0, 200),
    source: "CUSTOMER_TABLE_QR",
    createdAt: new Date(),
  };
  table.customerRequests = table.customerRequests || [];
  table.customerRequests.push(request);
  await table.save();

  ctx?.io?.to(`restaurant_${rid}`).emit("orderEvents", {
    type: "CUSTOMER_STAFF_CALL_REQUESTED",
    payload: {
      restaurantId: String(rid),
      tableId: String(tid),
      tableCode: table.code || null,
      requestId: request.requestId,
      requestStatus: request.status,
    },
  });
  return request;
}

const mapRequest = (table, request) => ({
  orderId: null,
  tableId: String(table._id),
  orderCode: null,
  trackingCode: null,
  tableCode: table.code || null,
  requestId: request.requestId,
  type: request.type,
  status: request.status,
  message: request.message || null,
  createdAt: request.createdAt,
  acknowledgedAt: request.acknowledgedAt || null,
  resolvedAt: request.resolvedAt || null,
});

export function withTableCustomerRequestQuery(queries = {}) {
  return {
    ...queries,
    async customerServiceRequests(parent, args, ctx, info) {
      const base = await queries.customerServiceRequests(parent, args, ctx, info);
      const rid = objectId(args?.restaurantId);
      if (!rid) return base;
      await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_READ);
      const status = String(args?.status || "PENDING").toUpperCase();
      const type = args?.type ? String(args.type).toUpperCase() : null;
      const match = { status };
      if (type) match.type = type;
      const tables = await Table.find({
        restaurantId: rid,
        customerRequests: { $elemMatch: match },
      })
        .select({ code: 1, customerRequests: 1 })
        .lean();
      const rows = tables.flatMap((table) =>
        (table.customerRequests || [])
          .filter(
            (request) =>
              String(request.status || "").toUpperCase() === status &&
              (!type || String(request.type || "").toUpperCase() === type),
          )
          .map((request) => mapRequest(table, request)),
      );
      const limit = Math.max(1, Math.min(100, Number(args?.limit) || 50));
      return [...(base || []), ...rows]
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, limit);
    },
  };
}

async function updateRequest({ restaurantId, tableId, requestId, status, ctx }) {
  const rid = objectId(restaurantId);
  const tid = objectId(tableId);
  if (!rid || !tid) throw new Error("Không tìm thấy bàn cần hỗ trợ.");
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_UPDATE);
  const now = new Date();
  const fields = { "customerRequests.$.status": status };
  if (status === "ACKNOWLEDGED") fields["customerRequests.$.acknowledgedAt"] = now;
  if (status === "RESOLVED") fields["customerRequests.$.resolvedAt"] = now;
  const table = await Table.findOneAndUpdate(
    {
      _id: tid,
      restaurantId: rid,
      customerRequests: {
        $elemMatch: {
          requestId: String(requestId),
          status: { $in: ["PENDING", "ACKNOWLEDGED"] },
        },
      },
    },
    { $set: fields },
    { new: true },
  ).lean();
  if (!table) throw new Error("Yêu cầu đã được xử lý hoặc không còn tồn tại.");
  return {
    ok: true,
    message:
      status === "RESOLVED"
        ? "Đã hoàn tất yêu cầu hỗ trợ."
        : "Đã nhận yêu cầu hỗ trợ.",
  };
}

export function withTableCustomerRequestMutations(mutations = {}) {
  return {
    ...mutations,
    acknowledgeCustomerServiceRequest(parent, args, ctx, info) {
      if (args?.tableId) {
        return updateRequest({ ...args, status: "ACKNOWLEDGED", ctx });
      }
      return mutations.acknowledgeCustomerServiceRequest(parent, args, ctx, info);
    },
    resolveCustomerServiceRequest(parent, args, ctx, info) {
      if (args?.tableId) {
        return updateRequest({ ...args, status: "RESOLVED", ctx });
      }
      return mutations.resolveCustomerServiceRequest(parent, args, ctx, info);
    },
  };
}
