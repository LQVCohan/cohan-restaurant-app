// src/graphql/reservation/index.js

import { ReservationQuery } from "./query.js";
import { ReservationMutation } from "./mutation.js";
import { ReservationChangeReviewMutation } from "./changeReview.js";
import {
  ReservationCheckInMutation,
  withSafeReservationStatusMutation,
} from "./checkIn.js";

const ReviewReservationMutation = {
  ...ReservationMutation,
  ...ReservationChangeReviewMutation,
  ...ReservationCheckInMutation,
};

const SafeReservationMutation = withSafeReservationStatusMutation(ReviewReservationMutation);

export default {
  Query: {
    ...ReservationQuery,
  },
  Mutation: {
    ...SafeReservationMutation,
  },
};