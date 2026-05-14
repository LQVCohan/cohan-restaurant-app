import mongoose from "mongoose";
import { MenuAvailabilityWatch, MenuItem } from "../../models/index.js";

const DEFAULT_WATCH_TTL_MS = 24 * 60 * 60 * 1000;

function toId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export function normalizeServingKey(value) {
  const key = String(value || "").trim();
  return key || "portion";
}

function normalizeTableCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return code || null;
}

function emitInventoryEvent(io, restaurantId, payload) {
  if (!io || !restaurantId || !payload) return;
  io.to(`restaurant_${restaurantId}`).emit("inventoryEvents", payload);
}

function emitAvailabilityNotification(io, watch, payload) {
  if (!io || !watch || !payload) return;
  if (watch.userId) {
    io.to(`user_${watch.userId}`).emit("menuAvailabilityNotifications", payload);
  }
  io.to(`restaurant_${watch.restaurantId}`).emit("menuAvailabilityNotifications", {
    ...payload,
    target: {
      userId: watch.userId ? String(watch.userId) : null,
      tableId: watch.tableId ? String(watch.tableId) : null,
      tableCode: watch.tableCode || null,
    },
  });
}

function resolveExpiresAt(value) {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime()) && parsed > new Date()) return parsed;
  return new Date(Date.now() + DEFAULT_WATCH_TTL_MS);
}

export async function registerMenuAvailabilityWatch(input = {}, ctx = {}) {
  const restaurantId = toId(input.restaurantId);
  const menuItemId = toId(input.menuItemId);
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!menuItemId) throw new Error("menuItemId is required");

  const userId = toId(input.userId || ctx?.user?.id || ctx?.user?._id);
  const tableId = toId(input.tableId);
  const tableCode = normalizeTableCode(input.tableCode);
  if (!userId && !tableId && !tableCode) {
    throw new Error("Cần userId hoặc tableId/tableCode để gửi nhắc khi món có lại.");
  }

  const servingKey = normalizeServingKey(input.servingKey);
  const now = new Date();
  const source = ["online", "dine_in", "pos", "staff_remote", "other"].includes(String(input.source || ""))
    ? String(input.source)
    : "other";
  const identity = userId ? { userId } : tableId ? { tableId } : { tableCode };

  const watch = await MenuAvailabilityWatch.findOneAndUpdate(
    {
      restaurantId,
      menuItemId,
      servingKey,
      status: "watching",
      expiresAt: { $gt: now },
      ...identity,
    },
    {
      $set: {
        desiredQuantity: Math.max(1, Number(input.desiredQuantity || 1)),
        source,
        reason: String(input.reason || "out_of_stock"),
        note: String(input.note || ""),
        lastOutOfStockAt: now,
        expiresAt: resolveExpiresAt(input.expiresAt),
        clientMeta: input.clientMeta || null,
        ...(userId ? { userId } : {}),
        ...(tableId ? { tableId } : {}),
        ...(tableCode ? { tableCode } : {}),
      },
      $setOnInsert: {
        restaurantId,
        menuItemId,
        servingKey,
        status: "watching",
        notifiedAt: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean({ virtuals: true });

  emitInventoryEvent(ctx?.io, restaurantId, {
    type: "MENU_AVAILABILITY_WATCH_REGISTERED",
    restaurantId: String(restaurantId),
    menuItemId: String(menuItemId),
    servingVariantKey: servingKey,
    userId: userId ? String(userId) : null,
    tableId: tableId ? String(tableId) : null,
    tableCode,
    source,
  });

  return { watch, alreadyAvailable: false, message: "Đã đăng ký nhắc khi món có lại." };
}

export async function cancelMenuAvailabilityWatch(input = {}, ctx = {}) {
  const watchId = toId(input.watchId);
  if (!watchId) throw new Error("watchId is required");

  const userId = toId(ctx?.user?.id || ctx?.user?._id);
  const filter = { _id: watchId, status: "watching" };
  if (userId) filter.userId = userId;

  const watch = await MenuAvailabilityWatch.findOneAndUpdate(
    filter,
    { $set: { status: "cancelled" } },
    { new: true },
  ).lean({ virtuals: true });

  return { ok: Boolean(watch), watch };
}

export async function publishMenuItemOutOfStock({ io, restaurantId, menuItemId, servingKey, reason = "out_of_stock", source = "inventory" }) {
  const rid = toId(restaurantId);
  const mid = toId(menuItemId);
  if (!rid || !mid) return null;

  await MenuItem.updateOne(
    { _id: mid, restaurantId: rid, status: { $ne: "hidden" } },
    { $set: { status: "out_of_stock" } },
  );

  const payload = {
    type: "MENU_ITEM_OUT_OF_STOCK",
    restaurantId: String(rid),
    menuItemId: String(mid),
    servingVariantKey: normalizeServingKey(servingKey),
    reason,
    source,
  };
  emitInventoryEvent(io, rid, payload);
  return payload;
}

export async function notifyAvailabilityWatchersForMenuItem({ io, restaurantId, menuItemId, servingKey, source = "inventory_released", maxWatchers = 50 }) {
  const rid = toId(restaurantId);
  const mid = toId(menuItemId);
  if (!rid || !mid) return { notified: 0 };

  const now = new Date();
  const normalizedServingKey = normalizeServingKey(servingKey);
  const watchers = await MenuAvailabilityWatch.find({
    restaurantId: rid,
    menuItemId: mid,
    servingKey: normalizedServingKey,
    status: "watching",
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(Math.max(1, Number(maxWatchers || 50)))
    .lean({ virtuals: true });

  let notified = 0;
  for (const watch of watchers) {
    const updated = await MenuAvailabilityWatch.findOneAndUpdate(
      { _id: watch._id, status: "watching" },
      { $set: { status: "notified", notifiedAt: now } },
      { new: true },
    ).lean({ virtuals: true });
    if (!updated) continue;

    const payload = {
      type: "MENU_ITEM_AVAILABLE_AGAIN",
      restaurantId: String(rid),
      menuItemId: String(mid),
      servingVariantKey: normalizedServingKey,
      desiredQuantity: Number(watch.desiredQuantity || 1),
      watchId: String(watch._id),
      source,
      message: "Món bạn quan tâm hiện đã có thể đặt lại. Hệ thống không tự giữ món, vui lòng đặt lại nếu vẫn muốn dùng.",
    };
    emitAvailabilityNotification(io, updated, payload);
    notified += 1;
  }

  if (notified > 0) {
    await MenuItem.updateOne(
      { _id: mid, restaurantId: rid, status: "out_of_stock" },
      { $set: { status: "available" } },
    );
    emitInventoryEvent(io, rid, {
      type: "MENU_ITEM_AVAILABLE_AGAIN",
      restaurantId: String(rid),
      menuItemId: String(mid),
      servingVariantKey: normalizedServingKey,
      source,
      notified,
    });
  }

  return { notified };
}

export async function expireOldMenuAvailabilityWatches() {
  const result = await MenuAvailabilityWatch.updateMany(
    { status: "watching", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } },
  );
  return { modifiedCount: result.modifiedCount || 0 };
}
