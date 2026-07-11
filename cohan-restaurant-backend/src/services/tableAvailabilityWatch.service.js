import mongoose from "mongoose";
import { Table, User } from "../../models/index.js";
import TableAvailabilityWatch from "../../models/table-availability-watch.model.js";
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

function resolveExpiresAt(value) {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime()) && parsed > new Date()) return parsed;
  return new Date(Date.now() + DEFAULT_WATCH_TTL_MS);
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

function buildTableNotificationPayload(watch) {
  const tableCode = String(watch?.tableCode || "").trim() || "bạn quan tâm";
  return {
    title: "Bàn đã trống",
    messagePreview: `Bàn ${tableCode} hiện đã sẵn sàng.`,
    message: `Bàn ${tableCode} hiện đã trống. Hệ thống không tự giữ bàn, vui lòng đặt ngay nếu bạn vẫn muốn chọn bàn này.`,
    restaurantId: String(watch.restaurantId),
    tableId: String(watch.tableId),
    tableCode,
    watchId: String(watch._id || watch.id || ""),
    actionUrl: `/restaurant/${encodeURIComponent(String(watch.restaurantId))}/layout`,
  };
}

export async function registerTableAvailabilityWatch(input = {}, ctx = {}) {
  const restaurantId = toId(input.restaurantId);
  const tableId = toId(input.tableId);
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!tableId) throw new Error("tableId is required");

  const userId = toId(ctx?.user?.id || ctx?.user?._id);
  const contactEmail = await resolveContactEmail(input, ctx, userId);
  if (!contactEmail) {
    throw new Error("Vui lòng nhập email để nhận thông báo khi bàn trống.");
  }

  const table = await Table.findOne({ _id: tableId, restaurantId })
    .select({ code: 1, status: 1 })
    .lean();
  if (!table) throw new Error("Không tìm thấy bàn trong nhà hàng này.");

  if (String(table.status) === "available") {
    return {
      watch: null,
      alreadyAvailable: true,
      message: `Bàn ${table.code} hiện đã trống, bạn có thể đặt ngay.`,
    };
  }

  const now = new Date();
  const identity = userId ? { userId } : { contactEmail };
  const watch = await TableAvailabilityWatch.findOneAndUpdate(
    {
      restaurantId,
      tableId,
      status: "watching",
      expiresAt: { $gt: now },
      ...identity,
    },
    {
      $set: {
        tableCode: table.code,
        contactEmail,
        expiresAt: resolveExpiresAt(input.expiresAt),
        ...(userId ? { userId } : {}),
      },
      $setOnInsert: {
        restaurantId,
        tableId,
        status: "watching",
        notifiedAt: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean({ virtuals: true });

  return {
    watch,
    alreadyAvailable: false,
    message: `Đã đăng ký. Cohan sẽ gửi email đến ${contactEmail} khi bàn ${table.code} trống.`,
  };
}

export async function notifyAvailableTableWatchers({ io = null, maxWatchers = 100 } = {}) {
  const now = new Date();
  const watches = await TableAvailabilityWatch.find({
    status: "watching",
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(Math.max(1, Number(maxWatchers || 100)))
    .lean({ virtuals: true });

  if (!watches.length) return { notified: 0, skipped: 0 };

  const availableTables = await Table.find({
    _id: { $in: watches.map((watch) => watch.tableId) },
    status: "available",
  })
    .select({ _id: 1 })
    .lean();
  const availableIds = new Set(availableTables.map((table) => String(table._id)));

  let notified = 0;
  let skipped = 0;
  for (const watch of watches) {
    if (!availableIds.has(String(watch.tableId))) continue;

    const claimed = await TableAvailabilityWatch.findOneAndUpdate(
      { _id: watch._id, status: "watching" },
      { $set: { status: "notified", notifiedAt: now } },
      { new: true },
    ).lean({ virtuals: true });
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const payload = buildTableNotificationPayload(claimed);
    try {
      const emailResult = await sendAvailabilityEmail({
        to: claimed.contactEmail,
        subject: `Bàn ${claimed.tableCode} tại Cohan đã trống`,
        title: "Bàn bạn quan tâm đã trống",
        message: payload.message,
        actionLabel: "Đặt bàn ngay",
        actionPath: payload.actionUrl,
      });
      if (!emailResult.delivered) {
        throw new Error(emailResult.error || "EMAIL_NOT_DELIVERED");
      }
    } catch (error) {
      await TableAvailabilityWatch.updateOne(
        { _id: claimed._id, status: "notified" },
        { $set: { status: "watching", notifiedAt: null } },
      );
      console.warn("[TableAvailabilityWatch] Email delivery failed", error?.message || error);
      skipped += 1;
      continue;
    }

    if (claimed.userId) {
      try {
        await createNotificationOnce({
          toUserId: claimed.userId,
          toRole: "CUSTOMER",
          restaurantId: claimed.restaurantId,
          type: "table_availability",
          payload,
          sourceType: "table_availability_watch",
          sourceId: claimed._id,
          io,
        });
      } catch (error) {
        console.warn("[TableAvailabilityWatch] In-app notification failed", error?.message || error);
      }
      io?.to(`user_${claimed.userId}`).emit("tableAvailabilityNotifications", {
        type: "TABLE_AVAILABLE_AGAIN",
        ...payload,
      });
    }

    notified += 1;
  }

  return { notified, skipped };
}
