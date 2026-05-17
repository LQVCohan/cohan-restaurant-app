// src/graphql/reservation/index.js

import { ReservationQuery } from "./query.js";
import { ReservationMutation } from "./mutation.js";
import { ReservationChangeReviewMutation } from "./changeReview.js";

export default {
  Query: {
    ...ReservationQuery,
  },
  Mutation: {
    ...ReservationMutation,
    ...ReservationChangeReviewMutation,
  },
};