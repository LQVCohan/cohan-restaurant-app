import mongoose from "mongoose";
import { Table } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

async function updateTableRequest({ restaurantId, orderId, requestId, status, ctx }) {
  const rid = toId(restaurantId);
  const tableId = toId(orderId);
  if (!rid || !tableId || !requestId) return null;

  const fields = { "customerRequests.$.status": status };
  const now = new Date();
  if (status === "ACKNOWLEDGED") {
    fields["customerRequests.$.acknowledgedAt"] = now;
  }
  if (status === "RESOLVED") {
    fields["customerRequests.$.resolvedAt"] = now;
  }

  const table = await Table.findOneAndUpdate(
    {
      _id: tableId,
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
  if (!table) return null;

  await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_UPDATE);
  return {
    ok: true,
    message:
      status === "RESOLVED"
        ? "Đã hoàn tất yêu cầu hỗ trợ."
        : "Đã nhận yêu cầu hỗ trợ.",
  };
}

export function normalizeTableCustomerRequestQuery(queries = {}) {
  return {
    ...queries,
    async customerServiceRequests(parent, args, ctx, info) {
      const rows = await queries.customerServiceRequests(parent, args, ctx, info);
      return (rows || []).map((row) => ({
        ...row,
        orderId: row?.orderId || row?.tableId || null,
      }));
    },
  };
}

export function normalizeTableCustomerRequestMutations(mutations = {}) {
  return {
    ...mutations,
    async acknowledgeCustomerServiceRequest(parent, args, ctx, info) {
      const result = await updateTableRequest({
        ...args,
        status: "ACKNOWLEDGED",
        ctx,
      });
      if (result) return result;
      return mutations.acknowledgeCustomerServiceRequest(parent, args, ctx, info);
    },
    async resolveCustomerServiceRequest(parent, args, ctx, info) {
      const result = await updateTableRequest({
        ...args,
        status: "RESOLVED",
        ctx,
      });
      if (result) return result;
      return mutations.resolveCustomerServiceRequest(parent, args, ctx, info);
    },
  };
}
