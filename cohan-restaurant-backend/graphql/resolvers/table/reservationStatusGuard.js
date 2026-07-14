import { GraphQLError } from "graphql";
import Table from "../../../models/table.model.js";
import { getTableReservationSnapshot } from "../../../src/services/reservationTableTiming.service.js";

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

export function withReservationAwareTableStatus(mutation = {}) {
  const baseSetTableStatus = mutation.setTableStatus;
  if (typeof baseSetTableStatus !== "function") return mutation;

  return {
    ...mutation,
    async setTableStatus(parent, args, ctx, info) {
      const normalizedStatus = String(args?.input?.status || "")
        .trim()
        .toLowerCase();
      if (normalizedStatus !== "occupied") {
        return baseSetTableStatus.call(mutation, parent, args, ctx, info);
      }

      const table = await Table.findById(args?.input?.id).lean({ virtuals: true });
      if (table) {
        const snapshot = await getTableReservationSnapshot(table, ctx);
        assertReservationAwareOccupiedTransition(snapshot);
      }

      return baseSetTableStatus.call(mutation, parent, args, ctx, info);
    },
  };
}

export default withReservationAwareTableStatus;
