import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Ingredient,
  InventoryCount,
  StockItem,
  StockMovement,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const DOCUMENT_STATUSES = new Set(["pending", "matched", "mismatch", "missing"]);

const hasCountedQty = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

const roundQty = (value, digits = 9) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** digits;
  return Math.round((number + Number.EPSILON) * factor) / factor;
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new GraphQLError(`${fieldName} is invalid`);
  }
  return date;
};

const createCode = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `IC-${datePart}-${Date.now().toString(36).toUpperCase()}`;
};

const ensureObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) throw new GraphQLError(`${fieldName} is invalid`);
};

const getCount = async (id) => {
  ensureObjectId(id, "countId");
  const count = await InventoryCount.findById(id);
  if (!count) throw new GraphQLError("Inventory count not found");
  return count;
};

const buildSnapshotLines = async ({ restaurantId, warehouseId }) => {
  const [ingredients, stockItems] = await Promise.all([
    Ingredient.find({ restaurantId, isActive: { $ne: false }, deletedAt: null })
      .select({ name: 1, sku: 1, baseUnit: 1 })
      .sort({ name: 1 })
      .lean(),
    StockItem.find({ restaurantId, warehouseId, ingredientId: { $exists: true, $ne: null } })
      .select({ ingredientId: 1, onHand: 1 })
      .lean(),
  ]);

  const stockMap = new Map(
    stockItems.map((item) => [String(item.ingredientId), Number(item.onHand) || 0]),
  );

  return ingredients.map((ingredient) => ({
    ingredientId: ingredient._id,
    nameSnapshot: ingredient.name || "",
    skuSnapshot: ingredient.sku || "",
    unit: ingredient.baseUnit || "unit",
    systemQty: roundQty(stockMap.get(String(ingredient._id)) || 0),
    countedQty: null,
    variance: 0,
    note: "",
  }));
};

const getRestaurantIdFromMovement = async (movementId) => {
  ensureObjectId(movementId, "movementId");
  const movement = await StockMovement.findById(movementId);
  if (!movement) throw new GraphQLError("Stock movement not found");
  return movement;
};

export default {
  Query: {
    inventoryCounts: async (_, { restaurantId, warehouseId, status, limit }, ctx) => {
      ensureObjectId(restaurantId, "restaurantId");
      await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_READ);

      const q = { restaurantId };
      if (warehouseId) {
        ensureObjectId(warehouseId, "warehouseId");
        q.warehouseId = warehouseId;
      }
      if (status) q.status = status;

      return InventoryCount.find(q)
        .sort({ createdAt: -1 })
        .limit(Math.min(limit ?? 20, 100))
        .lean({ virtuals: true });
    },

    inventoryCount: async (_, { id }, ctx) => {
      const count = await getCount(id);
      await requireRestaurantPermission(ctx, count.restaurantId, PERMISSIONS.STOCK_READ);
      return count.toObject({ virtuals: true });
    },

    inventoryDocumentMovements: async (
      _,
      { restaurantId, warehouseId, status, dateFrom, dateTo, limit },
      ctx,
    ) => {
      ensureObjectId(restaurantId, "restaurantId");
      await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_READ);

      const q = { restaurantId, ingredientId: { $exists: true, $ne: null } };
      if (warehouseId) {
        ensureObjectId(warehouseId, "warehouseId");
        q.warehouseId = warehouseId;
      }
      if (status) q["meta.documentStatus"] = status;
      if (dateFrom || dateTo) {
        q.createdAt = {};
        if (dateFrom) q.createdAt.$gte = parseDate(dateFrom, "dateFrom");
        if (dateTo) q.createdAt.$lte = parseDate(dateTo, "dateTo");
      }

      return StockMovement.find(q)
        .select({ __v: 0 })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit ?? 100, 500))
        .lean({ virtuals: true });
    },
  },

  Mutation: {
    createInventoryCount: async (_, { input }, ctx) => {
      const { restaurantId, warehouseId, title, periodStart, periodEnd, note } = input || {};
      ensureObjectId(restaurantId, "restaurantId");
      ensureObjectId(warehouseId, "warehouseId");
      await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);

      const start = parseDate(periodStart, "periodStart");
      const end = parseDate(periodEnd, "periodEnd");
      if (start > end) throw new GraphQLError("periodStart must be before periodEnd");

      const lines = await buildSnapshotLines({ restaurantId, warehouseId });
      const count = await InventoryCount.create({
        restaurantId,
        warehouseId,
        code: createCode(),
        title: title?.trim() || "Kiểm kê cuối kỳ",
        periodStart: start,
        periodEnd: end,
        note: note?.trim() || "",
        lines,
      });

      return count.toObject({ virtuals: true });
    },

    updateInventoryCountLine: async (_, { input }, ctx) => {
      const { countId, ingredientId, countedQty, note } = input || {};
      ensureObjectId(ingredientId, "ingredientId");
      const count = await getCount(countId);
      await requireRestaurantPermission(ctx, count.restaurantId, PERMISSIONS.STOCK_WRITE);
      if (count.status !== "draft") throw new GraphQLError("Only draft counts can be edited");

      const qty = Number(countedQty);
      if (!Number.isFinite(qty) || qty < 0) {
        throw new GraphQLError("countedQty must be >= 0");
      }

      const line = count.lines.find((item) => String(item.ingredientId) === String(ingredientId));
      if (!line) throw new GraphQLError("Inventory count line not found");

      line.countedQty = roundQty(qty);
      line.variance = roundQty(line.countedQty - Number(line.systemQty || 0));
      line.note = note?.trim() || "";
      await count.save();
      return count.toObject({ virtuals: true });
    },

    closeInventoryCount: async (_, { input }, ctx) => {
      const count = await getCount(input?.countId);
      await requireRestaurantPermission(ctx, count.restaurantId, PERMISSIONS.STOCK_WRITE);
      if (count.status !== "draft") throw new GraphQLError("Inventory count is already closed");
      if (count.lines.some((line) => !hasCountedQty(line.countedQty))) {
        throw new GraphQLError("All count lines must have countedQty before closing");
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const locked = await InventoryCount.findById(count._id).session(session);
          if (!locked || locked.status !== "draft") {
            throw new GraphQLError("Inventory count is already closed");
          }
          if (locked.lines.some((line) => !hasCountedQty(line.countedQty))) {
            throw new GraphQLError("All count lines must have countedQty before closing");
          }

          for (const line of locked.lines) {
            const countedQty = roundQty(line.countedQty);
            const systemQty = roundQty(line.systemQty);
            const variance = roundQty(countedQty - systemQty);
            line.variance = variance;
            if (variance === 0) continue;

            await StockItem.findOneAndUpdate(
              {
                restaurantId: locked.restaurantId,
                warehouseId: locked.warehouseId,
                ingredientId: line.ingredientId,
              },
              { $inc: { onHand: variance }, $setOnInsert: { reserved: 0 } },
              { new: true, upsert: true, runValidators: true, session },
            );

            await StockMovement.create(
              [
                {
                  restaurantId: locked.restaurantId,
                  warehouseId: locked.warehouseId,
                  ingredientId: line.ingredientId,
                  type: "adjustment",
                  qty: variance,
                  reason: `inventory-count:${locked.code}`,
                  meta: {
                    inventoryCountId: String(locked._id),
                    countCode: locked.code,
                    systemQty,
                    countedQty,
                    variance,
                    note: line.note || input?.note || "",
                    documentStatus: "matched",
                    documentNo: locked.code,
                  },
                },
              ],
              { session },
            );
          }

          locked.status = "closed";
          locked.closedAt = new Date();
          if (input?.note) locked.note = input.note.trim();
          await locked.save({ session });
        });

        return InventoryCount.findById(count._id).lean({ virtuals: true });
      } finally {
        await session.endSession();
      }
    },

    cancelInventoryCount: async (_, { id }, ctx) => {
      const count = await getCount(id);
      await requireRestaurantPermission(ctx, count.restaurantId, PERMISSIONS.STOCK_WRITE);
      if (count.status === "closed") throw new GraphQLError("Closed counts cannot be cancelled");
      count.status = "cancelled";
      await count.save();
      return count.toObject({ virtuals: true });
    },

    reconcileStockMovementDocument: async (_, { input }, ctx) => {
      const movement = await getRestaurantIdFromMovement(input?.movementId);
      await requireRestaurantPermission(ctx, movement.restaurantId, PERMISSIONS.STOCK_WRITE);

      const status = input?.status || "pending";
      if (!DOCUMENT_STATUSES.has(status)) throw new GraphQLError("Invalid document status");

      return StockMovement.findByIdAndUpdate(
        movement._id,
        {
          $set: {
            "meta.documentNo": input?.documentNo?.trim() || "",
            "meta.documentStatus": status,
            "meta.documentNote": input?.note?.trim() || "",
            "meta.documentCheckedAt": new Date(),
          },
        },
        { new: true, runValidators: true },
      ).lean({ virtuals: true });
    },
  },
};
