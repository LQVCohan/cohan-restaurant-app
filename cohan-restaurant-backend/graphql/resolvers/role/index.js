import { RoleQuery } from "./query.js";
import { RoleMutation } from "./mutation.js";
import Role from "./types.js";
export default {
  Query: { ...RoleQuery },
  Mutation: { ...RoleMutation },
  ...Role,
};
