// src/graphql/resolvers/inventory/stockItem.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import { StockItem, StockMovement } from "../../../models/index.js";

export default {
  // Tạo / cập nhật 1 StockItem (admin cấu hình kho)
  upsertStockItem: async (
    _p,
    { restaurantId, warehouseId, ingredientId, onHand, reserved, batches }
  ) => {
    if (
      ![restaurantId, warehouseId, ingredientId].every(mongoose.isValidObjectId)
    ) {
      throw new GraphQLError("Invalid ids");
    }

    const update = {
      $set: { restaurantId, warehouseId, ingredientId },
    };
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

  // Điều chỉnh kho (kiểm kê, nhập tay), có log movement
  adjustStock: async (
    _p,
    { restaurantId, warehouseId, ingredientId, qty, reason }
  ) => {
    if (
      ![restaurantId, warehouseId, ingredientId].every(mongoose.isValidObjectId)
    ) {
      throw new GraphQLError("Invalid ids");
    }

    if (typeof qty !== "number" || Number.isNaN(qty) || qty === 0) {
      throw new GraphQLError("qty must be a non-zero number");
    }

    const session = await mongoose.startSession();

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
              meta: {},
            },
          ],
          { session }
        );

        // Có thể thêm check âm kho nếu muốn cứng hơn:
        // if ((item.onHand ?? 0) < 0) throw new GraphQLError("Stock cannot be negative");
      });

      await session.endSession();

      return StockItem.findOne({
        restaurantId,
        warehouseId,
        ingredientId,
      }).lean({ virtuals: true });
    } catch (e) {
      await session.endSession();
      throw new GraphQLError(e.message || "adjustStock failed");
    }
  },

  // Chuyển kho: bắt buộc kho nguồn đã có item và đủ onHand
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
    if (typeof qty !== "number" || qty <= 0) {
      throw new GraphQLError("qty must be > 0");
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1) Lấy stock ở kho nguồn (KHÔNG upsert)
        const src = await StockItem.findOne({
          restaurantId,
          warehouseId: fromWarehouseId,
          ingredientId,
        }).session(session);

        if (!src) {
          throw new GraphQLError(
            "Source stock item not found (no stock in fromWarehouse)"
          );
        }

        if ((src.onHand ?? 0) < qty) {
          throw new GraphQLError("Insufficient stock at source warehouse");
        }

        // 2) Trừ kho nguồn
        src.onHand -= qty;
        await src.save({ session });

        // 3) Cộng kho đích (cho phép upsert vì có thể lần đầu nhập về kho này)
        await StockItem.findOneAndUpdate(
          { restaurantId, warehouseId: toWarehouseId, ingredientId },
          { $inc: { onHand: qty } },
          { new: true, upsert: true, runValidators: true, session }
        );

        // 4) Ghi movement cho cả 2 kho
        await StockMovement.create(
          [
            {
              restaurantId,
              warehouseId: fromWarehouseId,
              ingredientId,
              type: "transfer",
              qty: -qty,
              reason,
              meta: { toWarehouseId },
            },
            {
              restaurantId,
              warehouseId: toWarehouseId,
              ingredientId,
              type: "transfer",
              qty: qty,
              reason,
              meta: { fromWarehouseId },
            },
          ],
          { session }
        );
      });

      await session.endSession();
      return true;
    } catch (e) {
      await session.endSession();
      throw new GraphQLError(e.message || "transferStock failed");
    }
  },
};
