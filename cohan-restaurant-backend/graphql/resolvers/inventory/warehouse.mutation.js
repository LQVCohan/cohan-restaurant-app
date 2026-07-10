// src/graphql/resolvers/inventory/warehouse.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Warehouse, StockItem } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

function normalizeDupKeyError(err) {
  if (err?.code === 11000) {
    return new GraphQLError("Tên kho đã tồn tại trong nhà hàng này.");
  }
  return err;
}

function normalizeWarehouseFields(input = {}) {
  const next = { ...input };
  if (Object.prototype.hasOwnProperty.call(next, "name")) {
    next.name = String(next.name || "").trim();
    if (!next.name) throw new GraphQLError("Tên kho là bắt buộc.");
  }
  if (Object.prototype.hasOwnProperty.call(next, "code")) {
    next.code = String(next.code || "").trim().toUpperCase() || null;
  }
  if (Object.prototype.hasOwnProperty.call(next, "address")) {
    next.address = String(next.address || "").trim() || null;
  }
  return next;
}

async function assertWarehouseCanBeRemoved(existing) {
  const stockRows = await StockItem.countDocuments({ warehouseId: existing._id });
  if (stockRows > 0) {
    throw new GraphQLError(
      "Không thể xóa hoặc ngừng kho đang có tồn. Hãy chuyển hoặc xử lý hết hàng trước.",
    );
  }

  const activeWarehouses = await Warehouse.countDocuments({
    restaurantId: existing.restaurantId,
    isActive: true,
  });
  if (existing.isActive !== false && activeWarehouses <= 1) {
    throw new GraphQLError("Nhà hàng phải còn ít nhất một kho đang hoạt động.");
  }
}

export default {
  createWarehouse: async (_p, { input }, ctx) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    await requireRestaurantPermission(ctx, input.restaurantId, PERMISSIONS.INVENTORY_WRITE);

    try {
      const created = await Warehouse.create(normalizeWarehouseFields(input));
      return created.toObject({ virtuals: true });
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "createWarehouse failed");
    }
  },

  updateWarehouse: async (_p, { input }, ctx) => {
    const { id, ...rawPatch } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    const existing = await Warehouse.findById(id).lean();
    if (!existing) throw new GraphQLError("Warehouse not found");

    await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.INVENTORY_WRITE);
    delete rawPatch.restaurantId;
    const patch = normalizeWarehouseFields(rawPatch);

    if (patch.isActive === false && existing.isActive !== false) {
      await assertWarehouseCanBeRemoved(existing);
    }

    try {
      const doc = await Warehouse.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true });

      if (!doc) throw new GraphQLError("Warehouse not found");
      return doc;
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "updateWarehouse failed");
    }
  },

  deleteWarehouse: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;

    const existing = await Warehouse.findById(id).lean();
    if (!existing) return false;

    await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.INVENTORY_WRITE);
    await assertWarehouseCanBeRemoved(existing);

    const res = await Warehouse.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
