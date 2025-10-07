import { PermissionQuery } from "./query.js";
import { PermissionMutation } from "./mutation.js";
import Permission from "./types.js";
export default {
  Query: { ...PermissionQuery },
  Mutation: { ...PermissionMutation },
  ...Permission,
};
