import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Reservation, Table } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { releaseReservationSlot } from "../../../src/services/reservationAvailability.service.js";
import {
  ACTIVE_RESERVATION_STATUSES,
  hasActiveOrdersForTable,
} from "../../../utils/tableStateGuards.js";

const CUSTOMER_HISTORY_TERMINAL_STATUSES = new Set([
  "cancelled",
  "completed",
  "no_show",
  "expired",
  "rejected",
]);

function toObjectId(id, field = "ID") {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new GraphQLError(`Invalid ${field}`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new mongoose.Types.ObjectId(id);
}

function userIdFromContext(ctx) {
  return ctx?.auth?.user?.id || ctx?.user?.id || ctx?.user?._id || null;
}

function isStaffLike(ctx) {
  const role = String(ctx?.user?.roleName || ctx?.user?.role || "").toLowerCase();
  return role.includes("staff") || role.includes("manager") || role.includes("admin");
}

function assertAuth(ctx) {
  const userId = userIdFromContext(ctx);
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return String(userId);
}

function isOwner(ctx, reservation) {
  const userId = userIdFromContext(ctx);
  return Boolean(userId && reservation?.userId && String(reservation.userId) === String(userId));
}

async function updateTableStatusByReservation(tableId, restaurantId) {
  const [hasActiveReservation, hasActiveOrder] = await Promise.all([
    Reservation.exists({
      restaurantId,
      tableId,
      status: { $in: ACTIVE_RESERVATION_STATUSES },
    }),
    hasActiveOrdersForTable({ restaurantId, tableId }),
  ]);

  if (hasActiveReservation) {
    await Table.updateOne({ _id: tableId }, { $set: { status: "reserved" } });
    return;
  }

  if (hasActiveOrder) return;

  await Table.updateOne(
    { _id: tableId, status: { $in: ["reserved", "payment_pending"] } },
    { $set: { status: "available" } },
  );
}

export const ReservationCustomerHistoryQuery = {
  async myReservations(_, { limit = 20, cursor }, ctx) {
    const userId = assertAuth(ctx);

    const filter = {
      userId: toObjectId(userId, "userId"),
      hiddenFromCustomerUserIds: { $ne: toObjectId(userId, "userId") },
    };
    if (cursor && mongoose.isValidObjectId(cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    return Reservation.find(filter)
      .sort({ _id: -1 })
      .limit(Math.max(1, Math.min(Number(limit || 20), 100)))
      .lean({ virtuals: true });
  },
};

export const ReservationCustomerHistoryMutation = {
  async deleteReservation(_, { id }, ctx) {
    assertAuth(ctx);
    const current = await Reservation.findById(toObjectId(id, "reservationId"));
    if (!current) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });

    if (isOwner(ctx, current)) {
      const status = String(current.status || "").toLowerCase();
      if (!CUSTOMER_HISTORY_TERMINAL_STATUSES.has(status)) {
        throw new GraphQLError("Chỉ có thể xóa khỏi lịch sử khi đặt bàn đã kết thúc hoặc đã hủy.", {
          extensions: { code: "RESERVATION_HISTORY_NOT_DELETABLE" },
        });
      }

      const uid = toObjectId(userIdFromContext(ctx), "userId");
      await Reservation.updateOne(
        { _id: current._id },
        { $addToSet: { hiddenFromCustomerUserIds: uid } },
      );
      const updated = await Reservation.findById(current._id).lean({ virtuals: true });
      return updated || current;
    }

    if (!isStaffLike(ctx)) {
      throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
    }

    await requireRestaurantPermission(ctx, current.restaurantId, PERMISSIONS.RESERVATION_UPDATE);
    current.status = "no_show";
    await current.save();
    await releaseReservationSlot({ reservationId: current._id, reason: "no_show" });
    await updateTableStatusByReservation(current.tableId, current.restaurantId);
    return current;
  },
};
