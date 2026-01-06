// src/graphql/reservation/query.js
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Reservation } from "../../../models/index.js";

function badInput(msg) {
  return new GraphQLError(msg, { extensions: { code: "BAD_USER_INPUT" } });
}
function unauth(msg = "Unauthorized") {
  return new GraphQLError(msg, { extensions: { code: "UNAUTHENTICATED" } });
}

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw badInput("Invalid ID");
  }
  return new mongoose.Types.ObjectId(id);
}

export const ReservationQuery = {
  /** Lấy 1 reservation theo id */
  async reservation(_, { id }) {
    if (id) {
      if (!mongoose.isValidObjectId(id)) throw badInput("Invalid ID");
      return Reservation.findById(id).lean({ virtuals: true });
    }
    return null;
  },

  /** Danh sách reservation của user đang đăng nhập (cursor = _id cũ hơn) */
  async myReservations(_, { limit = 20, cursor }, ctx) {
    const userId = ctx?.auth?.user?.id || ctx?.user?.id;
    if (!userId) throw unauth();

    const f = { userId: toObjectId(userId) };
    if (cursor && mongoose.isValidObjectId(cursor)) {
      f._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    return Reservation.find(f)
      .sort({ _id: -1 })
      .limit(limit)
      .lean({ virtuals: true });
  },

  /**
   * Reservation đã xác nhận (hoặc đang chờ thanh toán) gắn với 1 bàn
   * Dùng cho UI khi bàn ở trạng thái "reserved".
   * Ưu tiên bản ghi có timeTo gần hiện tại/ tương lai; fallback lấy gần nhất.
   */
  async confirmedReservationByTable(_, { restaurantId, tableId }) {
    if (!restaurantId || !tableId)
      throw badInput("restaurantId and tableId are required");

    const rId = toObjectId(restaurantId);
    const tId = toObjectId(tableId);

    // Các trạng thái coi như còn hiệu lực giữ bàn
    const activeStatuses = ["pending_payment", "confirmed", "seated"];

    const now = new Date();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // 1) Ưu tiên reservation còn hiệu lực và khung giờ >= now - 2h (để không bỏ sót vừa tới nơi)
    let doc = await Reservation.findOne({
      restaurantId: rId,
      tableId: tId,
      status: { $in: activeStatuses },
      timeTo: { $gte: twoHoursAgo },
    })
      .sort({ timeTo: 1, _id: 1 })
      .lean({ virtuals: true });

    // 2) Fallback: nếu không có, lấy reservation active gần nhất (tránh null khi BE/FE vừa cập nhật)
    if (!doc) {
      doc = await Reservation.findOne({
        restaurantId: rId,
        tableId: tId,
        status: { $in: activeStatuses },
      })
        .sort({ timeTo: -1, _id: -1 })
        .lean({ virtuals: true });
    }

    return doc || null;
  },
};
