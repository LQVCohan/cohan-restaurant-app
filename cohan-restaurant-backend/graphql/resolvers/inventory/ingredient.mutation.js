import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Ingredient, Order } from "../../../models/index.js";

function normalizeDupKeyError(err) {
  // Mongo duplicate key
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    const fieldText = fields.length ? fields.join(", ") : "unique field";
    return new GraphQLError(`Duplicate ${fieldText}`);
  }
  return err;
}

const ACTIVE_ORDER_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "customer_attached",
  "preparing",
  "ready",
  "served",
];

export default {
  createIngredient: async (_p, { input }) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    try {
      const created = await Ingredient.create(input);
      return created.toObject({ virtuals: true });
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "Create ingredient failed");
    }
  },

  updateIngredient: async (_p, { input }) => {
    const { id, ...patch } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    try {
      // 1) Load ingredient để lấy restaurantId (scope check đúng nhà hàng)
      const ing = await Ingredient.findById(id)
        .select({ _id: 1, restaurantId: 1, name: 1 })
        .lean();

      if (!ing) throw new GraphQLError("Ingredient not found");

      // 2) Check ingredient đang được dùng trong order nào không (active orders)
      const usedOrder = await Order.findOne({
        restaurantId: ing.restaurantId,
        currentStatus: { $in: ACTIVE_ORDER_STATUSES },
        "items.ingredientsSnapshot.ingredientId": ing._id,
      })
        .select({ orderCode: 1, tableCode: 1, currentStatus: 1 })
        .lean();

      if (usedOrder) {
        const code = usedOrder.orderCode || "unknown";
        const table = usedOrder.tableCode
          ? ` (bàn ${usedOrder.tableCode})`
          : "";
        throw new GraphQLError(
          `Không thể cập nhật nguyên liệu "${ing.name}" vì đang được sử dụng trong đơn ${code}${table} (status: ${usedOrder.currentStatus}).`
        );
      }

      // 3) Update nếu không bị dùng
      const doc = await Ingredient.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true }
      ).lean({ virtuals: true });

      if (!doc) throw new GraphQLError("Ingredient not found");
      return doc;
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "Update ingredient failed");
    }
  },

  deleteIngredient: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const res = await Ingredient.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
