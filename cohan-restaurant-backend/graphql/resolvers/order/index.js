// src/graphql/order/index.js

import { OrderQuery } from "./query.js";
import { OrderMutation } from "./mutation.js";

export default {
  Query: {
    ...OrderQuery,
  },
  Mutation: {
    ...OrderMutation,
  },
};
