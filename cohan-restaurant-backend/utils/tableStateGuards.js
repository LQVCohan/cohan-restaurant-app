import Order from "../models/order.model.js";
import Reservation from "../models/reservation.model.js";
import {
  INACTIVE_ORDER_STATUSES,
  activeTableSessionLookupFilter,
  withOrderBatchOrLegacyFilter,
} from "./orderLifecycle.js";

export const ACTIVE_RESERVATION_STATUSES = [
  "pending_payment",
  "confirmed",
  "seated",
  "pending_change",
];

export async function hasActiveOrdersForTable({ restaurantId, tableId, tableCode }) {
  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({ restaurantId, tableId, tableCode })
  )
    .select({ _id: 1 })
    .lean();

  if (activeSession?._id) return true;

  const activeLegacyOrBatchOrder = await Order.findOne(
    withOrderBatchOrLegacyFilter({
      restaurantId,
      tableId,
      currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    })
  )
    .select({ _id: 1 })
    .lean();

  return Boolean(activeLegacyOrBatchOrder?._id);
}

export async function hasActiveReservationsForTable({ restaurantId, tableId }) {
  const activeReservation = await Reservation.findOne({
    restaurantId,
    tableId,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
  })
    .select({ _id: 1 })
    .lean();

  return Boolean(activeReservation?._id);
}
