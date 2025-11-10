// graphql/reservation/mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Reservation, Restaurant, Table, User } from "../../../models/index.js";

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

/**
 * ✅ MỚI: chỉ tìm bàn khi _id khớp và cùng restaurantId (theo yêu cầu)
 */
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
 * Giữ nguyên kiểm tra trùng thời điểm & trạng thái bàn
 */
async function ensureTableAvailableForTime(
  tableId,
  timeTo,
  exceptReservationId = null
) {
  const table = await Table.findById(toObjectId(tableId)).lean();
  if (!table) {
    throw new GraphQLError("Table not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (table.status !== "available") {
    throw new GraphQLError("Table is not available.", {
      extensions: { code: "TABLE_UNAVAILABLE" },
    });
  }

  const conflict = await Reservation.exists({
    tableId: toObjectId(tableId),
    status: { $nin: ["cancelled"] },
    timeTo: new Date(timeTo),
    ...(exceptReservationId
      ? { _id: { $ne: toObjectId(exceptReservationId) } }
      : {}),
  });

  if (conflict) {
    throw new GraphQLError(
      "This table is already booked at the selected arrival time.",
      { extensions: { code: "TIME_CONFLICT" } }
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
 * ✅ MỚI: KHÔNG dùng userId từ ctx.
 * Xác định/khởi tạo người dùng (guest) chỉ dựa vào 3 trường: name/phone/email từ FE.
 * - Ưu tiên match Guest theo phone (nếu có), sau đó theo email (nếu có)
 * - Nếu không có, tạo guest mới
 */
async function resolveUserIdFromContact({
  customerName,
  customerPhone,
  customerEmail,
}) {
  // Ưu tiên phone
  if (customerPhone) {
    const foundByPhone = await User.findOne({
      phone: customerPhone.trim(),
      isGuest: true,
    }).select({ _id: 1 });
    if (foundByPhone) return foundByPhone._id;
  }

  // Sau đó email
  if (customerEmail) {
    const foundByEmail = await User.findOne({
      email: customerEmail.trim(),
      isGuest: true,
    }).select({ _id: 1 });
    if (foundByEmail) return foundByEmail._id;
  }

  // Không có -> tạo guest
  const guest = new User({
    fullName: (customerName || "Guest").trim(),
    phone: customerPhone?.trim() || undefined,
    email: customerEmail?.trim() || undefined,
    isGuest: true,
    status: "active",
    guestExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // TTL 30 ngày
  });
  await guest.save();
  return guest.id;
}

export const ReservationMutation = {
  /* ───────────────── createReservation ───────────────── */
  async createReservation(_, { input }) {
    try {
      const {
        restaurantId,
        tableId,
        timeTo, // bắt buộc
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
      if (!customerName || !atLeastPhoneOrEmail(customerPhone, customerEmail)) {
        throw new GraphQLError(
          "Customer name and (phone or email) are required.",
          { extensions: { code: "BAD_USER_INPUT" } }
        );
      }
      if (!timeTo) {
        throw new GraphQLError("Missing arrival time (timeTo).", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const restaurant = await getRestaurantOrThrow(restaurantId);
      const { isLateBooking } = validateAgainstClosingHours(restaurant, timeTo);

      // ✅ tìm bàn theo id + restaurantId (không cần ensureTableBelongsToRestaurant)
      const table = await getTableOrThrow(tableId, restaurantId);
      if (!table) {
        throw new GraphQLError("This restaurant doesn't have this table", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      await ensureTableAvailableForTime(tableId, timeTo);

      // ✅ userId chỉ dựa vào 3 trường từ FE
      const userId = await resolveUserIdFromContact({
        customerName,
        customerPhone,
        customerEmail,
      });

      const doc = new Reservation({
        restaurantId: toObjectId(restaurantId),
        tableId: toObjectId(tableId),
        userId,
        restaurantName: restaurant.name || "",

        timeTo: new Date(timeTo),
        partySize,
        note: note || "",
        customerName: customerName.trim(),
        customerPhone: customerPhone?.trim() || null,
        customerEmail: customerEmail?.trim() || null,
        depositAmount,
        depositStatus: depositAmount > 0 ? "pending" : "unpaid",
        status: depositAmount > 0 ? "pending_payment" : "confirmed",
      });

      const saved = await doc.save();
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

      const update = {};
      if (typeof partySize === "number" && partySize > 0)
        update.partySize = partySize;
      if (typeof note === "string") update.note = note;
      if (typeof customerName === "string")
        update.customerName = customerName.trim();
      if (typeof customerPhone === "string")
        update.customerPhone = customerPhone.trim();
      if (typeof customerEmail === "string")
        update.customerEmail = customerEmail.trim();

      if (timeTo) {
        const restaurant = await getRestaurantOrThrow(current.restaurantId);
        validateAgainstClosingHours(restaurant, timeTo);
        await ensureTableAvailableForTime(current.tableId, timeTo, current._id);
        update.timeTo = new Date(timeTo);
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

      // ✅ kiểm tra nhà hàng mục tiêu & giờ đóng cửa
      const restaurant = await getRestaurantOrThrow(targetRestaurantId);
      validateAgainstClosingHours(restaurant, current.timeTo);

      // ✅ bàn mới phải thuộc đúng restaurantId mục tiêu
      const newTable = await getTableOrThrow(newTableId, targetRestaurantId);

      // Bàn mới phải rảnh vào đúng timeTo hiện tại
      await ensureTableAvailableForTime(
        newTable._id,
        current.timeTo,
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
      // Giữ nguyên logic ghi chú & trạng thái chờ xác nhận
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

      const saved = await Reservation.findByIdAndUpdate(current._id, update, {
        new: true,
        runValidators: true,
      });

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
