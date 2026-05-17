import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { EventLog, Order, Reservation, Table } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import generateOrderCode from "../../../utils/generateOrderCode.js";
import {
  ACTIVE_SESSION_STATUSES,
  KITCHEN_STATUS,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  SPLIT_STATUS,
  activeTableSessionLookupFilter,
  buildActiveTableSessionKey,
} from "../../../utils/orderLifecycle.js";
import { confirmReservationSlot } from "../../../src/services/reservationAvailability.service.js";

function toObjectId(id, field = "ID") {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new GraphQLError(`Invalid ${field}`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new mongoose.Types.ObjectId(id);
}

function normalizeTableCode(value) {
  return String(value || "").trim().toUpperCase();
}

function appendNote(existing, note) {
  const clean = String(note || "").trim();
  if (!clean) return existing;
  return [existing, clean].filter(Boolean).join("\n");
}

async function createUniqueOrderCode(prefix, date, tableCode, session) {
  for (let i = 0; i < 8; i += 1) {
    const code = generateOrderCode(prefix, date, tableCode);
    const query = Order.exists({ orderCode: code });
    if (session) query.session(session);
    const exists = await query;
    if (!exists) return code;
  }
  throw new Error("Không thể tạo mã phiên bàn duy nhất.");
}

async function findActiveTableSession({ restaurantId, tableId, tableCode, session }) {
  const filter = activeTableSessionLookupFilter({
    restaurantId,
    tableId,
    tableCode,
  });
  const query = Order.findOne(filter).sort({ openedAt: -1, createdAt: -1, _id: -1 });
  if (session) query.session(session);
  return query;
}

function assertCheckInAllowed(reservation) {
  const status = String(reservation.status || "");
  if (!["confirmed", "seated"].includes(status)) {
    throw new GraphQLError("Chỉ có reservation đã xác nhận mới được check-in.", {
      extensions: { code: "RESERVATION_NOT_CONFIRMED" },
    });
  }
  if (String(reservation.changeRequestStatus || "none") === "requested") {
    throw new GraphQLError("Reservation đang chờ duyệt thay đổi, không thể check-in.", {
      extensions: { code: "RESERVATION_CHANGE_PENDING" },
    });
  }
}

function isSameReservationSession(activeSession, reservation) {
  if (!activeSession?.reservationId) return false;
  return String(activeSession.reservationId) === String(reservation._id);
}

function buildSessionTimeline(now, ctx, note) {
  return [
    {
      status: KITCHEN_STATUS.PENDING,
      at: now,
      byUserId: ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id) ? ctx.user.id : undefined,
      note: note || "Checked in reservation and opened table session",
    },
  ];
}

async function openTableSessionForReservation({ reservation, table, ctx, note, session }) {
  const now = new Date();
  const restaurantId = reservation.restaurantId;
  const tableId = reservation.tableId;
  const tableCode = normalizeTableCode(table.code);

  const activeSession = await findActiveTableSession({
    restaurantId,
    tableId,
    tableCode,
    session,
  });

  if (activeSession) {
    if (isSameReservationSession(activeSession, reservation)) {
      await Order.updateOne(
        { _id: activeSession._id },
        {
          $set: {
            sessionStatus: SESSION_STATUS.DINING,
            currentStatus: KITCHEN_STATUS.PENDING,
            kitchenStatus: KITCHEN_STATUS.PENDING,
            orderPaymentStatus: activeSession.orderPaymentStatus || ORDER_PAYMENT_STATUS.UNPAID,
            reservationId: reservation._id,
            userId: reservation.userId,
          },
          $push: {
            statusTimeline: {
              status: KITCHEN_STATUS.PENDING,
              at: now,
              byUserId: ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id) ? ctx.user.id : undefined,
              note: note || "Reservation check-in confirmed for existing table session",
            },
          },
        },
        { session },
      );
      return { sessionOrderId: activeSession._id, reused: true };
    }

    throw new GraphQLError("Bàn đang có phiên phục vụ khác, không thể check-in reservation này.", {
      extensions: {
        code: "TABLE_SESSION_CONFLICT",
        activeSessionId: String(activeSession._id),
      },
    });
  }

  const orderCode = await createUniqueOrderCode("POS", now, tableCode, session);
  const activeSessionKey = buildActiveTableSessionKey({ restaurantId, tableId });

  const [created] = await Order.create(
    [
      {
        orderCode,
        parentOrderCode: null,
        orderKind: ORDER_KIND.TABLE_SESSION,
        parentOrderId: null,
        rootOrderId: null,
        splitStatus: SPLIT_STATUS.NONE,
        sessionStatus: SESSION_STATUS.DINING,
        kitchenStatus: KITCHEN_STATUS.PENDING,
        orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
        activeSessionKey,
        openedAt: now,
        closedAt: null,
        tableId,
        tableCode,
        tableName: table.name || table.code || tableCode,
        guestCount: Math.max(1, Number(reservation.partySize || 1)),
        userId: reservation.userId,
        restaurantId,
        reservationId: reservation._id,
        orderType: "dine_in",
        items: [],
        totals: {
          subtotal: 0,
          discount: 0,
          tax: 0,
          service: 0,
          shippingFee: 0,
          grandTotal: 0,
        },
        payment: {
          method: "cash",
          status: "pending",
        },
        currentStatus: KITCHEN_STATUS.PENDING,
        note: note || "Opened from reservation check-in",
        statusTimeline: buildSessionTimeline(now, ctx, note),
        clientMeta: {
          source: "reservation_check_in",
          reservationId: String(reservation._id),
        },
      },
    ],
    { session },
  );

  return { sessionOrderId: created._id, reused: false };
}

async function checkInReservationCore({ input, ctx }) {
  const session = await mongoose.startSession();
  try {
    let checkedIn = null;
    await session.withTransaction(async () => {
      const reservation = await Reservation.findById(
        toObjectId(input.reservationId, "reservationId"),
        null,
        { session },
      );
      if (!reservation) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });

      await requireRestaurantPermission(ctx, reservation.restaurantId, PERMISSIONS.RESERVATION_UPDATE);
      assertCheckInAllowed(reservation);

      const table = await Table.findOne(
        {
          _id: reservation.tableId,
          restaurantId: reservation.restaurantId,
        },
        null,
        { session },
      ).lean();
      if (!table) throw new GraphQLError("Table not found", { extensions: { code: "NOT_FOUND" } });

      if (["offline", "cleaning"].includes(String(table.status || ""))) {
        throw new GraphQLError("Bàn chưa sẵn sàng để check-in reservation.", {
          extensions: { code: "TABLE_UNAVAILABLE" },
        });
      }

      const sessionState = await openTableSessionForReservation({
        reservation,
        table,
        ctx,
        note: input.note,
        session,
      });

      reservation.status = "seated";
      reservation.note = appendNote(reservation.note, input.note);
      await reservation.save({ session });
      await confirmReservationSlot({ reservationId: reservation._id, session });
      await Table.updateOne({ _id: reservation.tableId }, { $set: { status: "occupied" } }, { session });

      await EventLog.log(
        {
          restaurantId: reservation.restaurantId,
          actorUserId: ctx?.user?.id,
          verb: "reservation.check_in",
          object: { kind: "Reservation", id: reservation._id },
          target: { kind: "Table", id: reservation.tableId },
          source: "manager_app",
          status: "success",
          meta: {
            tableId: String(reservation.tableId),
            sessionOrderId: String(sessionState.sessionOrderId),
            reusedSession: sessionState.reused,
          },
        },
        { session },
      ).catch(() => {});

      checkedIn = reservation;
    });
    return checkedIn;
  } finally {
    await session.endSession();
  }
}

export const ReservationCheckInMutation = {
  async checkInReservation(_, { input }, ctx) {
    return checkInReservationCore({ input, ctx });
  },
};

export function withSafeReservationStatusMutation(mutation = {}) {
  return {
    ...mutation,
    async updateReservationStatus(parent, args, ctx, info) {
      const nextStatus = String(args?.input?.status || "").toLowerCase();
      if (nextStatus === "seated") {
        return checkInReservationCore({
          input: {
            reservationId: args.input.id,
            note: "Check-in thông qua cập nhật trạng thái reservation.",
          },
          ctx,
        });
      }
      return mutation.updateReservationStatus.call(mutation, parent, args, ctx, info);
    },
  };
}

export default ReservationCheckInMutation;
