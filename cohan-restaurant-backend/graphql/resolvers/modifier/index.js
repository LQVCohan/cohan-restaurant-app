// src/graphql/resolvers/modifier/index.js
import { ModifierQuery } from "./query.js";
import { ModifierMutation } from "./mutation.js";

export default {
  Query: { ...ModifierQuery },
  Mutation: { ...ModifierMutation },
};
