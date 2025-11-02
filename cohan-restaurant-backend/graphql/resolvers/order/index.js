// src/graphql/order/index.js

import { OrderQuery } from "./query.js";
import { OrderMutation } from "./mutation.js";
import { OrderResolvers } from "./types.js";
export default {
  Query: {
    ...OrderQuery,
  },
  Mutation: {
    ...OrderMutation,
  },
  ...OrderResolvers,
};
