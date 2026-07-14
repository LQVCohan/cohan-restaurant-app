import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Order } from "../../../models/index.js";
import {
  formatOrderProofReadinessError,
  getOrderProofReadinessIssues,
  requiresOrderItemProofImage,
} from "../../../src/services/orderProofRules.service.js";

const TABLE_QR_ORDER_SOURCE = "customer_table_qr";
const SKIPPED_ITEM_STATUSES = new Set(["cancelled", "returned", "served"]);
const normalize = (value) => String(value || "").trim().toLowerCase();

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

const getOrderSource = (order = {}) =>
  normalize(
    order?.clientMeta?.source ||
      order?.clientMeta?.clientSource ||
      order?.clientMeta?.channel,
  );

const hasActiveProofRequiredItem = (order = {}) =>
  (Array.isArray(order?.items) ? order.items : []).some((item) => {
    const status = normalize(item?.status || "pending");
    return !SKIPPED_ITEM_STATUSES.has(status) && requiresOrderItemProofImage(item);
  });

async function loadPendingOrder(input = {}) {
  const orderId = toObjectId(input?.id || input?.orderId);
  if (!orderId) return null;

  const restaurantId = toObjectId(input?.restaurantId);
  const filter = restaurantId ? { _id: orderId, restaurantId } : { _id: orderId };
  const order = await Order.findOne(filter)
    .select({ currentStatus: 1, items: 1, clientMeta: 1 })
    .lean();

  if (!order || normalize(order.currentStatus) !== "pending") return null;
  return order;
}

export async function assertIncomingOrderProofReady(input = {}) {
  const order = await loadPendingOrder(input);
  if (!order) return;

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

export async function assertKitchenEntryStaffConfirmationReady(input = {}) {
  if (normalize(input?.status) !== "preparing") return;

  const order = await loadPendingOrder(input);
  if (!order) return;
  if (getOrderSource(order) !== TABLE_QR_ORDER_SOURCE) return;
  if (!hasActiveProofRequiredItem(order)) return;

  throw new GraphQLError(
    "Đơn có món cần ảnh minh chứng. Vui lòng chờ nhân viên/POS xác nhận trước khi nhận vào bếp.",
    {
      extensions: {
        code: "ORDER_STAFF_CONFIRMATION_REQUIRED",
      },
    },
  );
}

export function withIncomingOrderProofGuard(mutations = {}) {
  const guardedMutations = { ...mutations };
  const confirmIncomingOrder = mutations?.confirmIncomingOrder;
  const updateOrderStatus = mutations?.updateOrderStatus;
  const updateOrderItemStatus = mutations?.updateOrderItemStatus;

  if (typeof confirmIncomingOrder === "function") {
    guardedMutations.confirmIncomingOrder = async (parent, args, ctx, info) => {
      await assertIncomingOrderProofReady(args?.input || {});
      return confirmIncomingOrder(parent, args, ctx, info);
    };
  }

  if (typeof updateOrderStatus === "function") {
    guardedMutations.updateOrderStatus = async (parent, args, ctx, info) => {
      await assertKitchenEntryStaffConfirmationReady(args?.input || {});
      return updateOrderStatus(parent, args, ctx, info);
    };
  }

  if (typeof updateOrderItemStatus === "function") {
    guardedMutations.updateOrderItemStatus = async (parent, args, ctx, info) => {
      await assertKitchenEntryStaffConfirmationReady(args?.input || {});
      return updateOrderItemStatus(parent, args, ctx, info);
    };
  }

  return guardedMutations;
}

export default withIncomingOrderProofGuard;
