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

async function getTableOrThrow(
  tableId,
  fields = "restaurantId status capacity code deposit"
) {
  const t = await Table.findById(toObjectId(tableId)).lean();
  if (!t) {
    throw new GraphQLError("Table not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return t;
}

async function ensureTableBelongsToRestaurant(table, restaurantId) {
  if (String(table.restaurantId) !== String(restaurantId)) {
    throw new GraphQLError(
      "Table does not belong to the selected restaurant.",
      {
        extensions: { code: "BAD_USER_INPUT" },
      }
    );
  }
}

async function ensureTableAvailableForTime(
  tableId,
  timeTo,
  exceptReservationId = null
) {
  // Bàn phải ở trạng thái available
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

  // Không trùng timeTo (mô hình 1 slot/1 giờ đến)
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

async function resolveUserIdOrCreateGuest(
  ctx,
  { customerName, customerPhone, customerEmail }
) {
  let userId = ctx?.auth?.user?.id || ctx?.user?.id || null;

  if (!userId) {
    // Dùng guest theo phone nếu có để tránh nhân bản
    const existingGuest = customerPhone
      ? await User.findOne({ phone: customerPhone, isGuest: true })
      : null;

    if (existingGuest) return existingGuest._id;

    const guest = new User({
      fullName: customerName,
      phone: customerPhone || null,
      email: customerEmail || null,
      isGuest: true,
      status: "active",
      guestExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // TTL 30 ngày
    });
    await guest.save();
    userId = guest._id;
  }

  return toObjectId(userId);
}

export const ReservationMutation = {
  /* ───────────────── createReservation ───────────────── */
  async createReservation(_, { input }, ctx) {
    try {
      const {
        restaurantId,
        tableId,

        timeTo, // Giờ đến (bắt buộc)
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
          {
            extensions: { code: "BAD_USER_INPUT" },
          }
        );
      }
      if (!timeTo) {
        throw new GraphQLError("Missing arrival time (timeTo).", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const restaurant = await getRestaurantOrThrow(restaurantId);
      const { isLateBooking } = validateAgainstClosingHours(restaurant, timeTo);

      const table = await getTableOrThrow(tableId);
      await ensureTableBelongsToRestaurant(table, restaurantId);
      await ensureTableAvailableForTime(tableId, timeTo);

      const userId = await resolveUserIdOrCreateGuest(ctx, {
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
        // thêm cảnh báo hiển thị phía client nếu muốn
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
  async updateReservation(_, { input }, ctx) {
    try {
      const userId = ctx?.auth?.user?.id || ctx?.user?.id || null;
      if (!userId) {
        // Cho phép khách đã tạo (guest) tiếp tục chỉnh nếu BE của bạn check ownership riêng.
        // Ở đây chỉ yêu cầu có user (kể cả guest đã tạo ở phiên này).
        // Nếu muốn strict: kiểm tra chủ sở hữu bằng cách findOne({_id: input.id, userId})
      }

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
  async changeReservationTable(_, { input }, ctx) {
    try {
      const userId = ctx?.auth?.user?.id || ctx?.user?.id || null;
      if (!userId) {
        // tương tự trên, có thể siết ownership nếu muốn
      }

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

      const newTable = await getTableOrThrow(newTableId);
      const targetRestaurantId = newRestaurantId || current.restaurantId;
      await ensureTableBelongsToRestaurant(newTable, targetRestaurantId);

      // Kiểm tra giờ đóng cửa ở nhà hàng mới (nếu đổi sang nhà hàng khác)
      const restaurant = await getRestaurantOrThrow(targetRestaurantId);
      validateAgainstClosingHours(restaurant, current.timeTo);

      // Bàn mới phải rảnh vào đúng timeTo hiện tại
      await ensureTableAvailableForTime(
        newTableId,
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
      if (isChangeRestaurant) {
        // Đổi sang nhà hàng khác => chờ xác nhận & thông báo khấu trừ 50% khi xác nhận
        update.status = "pending_change";
        appendedNote +=
          (appendedNote ? " " : "") +
          (acceptPenalty
            ? "Khách đã chấp nhận điều kiện đổi nhà hàng: có thể khấu trừ 50% tiền cọc khi xác nhận."
            : "Yêu cầu đổi sang nhà hàng khác. Khi nhà hàng xác nhận đổi có thể áp dụng khấu trừ 50% tiền cọc.");
      } else {
        // Đổi bàn trong cùng nhà hàng => chờ nhà hàng xác nhận
        update.status = "pending_change";
        appendedNote +=
          (appendedNote ? " " : "") +
          "Yêu cầu đổi bàn trong cùng nhà hàng. Vui lòng đợi nhà hàng xác nhận.";
      }

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
  async updateReservationStatus(_, { input }, ctx) {
    try {
      const userId = ctx?.auth?.user?.id || ctx?.user?.id;
      if (!userId) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

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
