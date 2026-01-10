// graphql/resolvers/order/helper/userUtils.js
import mongoose from "mongoose";
import { Customer, Table } from "../../../../models/index.js";
import { toId } from "./orderUtils.js";

export async function ensureUserForOrder(userId, customer) {
  if (userId) return userId;
  const phone = customer?.phone?.trim();
  const email = customer?.email?.trim()?.toLowerCase();
  const fullName = customer?.fullName?.trim();

  if (phone) {
    const foundByPhone = await Customer.findOne({ phone, isGuest: true }).select(
      "_id"
    );
    if (foundByPhone) return foundByPhone._id;
  }

  if (email) {
    const foundByEmail = await Customer.findOne({ email, isGuest: true }).select(
      "_id"
    );
    if (foundByEmail) return foundByEmail._id;
  }

  const guest = new Customer({
    fullName: fullName || "Guest",
    phone,
    email,
    isGuest: true,
    status: "active",
    guestExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  await guest.save();
  return guest._id;
}

export async function resolveTable(restaurantId, { tableId, tableCode }) {
  let table = null;
  if (tableId && mongoose.isValidObjectId(tableId)) {
    table = await Table.findOne(
      { _id: toId(tableId), restaurantId: toId(restaurantId) },
      { _id: 1, code: 1 }
    ).lean();
  } else if (tableCode) {
    table = await Table.findOne(
      { restaurantId: toId(restaurantId), code: tableCode },
      { _id: 1, code: 1 }
    ).lean();
  }
  if (!table) throw new Error("Table not found");
  return { tableId: String(table._id), tableCode: table.code };
}
