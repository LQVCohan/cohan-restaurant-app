import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { AuditLog, Menu, MenuItem } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import { getMenuItemInventoryAvailability } from "../../../src/services/menuItemInventoryAvailability.service.js";

const SYNCABLE_STATUSES = ["available", "out_of_stock"];

const isOid = (value) => mongoose.isValidObjectId(value);

function getActorId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

function buildStatusPatch({ currentStatus, inventoryStatus, recoverOutOfStock }) {
  if (currentStatus === "available" && inventoryStatus === "OUT_OF_STOCK") {
    return "out_of_stock";
  }

  if (
    recoverOutOfStock &&
    currentStatus === "out_of_stock" &&
    ["IN_STOCK", "LOW_STOCK"].includes(inventoryStatus)
  ) {
    return "available";
  }

  return null;
}

export const InventorySyncMenuMutation = {
  syncMenuItemInventoryStatuses: async (_, { input }, ctx) => {
    const {
      restaurantId,
      timeSlot,
      menuItemIds,
      recoverOutOfStock = true,
      dryRun = false,
    } = input || {};

    if (!isOid(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    await requireRestaurantAccess(ctx, restaurantId);

    const query = { restaurantId, status: { $in: SYNCABLE_STATUSES } };

    if (Array.isArray(menuItemIds) && menuItemIds.length) {
      const validIds = menuItemIds.filter(isOid);
      if (!validIds.length) {
        return { checkedCount: 0, updatedCount: 0, items: [], warnings: [] };
      }
      query._id = { $in: validIds };
    }

    if (timeSlot) {
      const menu = await Menu.findOne({ restaurantId, timeSlot }).select({ _id: 1 }).lean();
      if (!menu) {
        return {
          checkedCount: 0,
          updatedCount: 0,
          items: [],
          warnings: [`Không tìm thấy menu cho khung giờ ${timeSlot}.`],
        };
      }
      query.menuId = menu._id;
    }

    const items = await MenuItem.find(query)
      .select({ _id: 1, restaurantId: 1, menuId: 1, name: 1, status: 1 })
      .lean();

    const warnings = [];
    const updates = [];

    for (const item of items) {
      const availability = await getMenuItemInventoryAvailability({
        restaurantId,
        menuItemId: item._id,
      });

      if (availability.inventoryStatus === "ERROR") {
        warnings.push(
          `${item.name || item._id}: ${availability.stockWarnings?.[0] || "Không thể kiểm tra tồn kho."}`,
        );
        continue;
      }

      if (availability.inventoryStatus === "NOT_TRACKED") {
        continue;
      }

      const nextStatus = buildStatusPatch({
        currentStatus: item.status,
        inventoryStatus: availability.inventoryStatus,
        recoverOutOfStock,
      });

      if (!nextStatus || nextStatus === item.status) continue;

      updates.push({
        item,
        nextStatus,
        availability,
      });
    }

    if (!dryRun && updates.length) {
      await MenuItem.bulkWrite(
        updates.map(({ item, nextStatus }) => ({
          updateOne: {
            filter: { _id: item._id, restaurantId },
            update: { $set: { status: nextStatus } },
          },
        })),
        { ordered: false },
      );

      await AuditLog.insertMany(
        updates.map(({ item, nextStatus, availability }) => ({
          restaurantId,
          entity: "MenuItem",
          entityId: item._id,
          action: "update",
          byUserId: getActorId(ctx),
          diff: {
            type: "sync_inventory_status",
            before: { status: item.status },
            after: { status: nextStatus },
            inventoryStatus: availability.inventoryStatus,
            maxAvailable: availability.maxAvailable,
            stockWarnings: availability.stockWarnings || [],
          },
        })),
      );
    }

    const changedIds = updates.map(({ item }) => item._id);
    const changedItems = changedIds.length
      ? await MenuItem.find({ _id: { $in: changedIds } }).lean({ virtuals: true })
      : [];

    return {
      checkedCount: items.length,
      updatedCount: updates.length,
      items: changedItems,
      warnings,
    };
  },
};
