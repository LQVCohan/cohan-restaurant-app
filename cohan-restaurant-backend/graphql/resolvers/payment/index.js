// src/resolvers/index.ts (ví dụ)
import { OrderQuery } from "./query.js";
import { payOrder } from "./mutation.js";

export default {
  Query: {
    // ...các query khác
    ...OrderQuery,
  },
  Mutation: {
    // ...các mutation khác
    payOrder,
  },
};
