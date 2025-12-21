// src/graphql/resolvers/inventory/reservation.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import {
  reserveForOrderTx,
  commitReservationForOrderTx,
  cancelReservationForOrderTx,
} from "../../../src/services/inventory.service.js";

import { Warehouse } from "../../../models/index.js";

async function resolveWarehouseIdOrDefault(restaurantId, warehouseIdInput) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new GraphQLError("Invalid restaurantId");
  }

  if (warehouseIdInput) {
    if (!mongoose.isValidObjectId(warehouseIdInput)) {
      throw new GraphQLError("Invalid warehouseId");
    }
    return warehouseIdInput;
  }

  const wh = await Warehouse.findOne({
    restaurantId,
    isActive: true,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!wh) {
    throw new GraphQLError("No warehouse found for this restaurant");
  }

  return wh._id;
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new GraphQLError("lines is required");
  }

  return lines.map((l, idx) => {
    if (!l || !mongoose.isValidObjectId(l.menuItemId)) {
      throw new GraphQLError(`Invalid menuItemId at lines[${idx}]`);
    }

    const quantity =
      l.quantity === null || l.quantity === undefined
        ? undefined
        : Number(l.quantity);
    const weightGrams =
      l.weightGrams === null || l.weightGrams === undefined
        ? undefined
        : Number(l.weightGrams);

    if (quantity !== undefined && !Number.isFinite(quantity)) {
      throw new GraphQLError(`Invalid quantity at lines[${idx}]`);
    }
    if (weightGrams !== undefined && !Number.isFinite(weightGrams)) {
      throw new GraphQLError(`Invalid weightGrams at lines[${idx}]`);
    }

    return {
      ...l,
      quantity,
      weightGrams,
    };
  });
}

function validateBaseInput(input) {
  const { restaurantId, orderCode, lines } = input || {};
  if (!mongoose.isValidObjectId(restaurantId))
    throw new GraphQLError("Invalid restaurantId");
  if (!orderCode || !String(orderCode).trim())
    throw new GraphQLError("orderCode is required");
  const normalizedLines = normalizeLines(lines);
  return {
    restaurantId,
    orderCode: String(orderCode).trim(),
    lines: normalizedLines,
  };
}

export default {
  // reserved += need
  reserveForOrder: async (_p, { input }) => {
    try {
      const { restaurantId, orderCode, lines } = validateBaseInput(input);
      const warehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        input?.warehouseId
      );

      return await reserveForOrderTx({
        restaurantId,
        warehouseId,
        orderCode,
        lines,
        allowNegative: !!input?.allowNegative,
      });
    } catch (e) {
      throw new GraphQLError(e?.message || "reserveForOrder failed");
    }
  },

  // reserved -= need, onHand -= need, FEFO movements
  commitReservationForOrder: async (_p, { input }) => {
    try {
      const { restaurantId, orderCode, lines } = validateBaseInput(input);
      const warehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        input?.warehouseId
      );

      return await commitReservationForOrderTx({
        restaurantId,
        warehouseId,
        orderCode,
        lines,
        allowNegative: !!input?.allowNegative,
      });
    } catch (e) {
      throw new GraphQLError(e?.message || "commitReservationForOrder failed");
    }
  },

  // reserved -= need
  cancelReservationForOrder: async (_p, { input }) => {
    try {
      const { restaurantId, orderCode, lines } = validateBaseInput(input);
      const warehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        input?.warehouseId
      );

      return await cancelReservationForOrderTx({
        restaurantId,
        warehouseId,
        orderCode,
        lines,
        allowNegative: !!input?.allowNegative,
      });
    } catch (e) {
      throw new GraphQLError(e?.message || "cancelReservationForOrder failed");
    }
  },
};
