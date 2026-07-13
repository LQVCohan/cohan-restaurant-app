import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Reservation } from "../../../models/index.js";
import { ACTIVE_RESERVATION_STATUSES } from "../../../utils/tableStateGuards.js";

const isStaffLike = (ctx) => {
  const role = String(ctx?.user?.roleName || ctx?.user?.role || "").toLowerCase();
  return role.includes("staff") || role.includes("manager") || role.includes("admin");
};

const endAt = (timeTo, durationMinutes, isUnlimitedTime) => {
  if (isUnlimitedTime) return null;
  const start = new Date(timeTo).getTime();
  return Number.isFinite(start) ? start + Math.max(30, Number(durationMinutes || 60)) * 60000 : null;
};

const overlaps = (startA, endA, startB, endB) =>
  (endA === null || startB < endA) && (endB === null || startA < endB);

async function assertNoCustomerOverlap({ userId, restaurantId, timeTo, durationMinutes, isUnlimitedTime, exceptId }) {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(restaurantId) || !timeTo) return;
  const start = new Date(timeTo).getTime();
  if (!Number.isFinite(start)) return;
  const end = endAt(timeTo, durationMinutes, isUnlimitedTime);
  const filter = {
    userId,
    restaurantId,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
  };
  if (exceptId) filter._id = { $ne: exceptId };
  const candidates = await Reservation.find(filter)
    .select({ timeTo: 1, durationMinutes: 1, isUnlimitedTime: 1, orderCode: 1 })
    .lean();
  const conflict = candidates.find((item) => {
    const otherStart = new Date(item.timeTo).getTime();
    if (!Number.isFinite(otherStart)) return false;
    return overlaps(start, end, otherStart, endAt(item.timeTo, item.durationMinutes, item.isUnlimitedTime));
  });
  if (conflict) {
    throw new GraphQLError(
      `Bạn đã có lịch đặt bàn ${conflict.orderCode || "khác"} trùng khung giờ tại nhà hàng này.`,
      { extensions: { code: "USER_RESERVATION_TIME_CONFLICT", conflictingReservationId: conflict._id } },
    );
  }
}

async function normalizeFreeDeposit(reservation) {
  if (!reservation || Number(reservation.depositAmount || 0) > 0) return reservation;
  const status = String(reservation.status || "").toLowerCase();
  if (!["pending_payment", "confirmed"].includes(status)) return reservation;
  reservation.depositAmount = 0;
  reservation.depositStatus = "paid";
  reservation.status = "confirmed";
  reservation.pendingPaymentExpiresAt = null;
  reservation.paymentReference = reservation.paymentReference || "NO_DEPOSIT_REQUIRED";
  if (typeof reservation.save === "function") {
    await reservation.save();
    return reservation;
  }
  await Reservation.updateOne(
    { _id: reservation._id || reservation.id },
    { $set: { depositAmount: 0, depositStatus: "paid", status: "confirmed", pendingPaymentExpiresAt: null, paymentReference: reservation.paymentReference } },
  );
  return { ...reservation, depositAmount: 0, depositStatus: "paid", status: "confirmed", pendingPaymentExpiresAt: null };
}

export function withCustomerReservationPolicy(mutations = {}) {
  return {
    ...mutations,
    async createReservation(parent, { input }, ctx, info) {
      if (!isStaffLike(ctx)) {
        await assertNoCustomerOverlap({
          userId: ctx?.user?.id,
          restaurantId: input?.restaurantId,
          timeTo: input?.timeTo,
          durationMinutes: input?.durationMinutes,
          isUnlimitedTime: input?.isUnlimitedTime,
        });
      }
      const reservation = await mutations.createReservation(parent, { input }, ctx, info);
      return normalizeFreeDeposit(reservation);
    },
    async requestReservationChange(parent, { input }, ctx, info) {
      if (!isStaffLike(ctx) && input?.type === "time") {
        const current = await Reservation.findById(input.reservationId).lean();
        if (current) {
          await assertNoCustomerOverlap({
            userId: current.userId,
            restaurantId: current.restaurantId,
            timeTo: input.requestedTimeTo || current.timeTo,
            durationMinutes: input.requestedDurationMinutes ?? current.durationMinutes,
            isUnlimitedTime: current.isUnlimitedTime,
            exceptId: current._id,
          });
        }
      }
      return mutations.requestReservationChange(parent, { input }, ctx, info);
    },
  };
}
