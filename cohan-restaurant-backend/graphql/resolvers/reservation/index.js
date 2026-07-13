// src/graphql/reservation/index.js

import { ReservationQuery } from "./query.js";
import { PaymentSession, PaymentTransaction } from "../../../models/index.js";
import { ReservationMutation } from "./mutation.js";
import { createManagerReservation } from "./managerCreateReservation.js";
import { withManagerReservationCreation } from "./managerCreationPolicy.js";
import { ReservationChangeReviewMutation } from "./changeReview.js";
import {
  ReservationCustomerHistoryMutation,
  ReservationCustomerHistoryQuery,
} from "./customerHistory.js";
import {
  ReservationCheckInMutation,
  withSafeReservationStatusMutation,
} from "./checkIn.js";
import { withReservationRealtimeEvents } from "./realtimeEvents.js";

async function findLatestDepositSession(reservation) {
  const reservationId = reservation?._id || reservation?.id;
  if (!reservationId) return null;

  return PaymentSession.findOne({ reservationId })
    .sort({ callbackAt: -1, reconciledAt: -1, createdAt: -1 })
    .lean();
}

async function findDepositTransaction(reservation) {
  if (!reservation?.depositTxnId) return null;
  return PaymentTransaction.findById(reservation.depositTxnId).lean();
}

const ReservationType = {
  async depositPaidAt(parent) {
    const transaction = await findDepositTransaction(parent);
    if (transaction?.paidAt) return transaction.paidAt;

    const session = await findLatestDepositSession(parent);
    return session?.callbackAt || session?.reconciledAt || null;
  },
  async depositPaymentProvider(parent) {
    const session = await findLatestDepositSession(parent);
    return session?.provider || null;
  },
  async depositPaymentMethod(parent) {
    const session = await findLatestDepositSession(parent);
    return session?.paymentMethod || parent?.paymentMethod || null;
  },
  async depositPaymentReference(parent) {
    const session = await findLatestDepositSession(parent);
    return session?.reference || parent?.paymentReference || null;
  },
  async depositProviderTransactionId(parent) {
    const session = await findLatestDepositSession(parent);
    return session?.providerTransactionId || null;
  },
};

const ManagerAwareReservationMutation = withManagerReservationCreation(
  ReservationMutation,
  createManagerReservation,
);

const ReviewReservationMutation = {
  ...ManagerAwareReservationMutation,
  ...ReservationChangeReviewMutation,
  ...ReservationCheckInMutation,
};

const SafeReservationMutation = withSafeReservationStatusMutation(ReviewReservationMutation);
const RealtimeReservationMutation = withReservationRealtimeEvents(SafeReservationMutation);
const ReservationMutationWithAliases = {
  ...RealtimeReservationMutation,
  markReservationNoShow: RealtimeReservationMutation.deleteReservation,
};

export default {
  Reservation: ReservationType,
  Query: {
    ...ReservationQuery,
    ...ReservationCustomerHistoryQuery,
  },
  Mutation: {
    ...ReservationMutationWithAliases,
    ...ReservationCustomerHistoryMutation,
  },
};
