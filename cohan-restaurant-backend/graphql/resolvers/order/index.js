// src/graphql/order/index.js

import { OrderQuery } from "./query.js";
import { OrderMutation } from "./mutation.js";
import { OrderResolvers } from "./types.js";
import { OrderSubscription } from "./subscription.js";
export default {
  Query: {
    ...OrderQuery,
  },
  Mutation: {
    ...OrderMutation,
  },
  Subscription: {
    ...OrderSubscription,
  },
  ...OrderResolvers,
};
