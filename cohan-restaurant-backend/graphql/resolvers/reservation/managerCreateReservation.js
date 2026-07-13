import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Cart,
  EventLog,
  Reservation,
  Restaurant,
  Table,
  User,
} from "../../../models/index.js";
import {
  calcReservationEnd,
  confirmReservationSlot,
  holdReservationSlot,
} from "../../../src/services/reservationAvailability.service.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";
import { ACTIVE_RESERVATION_STATUSES } from "../../../utils/tableStateGuards.js";
import {
  BASIC_EMAIL_REGEX,
  BASIC_PHONE_REGEX,
  compactCustomerContact,
} from "../shared/customerIdentity.js";
import { assertRestaurantCanReserve } from "../shared/restaurantCapabilityGuards.js";
import { buildManagerReservationNote } from "./managerCreationPolicy.js";

const PAYMENT_METHODS = ["cash", "momo", "vnpay"];

function toObjectId(id, field = "ID") {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new GraphQLError(`Invalid ${field}`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new mongoose.Types.ObjectId(id);
}

function parseHHMM(value, fallback = [23, 0]) {
  if (!value || typeof value !== "string") return fallback;
  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (Number.isFinite(hour) && Number.isFinite(minute)) return [hour, minute];
  return fallback;
}

function userCanUseUnlimited(user) {
  const rank = String(user?.loyaltyRank || "basic").toLowerCase();
  return ["silver", "gold", "platinum"].includes(rank);
}

function normalizeDuration({ durationMinutes, isUnlimitedTime }) {
  if (isUnlimitedTime) return 0;
  const duration = Number(durationMinutes || 60);
  if (!Number.isFinite(duration) || duration < 30) {
    throw new GraphQLError("durationMinutes phải >= 30 phút", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return Math.floor(duration);
}

function validateOpenClose(restaurant, arrival, durationMinutes, isUnlimitedTime) {
  const [openHour, openMinute] = parseHHMM(restaurant.openingHours, [7, 0]);
  const [closeHour, closeMinute] = parseHHMM(restaurant.closingHours, [23, 0]);

  const open = new Date(arrival);
  open.setHours(openHour, openMinute, 0, 0);
  const close = new Date(arrival);
  close.setHours(closeHour, closeMinute, 0, 0);

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

async function ensureNoTableConflict({
  tableId,
  timeTo,
  durationMinutes,
  isUnlimitedTime,
  session,
}) {
  const start = new Date(timeTo);
  const end = calcReservationEnd(start, durationMinutes, isUnlimitedTime);
  const candidates = await Reservation.find(
    {
      tableId: toObjectId(tableId, "tableId"),
      status: { $in: ACTIVE_RESERVATION_STATUSES },
    },
    null,
    session ? { session } : undefined,
  )
    .select({ timeTo: 1, durationMinutes: 1, isUnlimitedTime: 1 })
    .lean();

  for (const candidate of candidates) {
    const candidateStart = new Date(candidate.timeTo);
    const candidateEnd = calcReservationEnd(
      candidateStart,
      Number(candidate.durationMinutes || 60),
      !!candidate.isUnlimitedTime,
    );

    if (isUnlimitedTime || candidate.isUnlimitedTime) {
      const latestStart = candidateStart > start ? candidateStart : start;
      const earliestFiniteEnd = candidateEnd && end
        ? (candidateEnd < end ? candidateEnd : end)
        : null;
      if (!earliestFiniteEnd || latestStart < earliestFiniteEnd) {
        throw new GraphQLError("Bàn đã có reservation xung đột thời gian", {
          extensions: { code: "TIME_CONFLICT" },
        });
      }
      continue;
    }

    if (candidateStart < end && start < candidateEnd) {
      throw new GraphQLError("Bàn đã có reservation xung đột thời gian", {
        extensions: { code: "TIME_CONFLICT" },
      });
    }
  }
}

function ensureNoActiveViewLock(table, requesterUserId) {
  const lock = table?.viewLock;
  const now = new Date();
  if (!lock?.expiresAt || new Date(lock.expiresAt) <= now) return;
  if (String(lock.userId) !== String(requesterUserId)) {
    throw new GraphQLError("Bàn đang được khách khác xem, vui lòng thử lại sau", {
      extensions: { code: "TABLE_VIEW_LOCKED" },
    });
  }
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

function computeDeposit({ baseDeposit, linkedMenuSubtotal, menuDepositPercent = 50 }) {
  const menuPart = Math.round(
    Math.max(0, Number(linkedMenuSubtotal || 0))
      * (Math.max(0, Number(menuDepositPercent)) / 100),
  );
  return Math.max(0, Number(baseDeposit || 0)) + menuPart;
}

function validateCustomerContact(input) {
  const compact = compactCustomerContact({
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
  });

  if (!compact.customerName) {
    throw new GraphQLError("customerName là bắt buộc khi quản lý đặt bàn", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!compact.email && !compact.phone) {
    throw new GraphQLError(
      "Vui lòng nhập email hoặc số điện thoại để nhà hàng xác nhận đặt bàn.",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  if (compact.email && !BASIC_EMAIL_REGEX.test(compact.email)) {
    throw new GraphQLError("customerEmail không hợp lệ", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (compact.phone && !BASIC_PHONE_REGEX.test(compact.phone)) {
    throw new GraphQLError("customerPhone không hợp lệ", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  return {
    customerName: compact.customerName,
    customerPhone: compact.phone || "",
    customerEmail: compact.email || "",
  };
}

async function resolveLinkedCartSubtotal({
  linkedCartItemIds,
  userId,
  restaurantId,
  serviceAt,
  session,
}) {
  const ids = [...new Set((linkedCartItemIds || []).map(String).filter(Boolean))];
  if (!ids.length) return 0;
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    throw new GraphQLError("Dòng giỏ hàng không hợp lệ.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const cartQuery = Cart.findOne({
    userId: toObjectId(userId, "userId"),
    status: "active",
  });
  if (session && typeof cartQuery.session === "function") cartQuery.session(session);
  const cart = await cartQuery;
  if (!cart) {
    throw new GraphQLError("Không tìm thấy giỏ hàng đang giữ món.", {
      extensions: { code: "CART_NOT_FOUND" },
    });
  }

  const wanted = new Set(ids);
  const items = (cart.items || []).filter((item) => wanted.has(String(item._id)));
  if (items.length !== wanted.size) {
    throw new GraphQLError("Một hoặc nhiều dòng giỏ hàng không còn tồn tại.", {
      extensions: { code: "CART_ITEM_NOT_FOUND" },
    });
  }

  const arrivalMs = new Date(serviceAt).getTime();
  const now = Date.now();
  for (const item of items) {
    const itemServiceMs = new Date(item.serviceAt).getTime();
    if (
      String(item.restaurantId) !== String(restaurantId)
      || item.holdStatus !== "active"
      || !item.holdExpiresAt
      || new Date(item.holdExpiresAt).getTime() <= now
      || !Number.isFinite(itemServiceMs)
      || Math.abs(itemServiceMs - arrivalMs) > 60_000
    ) {
      throw new GraphQLError(
        "Món giữ trong giỏ không còn hợp lệ cho thời gian đặt bàn này.",
        { extensions: { code: "CART_HOLD_INVALID" } },
      );
    }
  }

  return items.reduce(
    (sum, item) => sum
      + (Number(item.price || 0) + Number(item.modifiersPrice || 0))
        * Number(item.quantity || 1),
    0,
  );
}

async function getManagerActor(ctx, session) {
  const actorId = ctx?.user?.id || ctx?.user?._id;
  if (!mongoose.isValidObjectId(actorId)) {
    throw new GraphQLError("Unauthorized", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  const actor = await User.findOne(
    { _id: toObjectId(actorId, "userId"), deletedAt: null },
    null,
    session ? { session } : undefined,
  ).lean();
  if (!actor) {
    throw new GraphQLError("Không tìm thấy tài khoản quản lý.", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (actor.status && actor.status !== "active") {
    throw new GraphQLError("Tài khoản quản lý hiện không hoạt động.", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return actor;
}

export async function createManagerReservation(_, { input }, ctx) {
  const session = await mongoose.startSession();
  try {
    let created = null;
    await session.withTransaction(async () => {
      const actor = await getManagerActor(ctx, session);
      const actorId = String(actor._id);
      const managerName = String(
        actor.fullName
          || actor.username
          || ctx?.user?.fullName
          || ctx?.user?.name
          || actor.email
          || "không rõ tên",
      ).trim();
      const customer = validateCustomerContact(input);

      const restaurant = await Restaurant.findById(
        toObjectId(input.restaurantId, "restaurantId"),
        null,
        { session },
      ).lean();
      if (!restaurant) {
        throw new GraphQLError("Restaurant not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      assertRestaurantCanReserve(computeRestaurantAvailability(restaurant));

      const table = await Table.findOne(
        {
          _id: toObjectId(input.tableId, "tableId"),
          restaurantId: toObjectId(input.restaurantId, "restaurantId"),
        },
        null,
        { session },
      ).lean();
      if (!table) {
        throw new GraphQLError("Table not found in this restaurant", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (["offline", "occupied", "cleaning"].includes(table.status)) {
        throw new GraphQLError("Table is not available", {
          extensions: { code: "TABLE_UNAVAILABLE" },
        });
      }
      if (Number(input.partySize || 2) > Number(table.capacity || 0)) {
        throw new GraphQLError("Số lượng khách vượt sức chứa của bàn", {
          extensions: { code: "CAPACITY_EXCEEDED" },
        });
      }

      const isUnlimitedTime = !!input.isUnlimitedTime;
      if (isUnlimitedTime && !userCanUseUnlimited(actor)) {
        throw new GraphQLError(
          "Tài khoản basic không được phép chọn không giới hạn thời gian",
          { extensions: { code: "FORBIDDEN" } },
        );
      }

      const arrival = new Date(input.timeTo);
      if (!input.timeTo || Number.isNaN(arrival.getTime())) {
        throw new GraphQLError("timeTo không hợp lệ", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const durationMinutes = normalizeDuration({
        durationMinutes: input.durationMinutes,
        isUnlimitedTime,
      });
      validateOpenClose(restaurant, arrival, durationMinutes, isUnlimitedTime);
      ensureNoActiveViewLock(table, actorId);
      await ensureNoTableConflict({
        tableId: input.tableId,
        timeTo: arrival,
        durationMinutes,
        isUnlimitedTime,
        session,
      });

      const linkedMenuSubtotal = await resolveLinkedCartSubtotal({
        linkedCartItemIds: input.linkedCartItemIds,
        userId: actorId,
        restaurantId: input.restaurantId,
        serviceAt: arrival,
        session,
      });
      const policy = restaurant?.reservationSettings || {};
      const hasTableDeposit = table.deposit !== null && table.deposit !== undefined;
      const baseDeposit = hasTableDeposit
        ? Number(table.deposit)
        : Number(policy.baseDepositAmount || 0);
      const depositAmount = computeDeposit({
        baseDeposit,
        linkedMenuSubtotal,
        menuDepositPercent: 50,
      });
      const paymentMethod = normalizePaymentMethod(input.paymentMethod);
      const paidNow = paymentMethod === "cash" && depositAmount > 0;

      created = await Reservation.create(
        [
          {
            restaurantId: toObjectId(input.restaurantId, "restaurantId"),
            restaurantName: restaurant.name || "",
            tableId: toObjectId(input.tableId, "tableId"),
            userId: toObjectId(actorId, "userId"),
            timeTo: arrival,
            durationMinutes,
            isUnlimitedTime,
            customerName: customer.customerName,
            customerPhone: customer.customerPhone,
            customerEmail: customer.customerEmail,
            partySize: Number(input.partySize || 2),
            note: buildManagerReservationNote(managerName, input.note),
            linkedMenuSubtotal,
            depositAmount,
            depositStatus: depositAmount <= 0
              ? "unpaid"
              : paidNow
                ? "paid"
                : "pending",
            paymentMethod,
            paymentReference: input.paymentReference || null,
            status: depositAmount <= 0 || paidNow
              ? "confirmed"
              : "pending_payment",
          },
        ],
        { session },
      ).then((rows) => rows[0]);

      const reservationEnd = calcReservationEnd(
        arrival,
        durationMinutes,
        isUnlimitedTime,
      ) || new Date(arrival.getTime() + 24 * 60 * 60 * 1000);

      await holdReservationSlot({
        restaurantId: created.restaurantId,
        tableId: created.tableId,
        userId: actorId,
        reservationId: created._id,
        slotStart: arrival,
        slotEnd: reservationEnd,
        holdMinutes: created.status === "pending_payment" ? 10 : 60,
        session,
      });
      if (created.status === "confirmed") {
        await confirmReservationSlot({ reservationId: created._id, session });
      }

      const updateTableResult = await Table.updateOne(
        {
          _id: created.tableId,
          status: { $nin: ["offline", "occupied", "cleaning"] },
        },
        {
          $set: {
            status: created.status === "pending_payment"
              ? "payment_pending"
              : "reserved",
          },
          $unset: { viewLock: 1 },
        },
        { session },
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
          actorUserId: actorId,
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
            isGuestCustomer: false,
            createdByManager: true,
            managerName,
            bookingCustomerName: customer.customerName,
          },
        },
        { session },
      );
    });

    return created;
  } finally {
    await session.endSession();
  }
}
