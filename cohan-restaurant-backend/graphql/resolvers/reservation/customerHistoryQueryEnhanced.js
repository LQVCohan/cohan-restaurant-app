import { ReservationCustomerHistoryQuery } from "./customerHistory.js";
import { enrichCustomerReservations } from "./customerHistoryEnrichment.js";

export const ReservationCustomerHistoryEnhancedQuery = {
  async myReservations(parent, args, context, info) {
    const reservations = await ReservationCustomerHistoryQuery.myReservations(
      parent,
      args,
      context,
      info,
    );
    return enrichCustomerReservations(reservations);
  },
};
