import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Reservation,
  Restaurant,
  Table,
  Customer,
  EventLog,
  Cart,
} from "../../../models/index.js";
import {
  calcReservationEnd,
  confirmReservationSlot,
  holdReservationSlot,
} from "../../../src/services/reservationAvailability.service.js";
import {
  BASIC_EMAIL_REGEX,
  BASIC_PHONE_REGEX,
  applyCustomerRestaurantTouch,
  compactCustomerContact,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  resolveOrCreateGuestCustomer,
} from "../shared/customerIdentity.js";
import { ACTIVE_RESERVATION_STATUSES } from "../../../utils/tableStateGuards.js";
import { assertRestaurantCanReserve } from "../shared/restaurantCapabilityGuards.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";
import { calculateCustomerPromotionPricing } from "../../../src/services/customerPromotionPricing.service.js";
import { computeDeposit } from "./mutation.js";

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
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes)
    ? [hours, minutes]
    : fallback;
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

function normalizePaymentMethod(method) {
  const normalized = String(method || "momo").toLowerCase();
  if (!PAYMENT_METHODS.includes(normalized)) {
    throw new GraphQLError("paymentMethod không hợp lệ", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return normalized;
}

async function getRestaurantOrThrow(restaurantId, session) {
  const restaurant = await Restaurant.findById(
    toObjectId(restaurantId, "restaurantId"),
    null,
    { session },
  ).lean();
  if (!restaurant) {
    throw new GraphQLError("Restaurant not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return restaurant;
}

async function getTableOrThrow(tableId, restaurantId, session) {
  const table = await Table.findOne(
    {
      _id: toObjectId(tableId, "tableId"),
      restaurantId: toObjectId(restaurantId, "restaurantId"),
    },
    null,
    { session },
  ).lean();
  if (!table) {
    throw new GraphQLError("Table not found in this restaurant", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return table;
}

function validateOpenClose(
  restaurant,
  arrival,
  durationMinutes,
  isUnlimitedTime,
) {
  const [openHours, openMinutes] = parseHHMM(
    restaurant.openingHours,
    [7, 0],
  );
  const [closeHours, closeMinutes] = parseHHMM(
    restaurant.closingHours,
    [23, 0],
  );
  const open = new Date(arrival);
  open.setHours(openHours, openMinutes, 0, 0);
  const close = new Date(arrival);
  close.setHours(closeHours, closeMinutes, 0, 0);

  if (arrival < open || arrival > close) {
    throw new GraphQLError(
      "Thời gian đặt ngoài giờ mở cửa của nhà hàng",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
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
    { session },
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
      const earliestEnd =
        candidateEnd && end
          ? candidateEnd < end
            ? candidateEnd
            : end
          : null;
      if (!earliestEnd || latestStart < earliestEnd) {
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

async function ensureNoActiveViewLock(
  tableId,
  requesterUserId,
  session,
) {
  const table = await Table.findById(
    toObjectId(tableId, "tableId"),
    null,
    { session },
  ).lean();
  if (!table) {
    throw new GraphQLError("Table not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  const lock = table.viewLock;
  const now = new Date();
  if (!lock?.expiresAt || new Date(lock.expiresAt) <= now) return;
  if (String(lock.userId) !== String(requesterUserId)) {
    throw new GraphQLError(
      "Bàn đang được khách khác xem, vui lòng thử lại sau",
      { extensions: { code: "TABLE_VIEW_LOCKED" } },
    );
  }
}

async function resolveReservationUser(input, ctx, session) {
  const authUserId = ctx?.user?.id;
  if (mongoose.isValidObjectId(authUserId)) {
    const currentUser = await Customer.findOne(
      { _id: authUserId, userType: "CUSTOMER", deletedAt: null },
      null,
      { session },
    );
    if (!currentUser) {
      throw new GraphQLError("Không tìm thấy tài khoản khách hàng.", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    if (applyCustomerRestaurantTouch(currentUser, input.restaurantId)) {
      await currentUser.save({ session });
    }
    return {
      user: currentUser,
      userId: currentUser._id,
      isGuestCustomer: !!currentUser.isGuest,
      customerName: String(
        input.customerName || currentUser.fullName || "",
      ).trim(),
      customerPhone:
        normalizeCustomerPhone(input.customerPhone || currentUser.phone || "") ||
        "",
      customerEmail:
        normalizeCustomerEmail(input.customerEmail || currentUser.email || "") ||
        "",
    };
  }

  const compact = compactCustomerContact({
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
  });
  if (!compact.customerName) {
    throw new GraphQLError(
      "customerName là bắt buộc khi đặt bàn không cần đăng nhập",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
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

  const identity = await resolveOrCreateGuestCustomer({
    email: compact.email,
    phone: compact.phone,
    customerName: compact.customerName,
    createIfMissing: true,
    session,
    restaurantId: input.restaurantId,
    guestFallbackName: compact.customerName,
  });
  if (identity?.conflict) {
    throw new GraphQLError(
      "Thông tin liên hệ khớp với nhiều hồ sơ khách hàng khác nhau",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  return identity;
}

async function resolveLinkedCartPricing({
  linkedCartItemIds,
  userId,
  restaurantId,
  serviceAt,
  session,
}) {
  const ids = [
    ...new Set((linkedCartItemIds || []).map(String).filter(Boolean)),
  ];
  if (!ids.length) {
    return {
      subtotal: 0,
      promotionDiscount: 0,
      grandTotal: 0,
      appliedPromotions: [],
    };
  }
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    throw new GraphQLError("Dòng giỏ hàng không hợp lệ.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const cart = await Cart.findOne({
    userId: toObjectId(userId, "userId"),
    status: "active",
  }).session(session);
  if (!cart) {
    throw new GraphQLError("Không tìm thấy giỏ hàng đang giữ món.", {
      extensions: { code: "CART_NOT_FOUND" },
    });
  }

  const wanted = new Set(ids);
  const items = (cart.items || []).filter((item) =>
    wanted.has(String(item._id)),
  );
  if (items.length !== wanted.size) {
    throw new GraphQLError(
      "Một hoặc nhiều dòng giỏ hàng không còn tồn tại.",
      { extensions: { code: "CART_ITEM_NOT_FOUND" } },
    );
  }

  const arrivalMs = new Date(serviceAt).getTime();
  const now = Date.now();
  for (const item of items) {
    const itemServiceMs = new Date(item.serviceAt).getTime();
    if (
      String(item.restaurantId) !== String(restaurantId) ||
      item.holdStatus !== "active" ||
      !item.holdExpiresAt ||
      new Date(item.holdExpiresAt).getTime() <= now ||
      !Number.isFinite(itemServiceMs) ||
      Math.abs(itemServiceMs - arrivalMs) > 60_000
    ) {
      throw new GraphQLError(
        "Món giữ trong giỏ không còn hợp lệ cho thời gian đặt bàn này.",
        { extensions: { code: "CART_HOLD_INVALID" } },
      );
    }
  }

  const { breakdown } = await calculateCustomerPromotionPricing({
    restaurantId,
    items,
    pricing: { taxRate: 0, serviceRate: 0, shippingFee: 0 },
    orderType: "dine_in",
    userId,
    session,
  });
  return breakdown;
}

export async function createReservationWithPromotion(_, { input }, ctx) {
  const session = await mongoose.startSession();
  try {
    let created = null;
    await session.withTransaction(async () => {
      const restaurant = await getRestaurantOrThrow(
        input.restaurantId,
        session,
      );
      assertRestaurantCanReserve(computeRestaurantAvailability(restaurant));

      const resolvedIdentity = await resolveReservationUser(input, ctx, session);
      const user = resolvedIdentity.user;
      const userId = String(resolvedIdentity.userId);
      const table = await getTableOrThrow(
        input.tableId,
        input.restaurantId,
        session,
      );

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
      if (isUnlimitedTime && !userCanUseUnlimited(user)) {
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
      validateOpenClose(
        restaurant,
        arrival,
        durationMinutes,
        isUnlimitedTime,
      );
      await ensureNoActiveViewLock(input.tableId, userId, session);
      await ensureNoTableConflict({
        tableId: input.tableId,
        timeTo: arrival,
        durationMinutes,
        isUnlimitedTime,
        session,
      });

      const linkedMenuPricing = await resolveLinkedCartPricing({
        linkedCartItemIds: input.linkedCartItemIds,
        userId,
        restaurantId: input.restaurantId,
        serviceAt: arrival,
        session,
      });
      const linkedMenuSubtotal = Math.max(
        0,
        Number(linkedMenuPricing.subtotal || 0),
      );
      const linkedMenuDiscount = Math.max(
        0,
        Number(linkedMenuPricing.promotionDiscount || 0),
      );
      const linkedMenuTotal = Math.max(
        0,
        Number(linkedMenuPricing.grandTotal || 0),
      );

      const policy = restaurant?.reservationSettings || {};
      const hasTableDeposit =
        table.deposit !== null && table.deposit !== undefined;
      const baseDeposit = hasTableDeposit
        ? Number(table.deposit)
        : Number(policy.baseDepositAmount || 0);
      const depositAmount = computeDeposit({
        baseDeposit,
        linkedMenuSubtotal: linkedMenuTotal,
        menuDepositPercent: 50,
      });
      const paymentMethod = normalizePaymentMethod(input.paymentMethod);
      const paidNow = paymentMethod === "cash" && depositAmount > 0;

      created = await Reservation.create(
        [
          {
            restaurantId: toObjectId(
              input.restaurantId,
              "restaurantId",
            ),
            restaurantName: restaurant.name || "",
            tableId: toObjectId(input.tableId, "tableId"),
            userId: toObjectId(userId, "userId"),
            timeTo: arrival,
            durationMinutes,
            isUnlimitedTime,
            customerName:
              resolvedIdentity.customerName || user.fullName || "",
            customerPhone:
              resolvedIdentity.customerPhone || user.phone || "",
            customerEmail:
              resolvedIdentity.customerEmail || user.email || "",
            partySize: Number(input.partySize || 2),
            note: input.note || "",
            linkedMenuSubtotal,
            linkedMenuDiscount,
            linkedMenuTotal,
            linkedMenuPromotionIds:
              linkedMenuPricing.appliedPromotions || [],
            depositAmount,
            depositStatus:
              depositAmount <= 0 ? "unpaid" : paidNow ? "paid" : "pending",
            paymentMethod,
            paymentReference: input.paymentReference || null,
            status:
              depositAmount <= 0 || paidNow
                ? "confirmed"
                : "pending_payment",
          },
        ],
        { session },
      ).then((rows) => rows[0]);

      const reservationEnd =
        calcReservationEnd(arrival, durationMinutes, isUnlimitedTime) ||
        new Date(arrival.getTime() + 24 * 60 * 60 * 1000);
      await holdReservationSlot({
        restaurantId: created.restaurantId,
        tableId: created.tableId,
        userId,
        reservationId: created._id,
        slotStart: arrival,
        slotEnd: reservationEnd,
        holdMinutes: created.status === "pending_payment" ? 10 : 60,
        session,
      });
      if (created.status === "confirmed") {
        await confirmReservationSlot({
          reservationId: created._id,
          session,
        });
      }

      const updateTableResult = await Table.updateOne(
        {
          _id: created.tableId,
          status: { $nin: ["offline", "occupied", "cleaning"] },
        },
        {
          $set: {
            status:
              created.status === "pending_payment"
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
          actorUserId: userId,
          object: { kind: "Reservation", id: created._id },
          target: { kind: "Table", id: created.tableId },
          source: "customer_app",
          status: "success",
          meta: {
            orderCode: created.orderCode,
            tableId: String(created.tableId),
            depositAmount: created.depositAmount,
            linkedMenuSubtotal,
            linkedMenuDiscount,
            linkedMenuTotal,
            linkedMenuPromotionIds:
              linkedMenuPricing.appliedPromotions || [],
            paymentMethod,
            isUnlimitedTime,
            isGuestCustomer: resolvedIdentity.isGuestCustomer,
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
