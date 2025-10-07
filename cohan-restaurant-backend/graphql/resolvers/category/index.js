// src/graphql/resolvers/menu/index.js
import { CategoryQuery } from "./query.js";
import { CategoryMutation } from "./mutation.js";
import Category from "./types.js";
export default {
  Query: { ...CategoryQuery },
  Mutation: { ...CategoryMutation },
  ...Category,
};
