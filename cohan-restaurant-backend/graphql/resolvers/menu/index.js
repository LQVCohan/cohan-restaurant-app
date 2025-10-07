// src/graphql/resolvers/menu/index.js
import { MenuQuery } from "./query.js";
import { MenuMutation } from "./mutation.js";
import Modifier from "./types.js";
export default {
  Query: { ...MenuQuery },
  Mutation: { ...MenuMutation },
  ...Modifier,
};
