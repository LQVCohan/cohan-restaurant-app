// src/graphql/reservation/index.js

import { ReservationQuery } from "./query.js";
import { ReservationMutation } from "./mutation.js";

export default {
  Query: {
    ...ReservationQuery,
  },
  Mutation: {
    ...ReservationMutation,
  },
};
