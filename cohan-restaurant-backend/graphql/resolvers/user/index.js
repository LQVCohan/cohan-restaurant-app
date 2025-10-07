import { UserQuery } from "./query.js";
import { UserMutation } from "./mutation.js";
import User from "./types.js";
export default {
  Query: { ...UserQuery },
  Mutation: { ...UserMutation },
  ...User,
};
