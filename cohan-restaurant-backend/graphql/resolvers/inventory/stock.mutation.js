// src/graphql/resolvers/inventory/stockItem.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  StockItem,
  StockMovement,
  Ingredient,
  Warehouse,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

export default {
  receiveStock: async (
    _p,
    {
      restaurantId,
      warehouseId,
      ingredientId,
      qty,
      costPerBaseUnit,
      reason,
      lot,
      expiry,
      supplierNote,
    },
    ctx,
  ) => {
    if (
      ![restaurantId, warehouseId, ingredientId].every(mongoose.isValidObjectId)
    ) {
      throw new GraphQLError("Invalid ids");
    }

    const nQty = Number(qty);
    const nCost = Number(costPerBaseUnit);
    if (!Number.isFinite(nQty) || nQty <= 0) {
      throw new GraphQLError("qty must be > 0");
    }
    if (!Number.isFinite(nCost) || nCost <= 0) {
      throw new GraphQLError("costPerBaseUnit is required and must be > 0");
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await StockItem.findOneAndUpdate(
          { restaurantId, warehouseId, ingredientId },
          {
            $inc: { onHand: nQty },
            $push: {
              batches: {
                lot: lot?.trim() || undefined,
                qty: nQty,
                expiry: expiry || undefined,
                costPerBaseUnit: nCost,
              },
            },
            $setOnInsert: { reserved: 0 },
          },
          { new: true, upsert: true, runValidators: true, session },
        );

        await StockMovement.create(
          [
            {
              restaurantId,
              warehouseId,
              ingredientId,
              type: "inbound",
              qty: nQty,
              reason: reason || "Nhập kho",
              meta: {
                lot: lot?.trim() || null,
                expiry: expiry || null,
                supplierNote: supplierNote?.trim() || null,
                costPerBaseUnit: nCost,
                totalValue: nQty * nCost,
              },
            },
          ],
          { session },
        );

        // V1 source-of-truth: Last purchase price (low-risk, dễ kiểm soát)
        await Ingredient.updateOne(
          { _id: ingredientId, restaurantId },
          { $set: { costPerBaseUnit: nCost } },
          { session },
        );
      });

      return StockItem.findOne({
        restaurantId,
        warehouseId,
        ingredientId,
      }).lean({ virtuals: true });
    } catch (e) {
      throw new GraphQLError(e?.message || "receiveStock failed");
    } finally {
      session.endSession();
    }
  },

  upsertStockItem: async (
    _p,
    { restaurantId, warehouseId, ingredientId, onHand, reserved, batches },
    ctx,
  ) => {
    if (
      ![restaurantId, warehouseId, ingredientId].every(mongoose.isValidObjectId)
    ) {
      throw new GraphQLError("Invalid ids");
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);

    const update = { $set: { restaurantId, warehouseId, ingredientId } };
    if (typeof onHand === "number" && Number.isFinite(onHand))
      update.$set.onHand = onHand;
    if (typeof reserved === "number" && Number.isFinite(reserved))
      update.$set.reserved = reserved;
    if (Array.isArray(batches)) update.$set.batches = batches;

    const doc = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId, ingredientId },
      update,
      { new: true, upsert: true, runValidators: true },
    ).lean({ virtuals: true });

    return doc;
  },

  // kiểm kê/điều chỉnh: onHand += qty, log movement adjustment (qty signed)
  adjustStock: async (
    _p,
    { restaurantId, warehouseId, ingredientId, qty, reason },
    ctx,
  ) => {
    if (
      ![restaurantId, warehouseId, ingredientId].every(mongoose.isValidObjectId)
    ) {
      throw new GraphQLError("Invalid ids");
    }

    const nQty = Number(qty);
    if (!Number.isFinite(nQty) || nQty === 0) {
      throw new GraphQLError("qty must be a non-zero number");
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await StockItem.findOneAndUpdate(
          { restaurantId, warehouseId, ingredientId },
          { $inc: { onHand: nQty } },
          { new: true, upsert: true, runValidators: true, session },
        );

        await StockMovement.create(
          [
            {
              restaurantId,
              warehouseId,
              ingredientId,
              type: "adjustment",
              qty: nQty,
              reason,
              meta: {},
            },
          ],
          { session },
        );
      });

      return StockItem.findOne({
        restaurantId,
        warehouseId,
        ingredientId,
      }).lean({
        virtuals: true,
      });
    } catch (e) {
      throw new GraphQLError(e?.message || "adjustStock failed");
    } finally {
      session.endSession();
    }
  },

  // transfer: trừ kho nguồn, cộng kho đích, log movement 2 dòng
  transferStock: async (
    _p,
    { restaurantId, fromWarehouseId, toWarehouseId, ingredientId, qty, reason },
    ctx,
  ) => {
    if (
      ![restaurantId, fromWarehouseId, toWarehouseId, ingredientId].every(
        mongoose.isValidObjectId,
      )
    ) {
      throw new GraphQLError("Invalid ids");
    }
    if (String(fromWarehouseId) === String(toWarehouseId)) {
      throw new GraphQLError("Kho nguồn và kho đích phải khác nhau.");
    }

    const nQty = Number(qty);
    if (!Number.isFinite(nQty) || nQty <= 0) {
      throw new GraphQLError("qty must be > 0");
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);

    const warehouseCount = await Warehouse.countDocuments({
      _id: { $in: [fromWarehouseId, toWarehouseId] },
      restaurantId,
      isActive: true,
    });
    if (warehouseCount !== 2) {
      throw new GraphQLError(
        "Kho nguồn và kho đích phải đang hoạt động trong cùng nhà hàng.",
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const src = await StockItem.findOne({
          restaurantId,
          warehouseId: fromWarehouseId,
          ingredientId,
        }).session(session);

        if (!src) {
          throw new GraphQLError("Kho nguồn chưa có nguyên liệu này.");
        }

        const available = Number(src.onHand || 0) - Number(src.reserved || 0);
        if (available < nQty) {
          throw new GraphQLError(
            "Số lượng chuyển vượt quá tồn khả dụng của kho nguồn.",
          );
        }

        src.onHand -= nQty;
        await src.save({ session });

        await StockItem.findOneAndUpdate(
          { restaurantId, warehouseId: toWarehouseId, ingredientId },
          {
            $inc: { onHand: nQty },
            $setOnInsert: { reserved: 0 },
          },
          { new: true, upsert: true, runValidators: true, session },
        );

        await StockMovement.create(
          [
            {
              restaurantId,
              warehouseId: fromWarehouseId,
              ingredientId,
              type: "transfer",
              qty: -nQty,
              reason,
              meta: { toWarehouseId },
            },
            {
              restaurantId,
              warehouseId: toWarehouseId,
              ingredientId,
              type: "transfer",
              qty: nQty,
              reason,
              meta: { fromWarehouseId },
            },
          ],
          { session },
        );
      });

      return true;
    } catch (e) {
      throw new GraphQLError(e?.message || "transferStock failed");
    } finally {
      session.endSession();
    }
  },
};
