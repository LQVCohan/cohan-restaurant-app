// src/resolvers/index.ts (ví dụ)
import { OrderQuery } from "./query.js";
import { payOrdersByTableId } from "./mutation.js";

export default {
  Query: {
    // ...các query khác
    ...OrderQuery,
  },
  Mutation: {
    // ...các mutation khác
    payOrdersByTableId,
  },
};
