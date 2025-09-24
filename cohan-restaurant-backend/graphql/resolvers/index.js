// src/graphql/resolvers/index.js
import Query from "./query.js";
import Mutation from "./mutation.js";
import Restaurant from "./types/Restaurant.js";

export default {
  Query,
  Mutation,
  Restaurant,
  // Subscription resolvers sẽ cấu hình trong server (filter theo topic)
};
