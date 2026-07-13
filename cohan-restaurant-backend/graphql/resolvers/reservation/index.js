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
import { ReservationCustomerHistoryEnhancedQuery } from "./customerHistoryQueryEnhanced.js";
import { withCustomerReservationPolicy } from "./customerReservationPolicy.js";
import {
  ReservationCheckInMutation,
  withSafeReservationStatusMutation,
} from "./checkIn.js";
import { withReservationRealtimeEvents } from "./realtimeEvents.js";
import { withReservationTableTimingPolicy } from "../../../src/services/reservationTableTiming.service.js";

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

function deriveReservationDepositBreakdown(reservation = {}) {
  const total = Math.max(0, Number(reservation.depositAmount || 0));
  const storedMenu = Math.max(0, Number(reservation.menuDepositAmount || 0));
  const storedTable = Math.max(0, Number(reservation.tableDepositAmount || 0));
  const storedBreakdownIsComplete =
    total === 0 || Math.abs(storedMenu + storedTable - total) < 0.5;

  if (storedBreakdownIsComplete) {
    return {
      total,
      table: Math.min(total, storedTable),
      menu: Math.min(total, storedMenu),
    };
  }

  const menu = Math.min(
    total,
    Math.max(0, Math.round(Number(reservation.linkedMenuSubtotal || 0) * 0.5)),
  );
  return {
    total,
    table: Math.max(0, total - menu),
    menu,
  };
}

const ReservationType = {
  tableDepositAmount(parent) {
    return deriveReservationDepositBreakdown(parent).table;
  },
  menuDepositAmount(parent) {
    return deriveReservationDepositBreakdown(parent).menu;
  },
  depositAppliedAmount(parent) {
    return Math.max(0, Number(parent?.depositAppliedAmount || 0));
  },
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
const CustomerSafeReservationMutation = withCustomerReservationPolicy(SafeReservationMutation);
const RealtimeReservationMutation = withReservationRealtimeEvents(CustomerSafeReservationMutation);
const TimedReservationMutation = withReservationTableTimingPolicy(RealtimeReservationMutation);
const ReservationMutationWithAliases = {
  ...TimedReservationMutation,
  markReservationNoShow: TimedReservationMutation.deleteReservation,
};

export default {
  Reservation: ReservationType,
  Query: {
    ...ReservationQuery,
    ...ReservationCustomerHistoryQuery,
    ...ReservationCustomerHistoryEnhancedQuery,
  },
  Mutation: {
    ...ReservationMutationWithAliases,
    ...ReservationCustomerHistoryMutation,
  },
};
