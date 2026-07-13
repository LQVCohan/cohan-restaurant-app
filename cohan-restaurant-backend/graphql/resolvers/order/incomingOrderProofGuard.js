import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Order } from "../../../models/index.js";
import {
  formatOrderProofReadinessError,
  getOrderProofReadinessIssues,
} from "../../../src/services/orderProofRules.service.js";

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

export async function assertIncomingOrderProofReady(input = {}) {
  const orderId = toObjectId(input?.id);
  if (!orderId) return;

  const restaurantId = toObjectId(input?.restaurantId);
  const filter = restaurantId ? { _id: orderId, restaurantId } : { _id: orderId };
  const order = await Order.findOne(filter)
    .select({ currentStatus: 1, items: 1, clientMeta: 1 })
    .lean();

  if (!order || String(order.currentStatus || "").toLowerCase() !== "pending") {
    return;
  }

  const issues = getOrderProofReadinessIssues(
    order.items || [],
    order.clientMeta?.proofWaivers || {},
  );
  if (!issues.length) return;

  throw new GraphQLError(formatOrderProofReadinessError(issues), {
    extensions: {
      code: "ORDER_PROOF_REQUIRED",
      items: issues,
    },
  });
}

export function withIncomingOrderProofGuard(mutations = {}) {
  const confirmIncomingOrder = mutations?.confirmIncomingOrder;
  if (typeof confirmIncomingOrder !== "function") return mutations;

  return {
    ...mutations,
    async confirmIncomingOrder(parent, args, ctx, info) {
      await assertIncomingOrderProofReady(args?.input || {});
      return confirmIncomingOrder(parent, args, ctx, info);
    },
  };
}

export default withIncomingOrderProofGuard;
