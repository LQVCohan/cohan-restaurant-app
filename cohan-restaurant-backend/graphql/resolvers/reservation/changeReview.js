import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { EventLog, Reservation, Restaurant, Table } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  calcReservationEnd,
  confirmReservationSlot,
  holdReservationSlot,
  releaseReservationSlot,
} from "../../../src/services/reservationAvailability.service.js";

const REVIEWABLE_CHANGE_STATUSES = ["pending_change"];
const ACTIVE_RESERVATION_STATUSES = ["pending_payment", "confirmed", "seated", "pending_change"];

function toObjectId(id, field = "ID") {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new GraphQLError(`Invalid ${field}`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new mongoose.Types.ObjectId(id);
}

function parseHHMM(s, fallback = [23, 0]) {
  if (!s || typeof s !== "string") return fallback;
  const [h, m] = s.split(":").map((n) => Number(n));
  if (Number.isFinite(h) && Number.isFinite(m)) return [h, m];
  return fallback;
}

function normalizeDuration({ durationMinutes, isUnlimitedTime }) {
  if (isUnlimitedTime) return 0;
  const d = Number(durationMinutes || 60);
  if (!Number.isFinite(d) || d < 30) {
    throw new GraphQLError("durationMinutes phải >= 30 phút", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return Math.floor(d);
}

function validateOpenClose(restaurant, arrival, durationMinutes, isUnlimitedTime) {
  const [openH, openM] = parseHHMM(restaurant.openingHours, [7, 0]);
  const [closeH, closeM] = parseHHMM(restaurant.closingHours, [23, 0]);

  const open = new Date(arrival);
  open.setHours(openH, openM, 0, 0);
  const close = new Date(arrival);
  close.setHours(closeH, closeM, 0, 0);

  if (arrival < open || arrival > close) {
    throw new GraphQLError("Thời gian đặt ngoài giờ mở cửa của nhà hàng", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (!isUnlimitedTime) {
    const end = calcReservationEnd(arrival, durationMinutes, false);
    if (end > close) {
      throw new GraphQLError("Thời lượng sử dụng vượt quá giờ đóng cửa", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
  }
}

async function ensureNoTableConflict({ tableId, timeTo, durationMinutes, isUnlimitedTime, exceptId = null, session = null }) {
  const start = new Date(timeTo);
  const end = calcReservationEnd(start, durationMinutes, isUnlimitedTime);

  const q = {
    tableId: toObjectId(tableId, "tableId"),
    status: { $in: ACTIVE_RESERVATION_STATUSES },
  };
  if (exceptId) q._id = { $ne: toObjectId(exceptId, "reservationId") };

  const candidates = await Reservation.find(q, null, session ? { session } : undefined)
    .select({ timeTo: 1, durationMinutes: 1, isUnlimitedTime: 1 })
    .lean();

  for (const c of candidates) {
    const cStart = new Date(c.timeTo);
    const cEnd = calcReservationEnd(cStart, Number(c.durationMinutes || 60), !!c.isUnlimitedTime);

    if (isUnlimitedTime || c.isUnlimitedTime) {
      const latestStart = cStart > start ? cStart : start;
      const earliestFiniteEnd = cEnd && end ? (cEnd < end ? cEnd : end) : null;
      if (!earliestFiniteEnd || latestStart < earliestFiniteEnd) {
        throw new GraphQLError("Bàn đã có reservation xung đột thời gian", {
          extensions: { code: "TABLE_TIME_CONFLICT" },
        });
      }
      continue;
    }

    if (cStart < end && start < cEnd) {
      throw new GraphQLError("Bàn đã có reservation xung đột thời gian", {
        extensions: { code: "TABLE_TIME_CONFLICT" },
      });
    }
  }
}

async function getRestaurantOrThrow(restaurantId, session = null) {
  const restaurant = await Restaurant.findById(
    toObjectId(restaurantId, "restaurantId"),
    null,
    session ? { session } : undefined,
  ).lean();
  if (!restaurant) throw new GraphQLError("Restaurant not found", { extensions: { code: "NOT_FOUND" } });
  return restaurant;
}

async function getTableOrThrow(tableId, restaurantId, session = null) {
  const table = await Table.findOne(
    {
      _id: toObjectId(tableId, "tableId"),
      restaurantId: toObjectId(restaurantId, "restaurantId"),
    },
    null,
    session ? { session } : undefined,
  ).lean();
  if (!table) throw new GraphQLError("Table not found in this restaurant", { extensions: { code: "NOT_FOUND" } });
  return table;
}

async function updateTableStatusByReservation(tableId, session = null) {
  const active = await Reservation.exists({
    tableId,
    status: { $in: ["pending_payment", "confirmed", "seated"] },
  }).session?.(session) || await Reservation.exists({
    tableId,
    status: { $in: ["pending_payment", "confirmed", "seated"] },
  });

  const update = Table.updateOne(
    { _id: tableId },
    { $set: { status: active ? "reserved" : "available" } },
  );
  if (session) update.session(session);
  await update;
}

function assertCanReviewReservationChange(reservation) {
  if (!REVIEWABLE_CHANGE_STATUSES.includes(String(reservation.status))) {
    throw new GraphQLError("Reservation is not waiting for change review", {
      extensions: { code: "RESERVATION_CHANGE_NOT_PENDING" },
    });
  }
  if (String(reservation.changeRequestStatus || "") !== "requested") {
    throw new GraphQLError("Reservation change request is not pending", {
      extensions: { code: "RESERVATION_CHANGE_NOT_PENDING" },
    });
  }
  const type = String(reservation.changeRequestType || "none").toLowerCase();
  if (!["time", "table"].includes(type)) {
    throw new GraphQLError("Reservation has no valid change request", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

function appendNote(existing, note) {
  const clean = String(note || "").trim();
  if (!clean) return existing;
  return [existing, clean].filter(Boolean).join("\n");
}

export const ReservationChangeReviewMutation = {
  async approveReservationChange(_, { input }, ctx) {
    const session = await mongoose.startSession();
    try {
      let updated = null;
      await session.withTransaction(async () => {
        const reservation = await Reservation.findById(
          toObjectId(input.reservationId, "reservationId"),
          null,
          { session },
        );
        if (!reservation) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });

        await requireRestaurantPermission(ctx, reservation.restaurantId, PERMISSIONS.RESERVATION_UPDATE);
        assertCanReviewReservationChange(reservation);

        const restaurant = await getRestaurantOrThrow(reservation.restaurantId, session);
        const type = String(reservation.changeRequestType).toLowerCase();
        const oldTableId = reservation.tableId;

        let targetTableId = reservation.tableId;
        let targetTimeTo = new Date(reservation.timeTo);
        let targetDurationMinutes = normalizeDuration({
          durationMinutes: reservation.durationMinutes || 60,
          isUnlimitedTime: !!reservation.isUnlimitedTime,
        });

        if (type === "time") {
          if (!reservation.requestedTimeTo) {
            throw new GraphQLError("requestedTimeTo is missing", { extensions: { code: "BAD_USER_INPUT" } });
          }
          targetTimeTo = new Date(reservation.requestedTimeTo);
          targetDurationMinutes = normalizeDuration({
            durationMinutes: reservation.requestedDurationMinutes || reservation.durationMinutes || 60,
            isUnlimitedTime: !!reservation.isUnlimitedTime,
          });
        }

        if (type === "table") {
          if (!reservation.requestedTableId) {
            throw new GraphQLError("requestedTableId is missing", { extensions: { code: "BAD_USER_INPUT" } });
          }
          targetTableId = reservation.requestedTableId;
        }

        const targetTable = await getTableOrThrow(targetTableId, reservation.restaurantId, session);
        if (["offline", "occupied", "cleaning"].includes(String(targetTable.status || ""))) {
          throw new GraphQLError("Target table is not available", { extensions: { code: "TABLE_UNAVAILABLE" } });
        }
        if (Number(reservation.partySize || 0) > Number(targetTable.capacity || 0)) {
          throw new GraphQLError("Số lượng khách vượt sức chứa của bàn mới", { extensions: { code: "CAPACITY_EXCEEDED" } });
        }

        validateOpenClose(restaurant, targetTimeTo, targetDurationMinutes, !!reservation.isUnlimitedTime);
        await ensureNoTableConflict({
          tableId: targetTableId,
          timeTo: targetTimeTo,
          durationMinutes: targetDurationMinutes,
          isUnlimitedTime: !!reservation.isUnlimitedTime,
          exceptId: reservation._id,
          session,
        });

        const targetEnd =
          calcReservationEnd(targetTimeTo, targetDurationMinutes, !!reservation.isUnlimitedTime) ||
          new Date(targetTimeTo.getTime() + 24 * 60 * 60 * 1000);

        await releaseReservationSlot({ reservationId: reservation._id, reason: "released", session });
        await holdReservationSlot({
          restaurantId: reservation.restaurantId,
          tableId: targetTableId,
          userId: reservation.userId,
          reservationId: reservation._id,
          slotStart: targetTimeTo,
          slotEnd: targetEnd,
          holdMinutes: 60,
          session,
        });
        await confirmReservationSlot({ reservationId: reservation._id, session });

        reservation.tableId = targetTableId;
        reservation.timeTo = targetTimeTo;
        reservation.durationMinutes = targetDurationMinutes;
        reservation.status = "confirmed";
        reservation.changeRequestStatus = "approved";
        reservation.note = appendNote(reservation.note, input.note);
        await reservation.save({ session });

        await Table.updateOne({ _id: targetTableId }, { $set: { status: "reserved" } }, { session });
        if (String(oldTableId) !== String(targetTableId)) {
          await updateTableStatusByReservation(oldTableId, session);
        }

        await EventLog.log(
          {
            restaurantId: reservation.restaurantId,
            actorUserId: ctx?.user?.id,
            verb: "reservation.change.approve",
            object: { kind: "Reservation", id: reservation._id },
            target: { kind: "Table", id: targetTableId },
            source: "manager_app",
            status: "success",
            meta: {
              changeRequestType: type,
              oldTableId: String(oldTableId),
              newTableId: String(targetTableId),
              requestedTimeTo: reservation.requestedTimeTo || null,
              approvedTimeTo: targetTimeTo,
            },
          },
          { session },
        ).catch(() => {});

        updated = reservation;
      });
      return updated;
    } finally {
      await session.endSession();
    }
  },

  async rejectReservationChange(_, { input }, ctx) {
    const session = await mongoose.startSession();
    try {
      let updated = null;
      await session.withTransaction(async () => {
        const reservation = await Reservation.findById(
          toObjectId(input.reservationId, "reservationId"),
          null,
          { session },
        );
        if (!reservation) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });

        await requireRestaurantPermission(ctx, reservation.restaurantId, PERMISSIONS.RESERVATION_UPDATE);
        assertCanReviewReservationChange(reservation);

        reservation.status = "confirmed";
        reservation.changeRequestStatus = "rejected";
        reservation.note = appendNote(
          reservation.note,
          input.reason ? `Từ chối yêu cầu thay đổi: ${input.reason}` : "Từ chối yêu cầu thay đổi đặt bàn.",
        );
        await reservation.save({ session });
        await confirmReservationSlot({ reservationId: reservation._id, session });
        await Table.updateOne({ _id: reservation.tableId }, { $set: { status: "reserved" } }, { session });

        await EventLog.log(
          {
            restaurantId: reservation.restaurantId,
            actorUserId: ctx?.user?.id,
            verb: "reservation.change.reject",
            object: { kind: "Reservation", id: reservation._id },
            target: { kind: "Table", id: reservation.tableId },
            source: "manager_app",
            status: "success",
            meta: {
              changeRequestType: reservation.changeRequestType,
              reason: input.reason || null,
            },
          },
          { session },
        ).catch(() => {});

        updated = reservation;
      });
      return updated;
    } finally {
      await session.endSession();
    }
  },
};

export default ReservationChangeReviewMutation;
