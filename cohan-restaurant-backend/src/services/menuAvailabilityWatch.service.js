import mongoose from "mongoose";
import { MenuAvailabilityWatch, MenuItem, User, Warehouse } from "../../models/index.js";
import { checkAvailabilityForLinesTx } from "./inventory.service.js";
import { createNotificationOnce } from "./notification/notificationWorkflow.service.js";
import {
  normalizeAvailabilityEmail,
  sendAvailabilityEmail,
} from "./availabilityEmail.service.js";

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

function buildFoodDetailUrl(menuItemId, restaurantId) {
  return `/food/${encodeURIComponent(String(menuItemId))}?restaurantId=${encodeURIComponent(String(restaurantId))}`;
}

async function resolveContactEmail(input, ctx, userId) {
  const requestedEmail = normalizeAvailabilityEmail(input?.contactEmail);
  if (input?.contactEmail && !requestedEmail) {
    throw new Error("Email nhận thông báo không hợp lệ.");
  }
  if (requestedEmail) return requestedEmail;

  const contextEmail = normalizeAvailabilityEmail(ctx?.user?.email);
  if (contextEmail) return contextEmail;
  if (!userId) return null;

  const user = await User.findById(userId).select({ email: 1 }).lean();
  return normalizeAvailabilityEmail(user?.email);
}

async function resolveWatchEmail(watch) {
  const storedEmail = normalizeAvailabilityEmail(watch?.contactEmail);
  if (storedEmail) return storedEmail;
  if (!watch?.userId) return null;
  const user = await User.findById(watch.userId).select({ email: 1 }).lean();
  return normalizeAvailabilityEmail(user?.email);
}

export function buildMenuAvailabilityNotificationPayload({
  watch,
  menuItem,
  restaurantId,
  menuItemId,
  servingKey,
}) {
  const itemName = String(menuItem?.name || "Món bạn quan tâm").trim();
  const message = `${itemName} hiện đã có thể đặt lại. Hệ thống không tự giữ món, vui lòng đặt lại nếu bạn vẫn muốn dùng.`;

  return {
    title: "Món đã có lại",
    messagePreview: `${itemName} hiện đã có thể đặt lại.`,
    message,
    restaurantId: String(restaurantId),
    menuItemId: String(menuItemId),
    servingVariantKey: normalizeServingKey(servingKey),
    desiredQuantity: Number(watch?.desiredQuantity || 1),
    watchId: String(watch?._id || watch?.id || ""),
    imageUrl: menuItem?.thumbImage || null,
    actionUrl: buildFoodDetailUrl(menuItemId, restaurantId),
  };
}

async function persistAvailabilityNotification({ io, watch, menuItem, restaurantId, menuItemId, servingKey }) {
  if (!watch?.userId) return null;

  return createNotificationOnce({
    toUserId: watch.userId,
    toRole: "CUSTOMER",
    restaurantId,
    type: "menu_availability",
    payload: buildMenuAvailabilityNotificationPayload({
      watch,
      menuItem,
      restaurantId,
      menuItemId,
      servingKey,
    }),
    sourceType: "menu_availability_watch",
    sourceId: watch._id,
    io,
  });
}

async function resolveDefaultWarehouseId(restaurantId, session = null) {
  let q = Warehouse.findOne({ restaurantId, isActive: true }).sort({
    createdAt: 1,
    _id: 1,
  });
  if (session) q = q.session(session);
  const warehouse = await q.lean();
  return warehouse?._id || null;
}

async function isMenuItemActuallyAvailable({
  restaurantId,
  menuItemId,
  servingKey,
  quantity = 1,
  session = null,
}) {
  const rid = toId(restaurantId);
  const mid = toId(menuItemId);
  if (!rid || !mid) return false;

  const warehouseId = await resolveDefaultWarehouseId(rid, session);
  if (!warehouseId) return false;

  try {
    const availability = await checkAvailabilityForLinesTx({
      restaurantId: rid,
      warehouseId,
      lines: [
        {
          menuItemId: mid,
          quantity: Math.max(1, Number(quantity || 1)),
          servingKey: normalizeServingKey(servingKey),
        },
      ],
      session,
    });
    return Boolean(availability?.isAvailable);
  } catch (error) {
    console.warn(
      "[MenuAvailabilityWatch] Availability check failed",
      error?.message || error,
    );
    return false;
  }
}

export async function registerMenuAvailabilityWatch(input = {}, ctx = {}) {
  const restaurantId = toId(input.restaurantId);
  const menuItemId = toId(input.menuItemId);
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!menuItemId) throw new Error("menuItemId is required");

  const contextUserId = toId(ctx?.user?.id || ctx?.user?._id);
  const requestedUserId = toId(input.userId);
  if (input.userId && !requestedUserId) throw new Error("userId is invalid");
  if (
    requestedUserId &&
    (!contextUserId || String(requestedUserId) !== String(contextUserId))
  ) {
    throw new Error("Không thể đăng ký nhắc món cho tài khoản khác.");
  }

  const userId = contextUserId;
  const contactEmail = await resolveContactEmail(input, ctx, userId);
  if (!contactEmail) {
    throw new Error("Vui lòng đăng nhập bằng tài khoản có email hoặc nhập email nhận thông báo.");
  }

  const tableId = toId(input.tableId);
  const tableCode = normalizeTableCode(input.tableCode);
  const servingKey = normalizeServingKey(input.servingKey);
  const desiredQuantity = Math.max(1, Number(input.desiredQuantity || 1));
  const availableNow = await isMenuItemActuallyAvailable({
    restaurantId,
    menuItemId,
    servingKey,
    quantity: desiredQuantity,
  });

  if (availableNow) {
    await MenuItem.updateOne(
      { _id: menuItemId, restaurantId, status: "out_of_stock" },
      { $set: { status: "available" } },
    );
    return {
      watch: null,
      alreadyAvailable: true,
      message: "Món hiện đã có thể đặt lại.",
    };
  }

  const now = new Date();
  const source = ["online", "dine_in", "pos", "staff_remote", "other"].includes(String(input.source || ""))
    ? String(input.source)
    : "other";
  const identity = userId ? { userId } : { contactEmail };

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
        desiredQuantity,
        contactEmail,
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

  return {
    watch,
    alreadyAvailable: false,
    message: `Đã đăng ký. Cohan sẽ gửi email đến ${contactEmail} khi món có lại.`,
  };
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
  if (!rid || !mid) return { notified: 0, skipped: 0 };

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

  if (!watchers.length) return { notified: 0, skipped: 0 };

  const menuItem = await MenuItem.findOne({ _id: mid, restaurantId: rid })
    .select({ name: 1, thumbImage: 1 })
    .lean();

  let notified = 0;
  let skipped = 0;
  for (const watch of watchers) {
    const available = await isMenuItemActuallyAvailable({
      restaurantId: rid,
      menuItemId: mid,
      servingKey: normalizedServingKey,
      quantity: watch.desiredQuantity || 1,
    });

    if (!available) {
      skipped += 1;
      continue;
    }

    const updated = await MenuAvailabilityWatch.findOneAndUpdate(
      { _id: watch._id, status: "watching" },
      { $set: { status: "notified", notifiedAt: now } },
      { new: true },
    ).lean({ virtuals: true });
    if (!updated) {
      skipped += 1;
      continue;
    }

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
    const notificationPayload = buildMenuAvailabilityNotificationPayload({
      watch: updated,
      menuItem,
      restaurantId: rid,
      menuItemId: mid,
      servingKey: normalizedServingKey,
    });

    try {
      const contactEmail = await resolveWatchEmail(updated);
      const emailResult = await sendAvailabilityEmail({
        to: contactEmail,
        subject: `${menuItem?.name || "Món bạn quan tâm"} đã có lại tại Cohan`,
        title: "Món bạn quan tâm đã có lại",
        message: notificationPayload.message,
        actionLabel: "Đặt món ngay",
        actionPath: notificationPayload.actionUrl,
      });
      if (!emailResult.delivered) {
        throw new Error(emailResult.error || "EMAIL_NOT_DELIVERED");
      }
    } catch (error) {
      await MenuAvailabilityWatch.updateOne(
        { _id: updated._id, status: "notified" },
        { $set: { status: "watching", notifiedAt: null } },
      );
      console.warn(
        "[MenuAvailabilityWatch] Email delivery failed",
        error?.message || error,
      );
      skipped += 1;
      continue;
    }

    try {
      await persistAvailabilityNotification({
        io,
        watch: updated,
        menuItem,
        restaurantId: rid,
        menuItemId: mid,
        servingKey: normalizedServingKey,
      });
    } catch (error) {
      console.warn(
        "[MenuAvailabilityWatch] In-app notification failed",
        error?.message || error,
      );
    }

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
      skipped,
    });
  }

  return { notified, skipped };
}

export async function expireOldMenuAvailabilityWatches() {
  const result = await MenuAvailabilityWatch.updateMany(
    { status: "watching", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } },
  );
  return { modifiedCount: result.modifiedCount || 0 };
}
