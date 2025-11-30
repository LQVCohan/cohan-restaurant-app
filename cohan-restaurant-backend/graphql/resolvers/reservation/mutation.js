// graphql/reservation/mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Reservation, Restaurant, Table, User } from "../../../models/index.js";

const { Types } = mongoose;

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Invalid ID", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new Types.ObjectId(id);
}

function atLeastPhoneOrEmail(phone, email) {
  const phoneOk = !!(phone && String(phone).trim());
  const emailOk = !!(email && String(email).trim());
  return phoneOk || emailOk;
}

function parseHHMM(s, fallback = [23, 0]) {
  if (!s || typeof s !== "string") return fallback;
  const [h, m] = s.split(":").map((n) => Number(n));
  if (Number.isFinite(h) && Number.isFinite(m)) return [h, m];
  return fallback;
}

async function getRestaurantOrThrow(
  restaurantId,
  fields = "name openingHours closingHours"
) {
  const r = await Restaurant.findById(toObjectId(restaurantId))
    .select(fields)
    .lean();
  if (!r) {
    throw new GraphQLError("Restaurant not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return r;
}

async function getTableOrThrow(tableId, restaurantId) {
  const t = await Table.findOne({
    _id: toObjectId(tableId),
    restaurantId: toObjectId(restaurantId),
  }).lean();
  if (!t) {
    throw new GraphQLError("Table not found in this restaurant", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return t;
}

/**
 * Kiểm tra bàn có bị trùng khoảng thời gian với các Reservation active khác không.
 * Khoảng thời gian = [timeTo, timeTo + durationMinutes].
 * Các status gây xung đột: pending_payment, confirmed, seated
 * (bỏ qua cancelled, completed, no_show).
 */
async function ensureTableAvailableForTime(
  tableId,
  timeTo,
  durationMinutes,
  exceptReservationId = null
) {
  const table = await Table.findById(toObjectId(tableId)).lean();
  if (!table) {
    throw new GraphQLError("Table not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  // Không cho book bàn offline
  if (table.status === "offline") {
    throw new GraphQLError("Table is offline and cannot be reserved.", {
      extensions: { code: "TABLE_UNAVAILABLE" },
    });
  }

  const start = new Date(timeTo);
  const dur =
    typeof durationMinutes === "number" && durationMinutes > 0
      ? durationMinutes
      : 90;
  const end = new Date(start.getTime() + dur * 60 * 1000);

  // Lấy các reservation cùng bàn, còn active, có timeTo trước newEnd
  const query = {
    tableId: toObjectId(tableId),
    status: { $in: ["pending_payment", "confirmed", "seated"] },
    timeTo: { $lt: end }, // coarse filter
  };

  if (exceptReservationId) {
    query._id = { $ne: toObjectId(exceptReservationId) };
  }

  const candidates = await Reservation.find(query)
    .select({ timeTo: 1, durationMinutes: 1 })
    .lean();

  const conflict = candidates.some((r) => {
    const rStart = new Date(r.timeTo);
    const rDur =
      typeof r.durationMinutes === "number" && r.durationMinutes > 0
        ? r.durationMinutes
        : 90;
    const rEnd = new Date(rStart.getTime() + rDur * 60 * 1000);

    // Overlap nếu: rStart < newEnd && newStart < rEnd
    return rStart < end && start < rEnd;
  });

  if (conflict) {
    throw new GraphQLError(
      "This table is already booked in the selected time range.",
      {
        extensions: { code: "TIME_CONFLICT" },
      }
    );
  }
}

function validateAgainstClosingHours(restaurant, arrivalISO) {
  const arrival = new Date(arrivalISO);
  const [closeH, closeM] = parseHHMM(restaurant.closingHours, [23, 0]);
  const closingTime = new Date(arrival);
  closingTime.setHours(closeH, closeM, 0, 0);

  const diffMinutes = (closingTime - arrival) / (1000 * 60);
  if (diffMinutes < 0) {
    throw new GraphQLError("Arrival time exceeds restaurant closing hours.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return {
    arrival,
    closingTime,
    diffMinutes,
    isLateBooking: diffMinutes < 120,
  };
}

/**
 * User guest chỉ dựa vào 3 trường: name/phone/email.
 */
async function resolveUserIdFromContact({
  customerName,
  customerPhone,
  customerEmail,
}) {
  if (customerPhone) {
    const foundByPhone = await User.findOne({
      phone: customerPhone?.trim(),
    }).select({ _id: 1 });
    if (foundByPhone) return foundByPhone._id;
  }

  if (customerEmail) {
    const foundByEmail = await User.findOne({
      email: customerEmail?.trim(),
    }).select({ _id: 1 });
    if (foundByEmail) return foundByEmail._id;
  }

  const guest = new User({
    fullName: (customerName || "Guest").trim(),
    phone: customerPhone?.trim() || undefined,
    email: customerEmail?.trim() || undefined,
    isGuest: true,
    status: "active",
    guestExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  await guest.save();
  return guest.id;
}

/** Đánh dấu bàn đã được đặt (reserved) */
async function markTableReserved(tableId) {
  await Table.findByIdAndUpdate(
    toObjectId(tableId),
    { status: "reserved" },
    { new: true }
  );
}

/** Thử giải phóng bàn: nếu không còn reservation active nào thì set available */
async function tryReleaseTable(tableId) {
  const hasActive = await Reservation.exists({
    tableId: toObjectId(tableId),
    status: { $in: ["pending_payment", "confirmed", "seated"] },
  });

  if (!hasActive) {
    await Table.findByIdAndUpdate(
      toObjectId(tableId),
      { status: "available" },
      { new: true }
    );
  }
}

export const ReservationMutation = {
  /* ───────────────── createReservation ───────────────── */
  async createReservation(_, { input }) {
    try {
      const {
        restaurantId,
        tableId,
        timeTo, // bắt buộc
        durationMinutes, // mới: thời lượng (phút)
        partySize = 2,
        note,
        customerName,
        customerPhone,
        customerEmail,
        depositAmount = 0,
      } = input || {};

      if (!restaurantId || !tableId) {
        throw new GraphQLError("Missing restaurantId or tableId.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (!atLeastPhoneOrEmail(customerPhone, customerEmail)) {
        throw new GraphQLError("phone or email are required.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (!timeTo) {
        throw new GraphQLError("Missing arrival time (timeTo).", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const restaurant = await getRestaurantOrThrow(restaurantId);
      const { isLateBooking } = validateAgainstClosingHours(restaurant, timeTo);

      const table = await getTableOrThrow(tableId, restaurantId);
      if (!table) {
        throw new GraphQLError("This restaurant doesn't have this table", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Check sức chứa
      if (partySize > table.capacity) {
        throw new GraphQLError(
          `Party size (${partySize}) exceeds table capacity (${table.capacity}).`,
          { extensions: { code: "CAPACITY_EXCEEDED" } }
        );
      }

      const effectiveDuration =
        typeof durationMinutes === "number" && durationMinutes > 0
          ? durationMinutes
          : 90;

      await ensureTableAvailableForTime(
        tableId,
        timeTo,
        effectiveDuration,
        null
      );

      const userId = await resolveUserIdFromContact({
        customerName,
        customerPhone,
        customerEmail,
      });

      const doc = new Reservation({
        restaurantId: toObjectId(restaurantId),
        restaurantName: restaurant.name || "",
        tableId: toObjectId(tableId),
        userId,

        timeTo: new Date(timeTo),
        durationMinutes: effectiveDuration,

        partySize,
        note: note || "",
        customerName: customerName?.trim(),
        customerPhone: customerPhone?.trim() || null,
        customerEmail: customerEmail?.trim() || null,

        depositAmount,
        depositStatus: depositAmount > 0 ? "pending" : "unpaid",
        status: depositAmount > 0 ? "pending_payment" : "confirmed",
        // orderCode, pendingPaymentExpiresAt sẽ do pre-save trong model tự xử lý
      });

      const saved = await doc.save();

      // Đánh dấu bàn đã được đặt
      await markTableReserved(tableId);

      if (isLateBooking) {
        saved._warning =
          "⏰ Giờ đến gần giờ đóng cửa — thời gian phục vụ có thể bị giới hạn.";
      }
      return saved;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to create reservation", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  /* ───────────────── updateReservation (sửa thông tin) ───────────────── */
  async updateReservation(_, { input }, _ctx) {
    try {
      const {
        id,
        timeTo,
        durationMinutes,
        partySize,
        note,
        customerName,
        customerPhone,
        customerEmail,
      } = input || {};

      if (!id) {
        throw new GraphQLError("Missing reservation id", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const current = await Reservation.findById(toObjectId(id));
      if (!current) {
        throw new GraphQLError("Reservation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const table = await Table.findById(current.tableId).lean();
      if (!table) {
        throw new GraphQLError("Table not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const update = {};
      let nextTimeTo = current.timeTo;
      let nextDuration =
        typeof current.durationMinutes === "number" &&
        current.durationMinutes > 0
          ? current.durationMinutes
          : 90;
      let nextPartySize = current.partySize;

      if (typeof partySize === "number" && partySize > 0) {
        nextPartySize = partySize;
        update.partySize = partySize;
      }
      if (typeof note === "string") update.note = note;
      if (typeof customerName === "string")
        update.customerName = customerName.trim();
      if (typeof customerPhone === "string")
        update.customerPhone = customerPhone.trim();
      if (typeof customerEmail === "string")
        update.customerEmail = customerEmail.trim();
      if (typeof durationMinutes === "number" && durationMinutes > 0) {
        nextDuration = durationMinutes;
        update.durationMinutes = durationMinutes;
      }
      if (timeTo) {
        nextTimeTo = new Date(timeTo);
        update.timeTo = nextTimeTo;
      }

      // Check capacity nếu partySize thay đổi
      if (nextPartySize > table.capacity) {
        throw new GraphQLError(
          `Party size (${nextPartySize}) exceeds table capacity (${table.capacity}).`,
          { extensions: { code: "CAPACITY_EXCEEDED" } }
        );
      }

      // Nếu timeTo hoặc durationMinutes thay đổi → check conflict
      if (timeTo || durationMinutes) {
        const restaurant = await getRestaurantOrThrow(current.restaurantId);
        validateAgainstClosingHours(restaurant, nextTimeTo);
        await ensureTableAvailableForTime(
          current.tableId,
          nextTimeTo,
          nextDuration,
          current._id
        );
      }

      const saved = await Reservation.findByIdAndUpdate(current._id, update, {
        new: true,
        runValidators: true,
      });

      return saved;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to update reservation", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  /* ───────────────── changeReservationTable (đổi bàn) ───────────────── */
  async changeReservationTable(_, { input }, _ctx) {
    try {
      const {
        id,
        newRestaurantId,
        newTableId,
        acceptPenalty = false,
        note,
      } = input || {};
      if (!id || !newTableId) {
        throw new GraphQLError("Missing id or newTableId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const current = await Reservation.findById(toObjectId(id));
      if (!current) {
        throw new GraphQLError("Reservation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const targetRestaurantId = newRestaurantId || current.restaurantId;

      const restaurant = await getRestaurantOrThrow(targetRestaurantId);
      validateAgainstClosingHours(restaurant, current.timeTo);

      const newTable = await getTableOrThrow(newTableId, targetRestaurantId);

      // Check capacity: số người hiện tại phải <= sức chứa bàn mới
      if (current.partySize > newTable.capacity) {
        throw new GraphQLError(
          `Party size (${current.partySize}) exceeds new table capacity (${newTable.capacity}).`,
          { extensions: { code: "CAPACITY_EXCEEDED" } }
        );
      }

      const effectiveDuration =
        typeof current.durationMinutes === "number" &&
        current.durationMinutes > 0
          ? current.durationMinutes
          : 90;

      // Bàn mới phải rảnh trong khoảng thời gian của reservation hiện tại
      await ensureTableAvailableForTime(
        newTable._id,
        current.timeTo,
        effectiveDuration,
        current._id
      );

      const isChangeRestaurant =
        String(targetRestaurantId) !== String(current.restaurantId);

      const update = {
        tableId: toObjectId(newTableId),
        restaurantId: toObjectId(targetRestaurantId),
        restaurantName: restaurant.name || current.restaurantName,
      };

      let appendedNote = note ? note.trim() : "";

      update.status = "pending_change";
      appendedNote +=
        (appendedNote ? " " : "") +
        (isChangeRestaurant
          ? acceptPenalty
            ? "Khách đã chấp nhận điều kiện đổi nhà hàng: có thể khấu trừ 50% tiền cọc khi xác nhận."
            : "Yêu cầu đổi sang nhà hàng khác. Khi nhà hàng xác nhận đổi có thể áp dụng khấu trừ 50% tiền cọc."
          : "Yêu cầu đổi bàn trong cùng nhà hàng. Vui lòng đợi nhà hàng xác nhận.");

      if (appendedNote) {
        update.note = current.note
          ? `${current.note}\n${appendedNote}`
          : appendedNote;
      }

      const oldTableId = current.tableId;

      const saved = await Reservation.findByIdAndUpdate(current._id, update, {
        new: true,
        runValidators: true,
      });

      // Đánh dấu bàn mới reserved, thử giải phóng bàn cũ
      await markTableReserved(newTableId);
      await tryReleaseTable(oldTableId);

      return saved;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to change table", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  /* ───────────────── updateReservationStatus (trạng thái đơn & cọc) ───────────────── */
  async updateReservationStatus(_, { input }, _ctx) {
    try {
      const { id, status, depositStatus, depositTxnId } = input || {};
      if (!id) {
        throw new GraphQLError("Missing reservation id", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

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

  /* ───────────────── cancelReservation ───────────────── */
  async cancelReservation(_, { id }, _ctx) {
    try {
      if (!id) {
        throw new GraphQLError("Missing reservation id", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const current = await Reservation.findById(toObjectId(id));
      if (!current) {
        throw new GraphQLError("Reservation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      current.status = "cancelled";
      const saved = await current.save();

      // Thử giải phóng bàn (nếu không còn reservation active nào khác)
      await tryReleaseTable(current.tableId);

      return saved;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to cancel reservation", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },
};
