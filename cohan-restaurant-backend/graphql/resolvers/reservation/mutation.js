import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Reservation,
  Restaurant,
  Table,
  User,
  Customer,
  PaymentTransaction,
  EventLog,
} from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

const ACTIVE_STATUSES = ["pending_payment", "confirmed", "seated", "pending_change"];
const PAYMENT_METHODS = ["cash", "momo", "vnpay"];
const PAYMENT_STATUSES = ["paid", "pending", "failed", "cancelled"];
const GUEST_TTL_DAYS = 30;
const GUEST_TTL_MS = GUEST_TTL_DAYS * 24 * 60 * 60 * 1000;
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASIC_PHONE_REGEX = /^0\d{9,10}$/;

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

function userCanUseUnlimited(user) {
  const rank = String(user?.loyaltyRank || "basic").toLowerCase();
  return ["silver", "gold", "platinum"].includes(rank);
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

function calcEnd(start, durationMinutes, isUnlimitedTime) {
  if (isUnlimitedTime) return null;
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

function userRole(ctx) {
  return String(ctx?.user?.roleName || ctx?.user?.role || "").toLowerCase();
}

function canManageReservation(ctx, reservationUserId) {
  const actorId = ctx?.user?.id;
  if (actorId && String(actorId) === String(reservationUserId)) return true;
  const role = userRole(ctx);
  return role.includes("staff") || role.includes("manager") || role.includes("admin");
}

function isReservationOwner(ctx, reservation) {
  const userId = ctx?.user?.id;
  return userId && String(reservation?.userId) === String(userId);
}

async function requireReservationManagerOrOwner(ctx, reservation) {
  if (isReservationOwner(ctx, reservation)) return "owner";
  if (!canManageReservation(ctx, reservation.userId)) {
    throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
  }
  await requireRestaurantAccess(ctx, reservation.restaurantId);
  return "manager";
}

async function getRestaurantOrThrow(restaurantId, session = null) {
  const r = await Restaurant.findById(toObjectId(restaurantId, "restaurantId"), null, session ? { session } : undefined).lean();
  if (!r) throw new GraphQLError("Restaurant not found", { extensions: { code: "NOT_FOUND" } });
  return r;
}

async function getTableOrThrow(tableId, restaurantId, session = null) {
  const t = await Table.findOne({
    _id: toObjectId(tableId, "tableId"),
    restaurantId: toObjectId(restaurantId, "restaurantId"),
  }, null, session ? { session } : undefined).lean();
  if (!t) throw new GraphQLError("Table not found in this restaurant", { extensions: { code: "NOT_FOUND" } });
  return t;
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
    const end = calcEnd(arrival, durationMinutes, false);
    if (end > close) {
      throw new GraphQLError("Thời lượng sử dụng vượt quá giờ đóng cửa", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
  }
}

async function ensureNoTableConflict({ tableId, timeTo, durationMinutes, isUnlimitedTime, exceptId = null, session = null }) {
  const start = new Date(timeTo);
  const end = calcEnd(start, durationMinutes, isUnlimitedTime);

  const q = {
    tableId: toObjectId(tableId, "tableId"),
    status: { $in: ACTIVE_STATUSES },
  };
  if (exceptId) q._id = { $ne: toObjectId(exceptId, "reservationId") };

  const candidates = await Reservation.find(q, null, session ? { session } : undefined)
    .select({ timeTo: 1, durationMinutes: 1, isUnlimitedTime: 1 })
    .lean();

  for (const c of candidates) {
    const cStart = new Date(c.timeTo);
    const cEnd = calcEnd(cStart, Number(c.durationMinutes || 60), !!c.isUnlimitedTime);

    if (isUnlimitedTime || c.isUnlimitedTime) {
      const latestStart = cStart > start ? cStart : start;
      const earliestFiniteEnd = cEnd && end ? (cEnd < end ? cEnd : end) : null;
      if (!earliestFiniteEnd || latestStart < earliestFiniteEnd) {
        throw new GraphQLError("Bàn đã có reservation xung đột thời gian", {
          extensions: { code: "TIME_CONFLICT" },
        });
      }
      continue;
    }

    if (cStart < end && start < cEnd) {
      throw new GraphQLError("Bàn đã có reservation xung đột thời gian", {
        extensions: { code: "TIME_CONFLICT" },
      });
    }
  }
}

async function ensureNoActiveViewLock(tableId, requesterUserId, session = null) {
  const table = await Table.findById(toObjectId(tableId, "tableId"), null, session ? { session } : undefined).lean();
  if (!table) throw new GraphQLError("Table not found", { extensions: { code: "NOT_FOUND" } });
  const lock = table.viewLock;
  const now = new Date();
  if (!lock?.expiresAt || new Date(lock.expiresAt) <= now) return;
  if (String(lock.userId) !== String(requesterUserId)) {
    throw new GraphQLError("Bàn đang được khách khác xem, vui lòng thử lại sau", {
      extensions: { code: "TABLE_VIEW_LOCKED" },
    });
  }
}

async function updateTableStatusByReservation(tableId) {
  const active = await Reservation.exists({ tableId, status: { $in: ["pending_payment", "confirmed", "seated"] } });
  await Table.updateOne(
    { _id: tableId },
    { $set: { status: active ? "reserved" : "available" } }
  );
}

function normalizePaymentMethod(method) {
  const normalized = String(method || "momo").toLowerCase();
  if (!PAYMENT_METHODS.includes(normalized)) {
    throw new GraphQLError("paymentMethod không hợp lệ", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return normalized;
}

function computeDeposit({ baseDeposit, linkedMenuSubtotal, menuDepositPercent }) {
  const menuPart = Math.round(Math.max(0, Number(linkedMenuSubtotal || 0)) * (Math.max(0, Number(menuDepositPercent || 50)) / 100));
  return Math.max(0, Number(baseDeposit || 0)) + menuPart;
}

function normalizeReservationEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeReservationPhone(value) {
  const raw = String(value || "").trim().replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.startsWith("+84")) return `0${raw.slice(3)}`;
  if (raw.startsWith("84")) return `0${raw.slice(2)}`;
  return raw;
}

async function resolveReservationUser(input, ctx, session = null) {
  const authUserId = ctx?.user?.id;
  if (mongoose.isValidObjectId(authUserId)) {
    const currentUser = await User.findById(authUserId, null, session ? { session } : undefined);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }

    return {
      user: currentUser,
      userId: currentUser._id,
      isGuestCustomer: !!currentUser.isGuest,
      customerName: String(input.customerName || currentUser.fullName || "").trim(),
      customerPhone: normalizeReservationPhone(input.customerPhone || currentUser.phone || ""),
      customerEmail: normalizeReservationEmail(input.customerEmail || currentUser.email || ""),
    };
  }

  const customerName = String(input.customerName || "").trim();
  const customerEmail = normalizeReservationEmail(input.customerEmail);
  const customerPhone = normalizeReservationPhone(input.customerPhone);

  if (!customerName) {
    throw new GraphQLError("customerName là bắt buộc khi đặt bàn không cần đăng nhập", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (!customerEmail && !customerPhone) {
    throw new GraphQLError("Vui lòng nhập email hoặc số điện thoại để nhà hàng xác nhận đặt bàn.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (customerEmail && !BASIC_EMAIL_REGEX.test(customerEmail)) {
    throw new GraphQLError("customerEmail không hợp lệ", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (customerPhone && !BASIC_PHONE_REGEX.test(customerPhone)) {
    throw new GraphQLError("customerPhone không hợp lệ", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const matchClauses = [];
  if (customerEmail) matchClauses.push({ email: customerEmail });
  if (customerPhone) matchClauses.push({ phone: customerPhone });

  const matchedCustomer = await Customer.findOne(
    { $or: matchClauses },
    null,
    session ? { session } : undefined
  ).sort({ isGuest: 1, updatedAt: -1 });

  if (matchedCustomer) {
    if (matchedCustomer.isGuest) {
      const now = new Date();
      matchedCustomer.guestExpiresAt = new Date(now.getTime() + GUEST_TTL_MS);
      matchedCustomer.guestLastSeenAt = now;
      if (customerName) matchedCustomer.fullName = customerName;
      if (!matchedCustomer.email && customerEmail) matchedCustomer.email = customerEmail;
      if (!matchedCustomer.phone && customerPhone) matchedCustomer.phone = customerPhone;
      await matchedCustomer.save({ session });
    }

    return {
      user: matchedCustomer,
      userId: matchedCustomer._id,
      isGuestCustomer: !!matchedCustomer.isGuest,
      customerName: customerName || matchedCustomer.fullName || "",
      customerPhone: customerPhone || matchedCustomer.phone || "",
      customerEmail: customerEmail || matchedCustomer.email || "",
    };
  }

  const now = new Date();
  const createdGuest = await Customer.create(
    [
      {
        fullName: customerName,
        email: customerEmail || undefined,
        phone: customerPhone || undefined,
        status: "pending",
        customerType: "NEW",
        isGuest: true,
        guestExpiresAt: new Date(now.getTime() + GUEST_TTL_MS),
        guestLastSeenAt: now,
      },
    ],
    { session }
  ).then((rows) => rows[0]);

  return {
    user: createdGuest,
    userId: createdGuest._id,
    isGuestCustomer: true,
    customerName,
    customerPhone,
    customerEmail,
  };
}

export const ReservationMutation = {
  async createReservation(_, { input }, ctx) {
    const session = await mongoose.startSession();
    try {
      let created = null;
      await session.withTransaction(async () => {
        const resolvedIdentity = await resolveReservationUser(input, ctx, session);
        const user = resolvedIdentity.user;
        const userId = String(resolvedIdentity.userId);

        const restaurant = await getRestaurantOrThrow(input.restaurantId, session);
        const table = await getTableOrThrow(input.tableId, input.restaurantId, session);

        if (["offline", "occupied", "cleaning"].includes(table.status)) {
          throw new GraphQLError("Table is not available", { extensions: { code: "TABLE_UNAVAILABLE" } });
        }

        if (Number(input.partySize || 2) > Number(table.capacity || 0)) {
          throw new GraphQLError("Số lượng khách vượt sức chứa của bàn", {
            extensions: { code: "CAPACITY_EXCEEDED" },
          });
        }

        const isUnlimitedTime = !!input.isUnlimitedTime;
        if (isUnlimitedTime && !userCanUseUnlimited(user)) {
          throw new GraphQLError("Tài khoản basic không được phép chọn không giới hạn thời gian", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const arrival = new Date(input.timeTo);
        if (!input.timeTo || Number.isNaN(arrival.getTime())) {
          throw new GraphQLError("timeTo không hợp lệ", { extensions: { code: "BAD_USER_INPUT" } });
        }

        const durationMinutes = normalizeDuration({
          durationMinutes: input.durationMinutes,
          isUnlimitedTime,
        });

        validateOpenClose(restaurant, arrival, durationMinutes, isUnlimitedTime);

        await ensureNoActiveViewLock(input.tableId, userId, session);
        await ensureNoTableConflict({
          tableId: input.tableId,
          timeTo: arrival,
          durationMinutes,
          isUnlimitedTime,
          session,
        });

        const policy = restaurant?.reservationSettings || {};
        const depositAmount =
          Number(input.depositAmount) > 0
            ? Number(input.depositAmount)
            : computeDeposit({
                baseDeposit: policy.baseDepositAmount || table.deposit || 0,
                linkedMenuSubtotal: input.linkedMenuSubtotal || 0,
                menuDepositPercent: policy.menuDepositPercent || 50,
              });

        const paymentMethod = normalizePaymentMethod(input.paymentMethod);
        const paidNow = paymentMethod === "cash" && depositAmount > 0;

        created = await Reservation.create(
          [
            {
              restaurantId: toObjectId(input.restaurantId, "restaurantId"),
              restaurantName: restaurant.name || "",
              tableId: toObjectId(input.tableId, "tableId"),
              userId: toObjectId(userId, "userId"),
              timeTo: arrival,
              durationMinutes,
              isUnlimitedTime,
              customerName: resolvedIdentity.customerName || user.fullName || "",
              customerPhone: resolvedIdentity.customerPhone || user.phone || "",
              customerEmail: resolvedIdentity.customerEmail || user.email || "",
              partySize: Number(input.partySize || 2),
              note: input.note || "",
              linkedMenuSubtotal: Number(input.linkedMenuSubtotal || 0),
              depositAmount,
              depositStatus:
                depositAmount <= 0 ? "unpaid" : paidNow ? "paid" : "pending",
              paymentMethod,
              paymentReference: input.paymentReference || null,
              status:
                depositAmount <= 0 || paidNow ? "confirmed" : "pending_payment",
            },
          ],
          { session }
        ).then((x) => x[0]);

        const updateTableResult = await Table.updateOne(
          { _id: created.tableId, status: { $nin: ["offline", "occupied", "cleaning"] } },
          { $set: { status: created.status === "pending_payment" ? "payment_pending" : "reserved" }, $unset: { viewLock: 1 } },
          { session }
        );
        if (!updateTableResult?.matchedCount) {
          throw new GraphQLError("Table is not available", {
            extensions: { code: "TABLE_UNAVAILABLE" },
          });
        }

        await EventLog.log(
          {
            restaurantId: created.restaurantId,
            verb: "reservation.create",
            actorUserId: userId,
            object: { kind: "Reservation", id: created._id },
            target: { kind: "Table", id: created.tableId },
            source: "customer_app",
            status: "success",
            meta: {
              orderCode: created.orderCode,
              tableId: String(created.tableId),
              depositAmount: created.depositAmount,
              paymentMethod,
              isUnlimitedTime,
              isGuestCustomer: resolvedIdentity.isGuestCustomer,
            },
          },
          { session }
        );
      });

      return created;
    } finally {
      await session.endSession();
    }
  },

  async updateReservation(_, { input }, ctx) {
    const current = await Reservation.findById(toObjectId(input.id, "reservationId"));
    if (!current) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });

    const userId = ctx?.user?.id;
    if (!userId || String(current.userId) !== String(userId)) {
      throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
    }

    const restaurant = await getRestaurantOrThrow(current.restaurantId);
    const table = await getTableOrThrow(current.tableId, current.restaurantId);

    const isUnlimitedTime = input.isUnlimitedTime ?? current.isUnlimitedTime;
    const user = await User.findById(userId).lean();
    if (isUnlimitedTime && !userCanUseUnlimited(user)) {
      throw new GraphQLError("Tài khoản basic không được phép chọn không giới hạn thời gian", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    const nextTimeTo = input.timeTo ? new Date(input.timeTo) : new Date(current.timeTo);
    const durationMinutes = normalizeDuration({ durationMinutes: input.durationMinutes ?? current.durationMinutes, isUnlimitedTime });

    if (Number(input.partySize ?? current.partySize) > Number(table.capacity || 0)) {
      throw new GraphQLError("Số lượng khách vượt sức chứa của bàn", { extensions: { code: "CAPACITY_EXCEEDED" } });
    }

    validateOpenClose(restaurant, nextTimeTo, durationMinutes, isUnlimitedTime);
    await ensureNoTableConflict({
      tableId: current.tableId,
      timeTo: nextTimeTo,
      durationMinutes,
      isUnlimitedTime,
      exceptId: current._id,
    });

    Object.assign(current, {
      timeTo: nextTimeTo,
      durationMinutes,
      isUnlimitedTime,
      partySize: input.partySize ?? current.partySize,
      note: input.note ?? current.note,
      customerName: input.customerName ?? current.customerName,
      customerPhone: input.customerPhone ?? current.customerPhone,
      customerEmail: input.customerEmail ?? current.customerEmail,
    });

    await current.save();
    return current;
  },

  async changeReservationTable(_, { input }, ctx) {
    const current = await Reservation.findById(toObjectId(input.id, "reservationId"));
    if (!current) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });

    const userId = ctx?.user?.id;
    if (!userId || String(current.userId) !== String(userId)) {
      throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
    }

    const targetRestaurantId = input.newRestaurantId || current.restaurantId;
    if (!input.newTableId) {
      throw new GraphQLError("newTableId is required", { extensions: { code: "BAD_USER_INPUT" } });
    }

    const targetTable = await getTableOrThrow(input.newTableId, targetRestaurantId);
    if (current.partySize > targetTable.capacity) {
      throw new GraphQLError("Số lượng khách vượt sức chứa của bàn mới", { extensions: { code: "CAPACITY_EXCEEDED" } });
    }

    await ensureNoTableConflict({
      tableId: targetTable._id,
      timeTo: current.timeTo,
      durationMinutes: current.durationMinutes,
      isUnlimitedTime: current.isUnlimitedTime,
      exceptId: current._id,
    });

    const restaurant = await getRestaurantOrThrow(targetRestaurantId);
    const fee = Number(restaurant?.reservationSettings?.changeTableFee || 0);

    current.changeRequestType = "table";
    current.changeRequestStatus = "requested";
    current.changeRequestFee = fee;
    current.requestedTableId = targetTable._id;
    current.note = [current.note, input.note].filter(Boolean).join("\n");
    current.status = "pending_change";

    await current.save();
    return current;
  },

  async requestReservationChange(_, { input }, ctx) {
    const current = await Reservation.findById(toObjectId(input.reservationId, "reservationId"));
    if (!current) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });

    const userId = ctx?.user?.id;
    if (!userId || String(current.userId) !== String(userId)) {
      throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
    }

    const restaurant = await getRestaurantOrThrow(current.restaurantId);

    const type = String(input.type || "").toLowerCase();
    if (!["time", "table"].includes(type)) {
      throw new GraphQLError("type must be 'time' or 'table'", { extensions: { code: "BAD_USER_INPUT" } });
    }

    current.changeRequestType = type;
    current.changeRequestStatus = "requested";
    current.changeRequestFee = Number(
      type === "time"
        ? restaurant?.reservationSettings?.changeTimeFee || 0
        : restaurant?.reservationSettings?.changeTableFee || 0
    );

    if (type === "time") {
      if (!input.requestedTimeTo) {
        throw new GraphQLError("requestedTimeTo is required for time change", { extensions: { code: "BAD_USER_INPUT" } });
      }
      current.requestedTimeTo = new Date(input.requestedTimeTo);
      const requestedDurationMinutes = normalizeDuration({
        durationMinutes: Number(input.requestedDurationMinutes || current.durationMinutes || 60),
        isUnlimitedTime: !!current.isUnlimitedTime,
      });
      validateOpenClose(restaurant, current.requestedTimeTo, requestedDurationMinutes, !!current.isUnlimitedTime);
      await ensureNoTableConflict({
        tableId: current.tableId,
        timeTo: current.requestedTimeTo,
        durationMinutes: requestedDurationMinutes,
        isUnlimitedTime: !!current.isUnlimitedTime,
        exceptId: current._id,
      });
      current.requestedDurationMinutes = requestedDurationMinutes;
    } else {
      if (!input.requestedTableId || !mongoose.isValidObjectId(input.requestedTableId)) {
        throw new GraphQLError("requestedTableId is required for table change", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const targetTable = await getTableOrThrow(input.requestedTableId, current.restaurantId);
      if (Number(current.partySize || 0) > Number(targetTable.capacity || 0)) {
        throw new GraphQLError("Số lượng khách vượt sức chứa của bàn mới", { extensions: { code: "CAPACITY_EXCEEDED" } });
      }
      await ensureNoTableConflict({
        tableId: targetTable._id,
        timeTo: current.timeTo,
        durationMinutes: current.durationMinutes,
        isUnlimitedTime: !!current.isUnlimitedTime,
        exceptId: current._id,
      });
      current.requestedTableId = toObjectId(input.requestedTableId, "requestedTableId");
    }

    current.note = [current.note, input.note].filter(Boolean).join("\n");
    current.status = "pending_change";
    await current.save();
    return current;
  },

  async updateReservationStatus(_, { input }, ctx) {
    const current = await Reservation.findById(toObjectId(input.id, "reservationId"));
    if (!current) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });
    const role = userRole(ctx);
    if (!(role.includes("staff") || role.includes("manager") || role.includes("admin"))) {
      throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
    }
    await requireRestaurantAccess(ctx, current.restaurantId);

    if (input.status) current.status = input.status;
    if (input.depositStatus) current.depositStatus = input.depositStatus;
    if (input.depositTxnId) current.depositTxnId = toObjectId(input.depositTxnId, "depositTxnId");
    if (input.paymentMethod) current.paymentMethod = input.paymentMethod;
    if (input.paymentReference) current.paymentReference = input.paymentReference;

    await current.save();
    await updateTableStatusByReservation(current.tableId);
    return current;
  },

  async submitReservationPayment(_, { input }, ctx) {
    const { reservationId, method, paymentStatus, externalRef } = input || {};
    const reservation = await Reservation.findById(toObjectId(reservationId, "reservationId"));
    if (!reservation) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });

    await requireReservationManagerOrOwner(ctx, reservation);

    const normMethod = normalizePaymentMethod(method);
    const pStatus = String(paymentStatus || "pending").toLowerCase();
    if (!PAYMENT_STATUSES.includes(pStatus)) {
      throw new GraphQLError("paymentStatus không hợp lệ", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    reservation.paymentMethod = normMethod;
    reservation.paymentReference = externalRef || null;

    const wasAlreadyPaid = reservation.depositStatus === "paid" && reservation.depositTxnId;

    if (pStatus === "paid") {
      reservation.depositStatus = "paid";
      reservation.status = "confirmed";
    } else if (pStatus === "pending") {
      reservation.depositStatus = "pending";
      reservation.status = "pending_payment";
    } else if (pStatus === "cancelled") {
      reservation.depositStatus = "cancelled";
      reservation.status = "cancelled";
    } else {
      reservation.depositStatus = "failed";
      reservation.status = "cancelled";
    }

    await reservation.save();

    if (pStatus === "paid") {
      await Table.updateOne({ _id: reservation.tableId }, { $set: { status: "reserved" } });
    } else if (pStatus === "failed") {
      await updateTableStatusByReservation(reservation.tableId);
    } else {
      await Table.updateOne({ _id: reservation.tableId }, { $set: { status: "payment_pending" } });
    }

    if (pStatus === "paid" && !wasAlreadyPaid) {
      const trx = await PaymentTransaction.create({
        restaurantId: reservation.restaurantId,
        orderIds: [],
        paidAmount: reservation.depositAmount,
        method: normMethod,
        status: "SUCCESS",
        paidAt: new Date(),
        note: `Reservation deposit ${reservation.orderCode}`,
        externalRef,
        createdBy: ctx?.user?.id,
      });
      reservation.depositTxnId = trx._id;
      await reservation.save();
    }

    await EventLog.log({
      restaurantId: reservation.restaurantId,
      actorUserId: ctx?.user?.id,
      verb: "reservation.payment_status",
      object: { kind: "Reservation", id: reservation._id },
      target: { kind: "Table", id: reservation.tableId },
      source: "customer_app",
      status: "success",
      meta: {
        paymentMethod: normMethod,
        paymentStatus: pStatus,
        depositStatus: reservation.depositStatus,
        reservationStatus: reservation.status,
        depositTxnId: reservation.depositTxnId ? String(reservation.depositTxnId) : null,
      },
    }).catch(() => {});

    return reservation;
  },

  async cancelReservation(_, { id }, ctx) {
    const current = await Reservation.findById(toObjectId(id, "reservationId"));
    if (!current) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });
    await requireReservationManagerOrOwner(ctx, current);
    current.status = "cancelled";
    if (current.depositStatus === "pending") current.depositStatus = "cancelled";
    await current.save();
    await updateTableStatusByReservation(current.tableId);
    await EventLog.log({
      restaurantId: current.restaurantId,
      actorUserId: ctx?.user?.id,
      verb: "reservation.cancel",
      object: { kind: "Reservation", id: current._id },
      target: { kind: "Table", id: current.tableId },
      source: "customer_app",
      status: "success",
    }).catch(() => {});
    return current;
  },

  async deleteReservation(_, { id }, ctx) {
    const current = await Reservation.findById(toObjectId(id, "reservationId"));
    if (!current) throw new GraphQLError("Reservation not found", { extensions: { code: "NOT_FOUND" } });
    const role = userRole(ctx);
    if (!(role.includes("staff") || role.includes("manager") || role.includes("admin"))) {
      throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
    }
    if (!canManageReservation(ctx, current.userId)) {
      throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
    }
    await requireRestaurantAccess(ctx, current.restaurantId);
    current.status = "no_show";
    await current.save();
    await updateTableStatusByReservation(current.tableId);
    return current;
  },
};
