import { GraphQLError } from "graphql";
import Reservation from "../../../models/reservation.model.js";
import Table from "../../../models/table.model.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { releaseReservationSlot } from "../../../src/services/reservationAvailability.service.js";
import { getTableReservationSnapshot } from "../../../src/services/reservationTableTiming.service.js";
import {
  closeEmptyTableSessionForTable,
  hasActiveOrdersForTable,
} from "../../../utils/tableStateGuards.js";

const DIRECT_OCCUPANCY_BLOCKING_RESERVATION_STATUSES = new Set([
  "confirmed",
  "pending_change",
]);

export function assertReservationAwareOccupiedTransition(snapshot) {
  if (!snapshot?.reservationId) return;
  const reservationStatus = String(snapshot.reservationStatus || "").toLowerCase();
  if (!DIRECT_OCCUPANCY_BLOCKING_RESERVATION_STATUSES.has(reservationStatus)) {
    return;
  }

  throw new GraphQLError(
    "Bàn đang được giữ cho khách đặt. Hãy dùng thao tác Nhận khách/check-in để mở bàn đúng lịch.",
    {
      extensions: {
        code: "TABLE_RESERVED_REQUIRES_CHECK_IN",
        reservationId: snapshot.reservationId,
        reservationOrderCode: snapshot.reservationOrderCode || null,
        reservationTime: snapshot.nextReservationAt || null,
        earliestCheckInAt: snapshot.reservationEarliestCheckInAt || null,
        reservationCanCheckIn: snapshot.reservationCanCheckIn === true,
      },
    },
  );
}

export async function completeReservationOnlyTable(table) {
  const restaurantId = table?.restaurantId;
  const tableId = table?._id || table?.id;
  if (!restaurantId || !tableId) return false;

  await closeEmptyTableSessionForTable({
    restaurantId,
    tableId,
    tableCode: table?.code,
  });

  const stillHasActiveOrder = await hasActiveOrdersForTable({
    restaurantId,
    tableId,
    tableCode: table?.code,
  });
  if (stillHasActiveOrder) return false;

  const seatedReservations = await Reservation.find({
    restaurantId,
    tableId,
    status: "seated",
  })
    .select({ _id: 1 })
    .lean();

  if (!seatedReservations.length) return false;

  const reservationIds = seatedReservations.map((reservation) => reservation._id);
  const updateResult = await Reservation.updateMany(
    {
      _id: { $in: reservationIds },
      status: "seated",
    },
    { $set: { status: "completed" } },
  );

  await Promise.all(
    reservationIds.map((reservationId) =>
      releaseReservationSlot({ reservationId }).catch(() => null),
    ),
  );

  return Number(updateResult?.modifiedCount || 0) > 0;
}

export function withReservationAwareTableStatus(mutation = {}) {
  const baseSetTableStatus = mutation.setTableStatus;
  if (typeof baseSetTableStatus !== "function") return mutation;

  return {
    ...mutation,
    async setTableStatus(parent, args, ctx, info) {
      const normalizedStatus = String(args?.input?.status || "")
        .trim()
        .toLowerCase();
      if (!["available", "occupied"].includes(normalizedStatus)) {
        return baseSetTableStatus.call(mutation, parent, args, ctx, info);
      }

      const table = await Table.findById(args?.input?.id).lean({ virtuals: true });
      if (!table) {
        return baseSetTableStatus.call(mutation, parent, args, ctx, info);
      }

      if (normalizedStatus === "available") {
        await requireRestaurantPermission(
          ctx,
          table.restaurantId,
          PERMISSIONS.TABLE_WRITE,
        );
        await completeReservationOnlyTable(table);
        return baseSetTableStatus.call(mutation, parent, args, ctx, info);
      }

      const snapshot = await getTableReservationSnapshot(table, ctx);
      assertReservationAwareOccupiedTransition(snapshot);

      return baseSetTableStatus.call(mutation, parent, args, ctx, info);
    },
  };
}

export default withReservationAwareTableStatus;
