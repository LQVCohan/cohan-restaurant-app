import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { AuditLog, Menu, MenuItem } from "../../../models/index.js";
import { getMenuItemInventoryAvailability } from "../../../src/services/menuItemInventoryAvailability.service.js";
import { MENU_PERMISSION, requireMenuPermission } from "./menuPermission.js";

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

const emptyResult = (warnings = []) => ({
  checkedCount: 0,
  updatedCount: 0,
  toOutOfStockCount: 0,
  toAvailableCount: 0,
  items: [],
  warnings,
  changes: [],
});

export const InventorySyncMenuMutation = {
  syncMenuItemInventoryStatuses: async (_, { input }, ctx) => {
    const {
      restaurantId,
      menuId,
      timeSlot,
      menuItemIds,
      recoverOutOfStock = true,
      dryRun = false,
    } = input || {};

    if (!isOid(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    if (menuId && !isOid(menuId)) throw new GraphQLError("Invalid menuId");
    await requireMenuPermission(ctx, restaurantId, MENU_PERMISSION.SYNC_INVENTORY);

    const query = { restaurantId, status: { $in: SYNCABLE_STATUSES } };

    if (Array.isArray(menuItemIds) && menuItemIds.length) {
      const validIds = menuItemIds.filter(isOid);
      if (!validIds.length) return emptyResult();
      query._id = { $in: validIds };
    }

    if (menuId) {
      const menu = await Menu.findOne({ _id: menuId, restaurantId })
        .select({ _id: 1 })
        .lean();
      if (!menu) return emptyResult(["Không tìm thấy thực đơn đã chọn."]);
      query.menuId = menu._id;
    } else if (timeSlot) {
      const menus = await Menu.find({ restaurantId, timeSlot })
        .select({ _id: 1 })
        .lean();
      if (!menus.length) {
        return emptyResult([`Không tìm thấy menu cho khung giờ ${timeSlot}.`]);
      }
      query.menuId = { $in: menus.map((menu) => menu._id) };
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

      if (availability.inventoryStatus === "NOT_TRACKED") continue;

      const nextStatus = buildStatusPatch({
        currentStatus: item.status,
        inventoryStatus: availability.inventoryStatus,
        recoverOutOfStock,
      });

      if (!nextStatus || nextStatus === item.status) continue;
      updates.push({ item, nextStatus, availability });
    }

    const changes = updates.map(({ item, nextStatus, availability }) => ({
      menuItemId: String(item._id),
      menuItemName: item.name || null,
      beforeStatus: item.status,
      afterStatus: nextStatus,
      inventoryStatus: availability.inventoryStatus || "ERROR",
      maxAvailable: Number.isFinite(Number(availability.maxAvailable))
        ? Math.max(0, Math.floor(Number(availability.maxAvailable)))
        : 0,
      stockWarnings: Array.isArray(availability.stockWarnings)
        ? availability.stockWarnings
        : [],
    }));

    const toOutOfStockCount = changes.filter(
      (change) => change.afterStatus === "out_of_stock",
    ).length;
    const toAvailableCount = changes.filter(
      (change) => change.afterStatus === "available",
    ).length;

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
            menuId: item.menuId,
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
    const changedItems =
      !dryRun && changedIds.length
        ? await MenuItem.find({ _id: { $in: changedIds } }).lean({
            virtuals: true,
          })
        : [];

    return {
      checkedCount: items.length,
      updatedCount: updates.length,
      toOutOfStockCount,
      toAvailableCount,
      items: changedItems,
      warnings,
      changes,
    };
  },
};
