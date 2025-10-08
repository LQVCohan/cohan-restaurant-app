import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import { StockItem, StockMovement } from "../../../models/index.js";

export default {
  upsertStockItem: async (
    _p,
    { restaurantId, warehouseId, ingredientId, onHand, reserved, batches }
  ) => {
    if (
      ![restaurantId, warehouseId, ingredientId].every(mongoose.isValidObjectId)
    ) {
      throw new GraphQLError("Invalid ids");
    }
    const update = { $set: { restaurantId, warehouseId, ingredientId } };
    if (typeof onHand === "number") update.$set.onHand = onHand;
    if (typeof reserved === "number") update.$set.reserved = reserved;
    if (Array.isArray(batches)) update.$set.batches = batches;

    const doc = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId, ingredientId },
      update,
      { new: true, upsert: true, runValidators: true }
    ).lean({ virtuals: true });
    return doc;
  },

  adjustStock: async (
    _p,
    { restaurantId, warehouseId, ingredientId, qty, reason }
  ) => {
    if (
      ![restaurantId, warehouseId, ingredientId].every(mongoose.isValidObjectId)
    ) {
      throw new GraphQLError("Invalid ids");
    }
    const session = await StockItem.startSession();
    try {
      await session.withTransaction(async () => {
        const item = await StockItem.findOneAndUpdate(
          { restaurantId, warehouseId, ingredientId },
          { $inc: { onHand: qty } },
          { new: true, upsert: true, runValidators: true, session }
        );
        await StockMovement.create(
          [
            {
              restaurantId,
              warehouseId,
              ingredientId,
              type: qty >= 0 ? "inbound" : "outbound",
              qty,
              reason,
            },
          ],
          { session }
        );
      });
      session.endSession();
      return StockItem.findOne({
        restaurantId,
        warehouseId,
        ingredientId,
      }).lean({ virtuals: true });
    } catch (e) {
      session.endSession();
      throw new GraphQLError(e.message || "adjustStock failed");
    }
  },

  transferStock: async (
    _p,
    { restaurantId, fromWarehouseId, toWarehouseId, ingredientId, qty, reason }
  ) => {
    if (
      ![restaurantId, fromWarehouseId, toWarehouseId, ingredientId].every(
        mongoose.isValidObjectId
      )
    ) {
      throw new GraphQLError("Invalid ids");
    }
    if (qty <= 0) throw new GraphQLError("qty must be > 0");

    const session = await StockItem.startSession();
    try {
      await session.withTransaction(async () => {
        const src = await StockItem.findOneAndUpdate(
          { restaurantId, warehouseId: fromWarehouseId, ingredientId },
          { $inc: { onHand: -qty } },
          { new: true, upsert: true, runValidators: true, session }
        );
        if ((src.onHand ?? 0) < 0)
          throw new GraphQLError("Insufficient stock at source");

        await StockItem.findOneAndUpdate(
          { restaurantId, warehouseId: toWarehouseId, ingredientId },
          { $inc: { onHand: qty } },
          { new: true, upsert: true, runValidators: true, session }
        );

        await StockMovement.create(
          [
            {
              restaurantId,
              warehouseId: fromWarehouseId,
              ingredientId,
              type: "transfer",
              qty: -qty,
              reason,
            },
            {
              restaurantId,
              warehouseId: toWarehouseId,
              ingredientId,
              type: "transfer",
              qty: qty,
              reason,
            },
          ],
          { session }
        );
      });
      session.endSession();
      return true;
    } catch (e) {
      session.endSession();
      throw new GraphQLError(e.message || "transferStock failed");
    }
  },
};
