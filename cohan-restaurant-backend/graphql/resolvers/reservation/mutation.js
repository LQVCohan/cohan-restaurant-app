// graphql/reservation/mutation.js
import mongoose from "mongoose";
import { Reservation } from "../../../models/index.js";
import { GraphQLError } from "graphql";
function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Invalid ID", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new mongoose.Types.ObjectId(id);
}

function atLeastPhoneOrEmail(phone, email) {
  const phoneOk = !!(phone && String(phone).trim());
  const emailOk = !!(email && String(email).trim());
  return phoneOk || emailOk;
}

export const ReservationMutation = {
  async createReservation(_, { input }, ctx) {
    try {
      const userId = ctx?.auth?.user?.id || ctx?.user?.id; // tuỳ bạn set auth ở Mercurius
      if (!userId) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const {
        restaurantId,
        tableId,
        timeFrom,
        durationMinutes = 90,
        partySize = 2,
        note,
        customerName,
        customerPhone,
        customerEmail,
        depositAmount = 0,
      } = input || {};

      if (!atLeastPhoneOrEmail(customerPhone, customerEmail)) {
        throw new GraphQLError("Phone or email is required.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const doc = new Reservation({
        restaurantId: toObjectId(restaurantId),
        tableId: toObjectId(tableId),
        userId: toObjectId(userId),

        timeFrom: new Date(timeFrom),
        durationMinutes,
        partySize,
        note: note || "",

        customerName: customerName?.trim(),
        customerPhone: customerPhone?.trim() || null,
        customerEmail: customerEmail?.trim() || null,

        depositAmount,
        depositStatus: depositAmount > 0 ? "pending" : "unpaid",
        status: depositAmount > 0 ? "pending_payment" : "confirmed",
        // pendingPaymentExpiresAt sẽ tự set ở pre('save') nếu status là pending_payment
      });

      const saved = await doc.save(); // ❗ PHẢI save và return chính document
      // Không dùng .lean() ở đây, để virtual id & hooks hoạt động chuẩn
      console.log("saved: ", saved);
      return saved; // ❗ Trả về doc để không null
    } catch (err) {
      // Đừng trả về null — throw để GraphQL trả error chuẩn
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to create reservation", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  async updateReservationStatus(_, { input }, ctx) {
    try {
      const userId = ctx?.auth?.user?.id || ctx?.user?.id;
      if (!userId) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const { id, status, depositStatus, depositTxnId } = input;

      const update = {};
      if (status) update.status = status;
      if (depositStatus) update.depositStatus = depositStatus;
      if (depositTxnId) update.depositTxnId = toObjectId(depositTxnId);

      const saved = await Reservation.findByIdAndUpdate(
        toObjectId(id),
        update,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!saved) {
        throw new GraphQLError("Reservation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return saved;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to update reservation", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  async cancelReservation(_, { id }, ctx) {
    try {
      const userId = ctx?.auth?.user?.id || ctx?.user?.id;
      if (!userId) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const saved = await Reservation.findByIdAndUpdate(
        toObjectId(id),
        { status: "cancelled" },
        { new: true }
      );

      if (!saved) {
        throw new GraphQLError("Reservation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return saved;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to cancel reservation", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },
};
