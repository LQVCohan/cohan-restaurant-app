import mongoose from "mongoose";
import Order from "../../../models/order.model.js";
import Reservation from "../../../models/reservation.model.js";
import Table from "../../../models/table.model.js";
import { orderBatchOrLegacyFilter } from "../../../utils/orderLifecycle.js";

const ACTIVE_RESERVATION_STATUSES = [
  "pending_payment",
  "confirmed",
  "seated",
  "pending_change",
];

const getId = (value) => String(value?._id || value?.id || value || "");

async function resolveRequestedTable(input = {}) {
  if (input.tableId && mongoose.isValidObjectId(input.tableId)) {
    return Table.findOne({
      _id: input.tableId,
      restaurantId: input.restaurantId,
    })
      .select({
        _id: 1,
        code: 1,
        restaurantId: 1,
        joinGroupId: 1,
        mergedFromTableIds: 1,
        mergeAnchorTableId: 1,
      })
      .lean();
  }

  if (!input.tableCode) return null;
  return Table.findOne({
    restaurantId: input.restaurantId,
    code: String(input.tableCode).trim(),
    mergedIntoTableId: null,
  })
    .select({
      _id: 1,
      code: 1,
      restaurantId: 1,
      joinGroupId: 1,
      mergedFromTableIds: 1,
      mergeAnchorTableId: 1,
    })
    .lean();
}

async function buildSourceOrderInput(input, composite) {
  const sourceIds = Array.isArray(composite.mergedFromTableIds)
    ? composite.mergedFromTableIds.map(getId).filter(Boolean)
    : [];
  if (!sourceIds.length) return input;

  const requestedSourceId = String(
    input?.clientMeta?.tableMerge?.sourceTableId ||
      composite.mergeAnchorTableId ||
      sourceIds[0],
  );
  if (!sourceIds.includes(requestedSourceId)) {
    throw new Error("Bàn nguồn được chọn không thuộc bàn ghép này.");
  }

  const source = await Table.findOne({
    _id: requestedSourceId,
    restaurantId: input.restaurantId,
    mergedIntoTableId: composite._id,
  })
    .select({ _id: 1, code: 1 })
    .lean();
  if (!source) {
    throw new Error("Không tìm thấy bàn nguồn của bàn ghép.");
  }

  let customer = input.customer || null;
  if (!customer) {
    const reservation = await Reservation.findOne({
      restaurantId: input.restaurantId,
      tableId: composite._id,
      status: { $in: ACTIVE_RESERVATION_STATUSES },
    })
      .sort({ createdAt: -1 })
      .lean();
    if (
      reservation &&
      (reservation.customerName ||
        reservation.customerPhone ||
        reservation.customerEmail)
    ) {
      customer = {
        fullName: reservation.customerName || undefined,
        phone: reservation.customerPhone || undefined,
        email: reservation.customerEmail || undefined,
      };
    }
  }

  return {
    ...input,
    tableId: String(source._id),
    tableCode: source.code,
    customer,
    clientMeta: {
      ...(input.clientMeta || {}),
      tableMerge: {
        ...(input?.clientMeta?.tableMerge || {}),
        joinGroupId: composite.joinGroupId || null,
        mergedTableId: getId(composite),
        mergedTableCode: composite.code,
        sourceTableId: getId(source),
        sourceTableCode: source.code,
      },
    },
  };
}

export function withMergedTableOrderLifecycle(orderMutation) {
  return {
    ...orderMutation,

    async createOrderForTable(parent, args, ctx, info) {
      const requestedTable = await resolveRequestedTable(args?.input || {});
      const sourceInput = requestedTable
        ? await buildSourceOrderInput(args.input, requestedTable)
        : args?.input;

      const result = await orderMutation.createOrderForTable.call(
        this,
        parent,
        { ...args, input: sourceInput },
        ctx,
        info,
      );

      if (
        requestedTable &&
        Array.isArray(requestedTable.mergedFromTableIds) &&
        requestedTable.mergedFromTableIds.length > 0
      ) {
        await Table.updateOne(
          { _id: requestedTable._id, restaurantId: requestedTable.restaurantId },
          { $set: { status: "occupied" } },
        );
      }

      return result;
    },

    async requestPaymentForTable(parent, args, ctx, info) {
      const requestedTable = await resolveRequestedTable(args?.input || {});
      const sourceIds = Array.isArray(requestedTable?.mergedFromTableIds)
        ? requestedTable.mergedFromTableIds.filter(Boolean)
        : [];
      if (!requestedTable || !sourceIds.length) {
        return orderMutation.requestPaymentForTable.call(
          this,
          parent,
          args,
          ctx,
          info,
        );
      }

      const orders = await Order.find({
        restaurantId: args.input.restaurantId,
        tableId: { $in: [requestedTable._id, ...sourceIds] },
        currentStatus: { $nin: ["cancelled", "completed", "failed"] },
        ...orderBatchOrLegacyFilter(),
      })
        .select({ _id: 1 })
        .lean();
      if (!orders.length) {
        throw new Error("Không tìm thấy đơn đang phục vụ của bàn ghép này.");
      }

      return orderMutation.requestPaymentForOrder.call(
        this,
        parent,
        {
          input: {
            restaurantId: args.input.restaurantId,
            orderIds: orders.map((order) => String(order._id)),
          },
        },
        ctx,
        info,
      );
    },
  };
}
