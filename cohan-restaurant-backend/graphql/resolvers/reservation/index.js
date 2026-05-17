// src/graphql/reservation/index.js

import { ReservationQuery } from "./query.js";
import { ReservationMutation } from "./mutation.js";
import { ReservationChangeReviewMutation } from "./changeReview.js";
import {
  ReservationCheckInMutation,
  withSafeReservationStatusMutation,
} from "./checkIn.js";
import { withReservationRealtimeEvents } from "./realtimeEvents.js";

const ReviewReservationMutation = {
  ...ReservationMutation,
  ...ReservationChangeReviewMutation,
  ...ReservationCheckInMutation,
};

const SafeReservationMutation = withSafeReservationStatusMutation(ReviewReservationMutation);
const RealtimeReservationMutation = withReservationRealtimeEvents(SafeReservationMutation);

export default {
  Query: {
    ...ReservationQuery,
  },
  Mutation: {
    ...RealtimeReservationMutation,
  },
};