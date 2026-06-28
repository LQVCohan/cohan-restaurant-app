import { UserQuery } from "./query.js";
import { UserMutation } from "./mutation.js";
import { loginWithPendingVerification } from "./loginWithPendingVerification.mutation.js";
import User from "./types.js";
import customerAccountSecurity from "./customerAccountSecurity.js";

export default {
  Query: { ...UserQuery, ...customerAccountSecurity.Query },
  Mutation: { ...UserMutation, ...customerAccountSecurity.Mutation, login: loginWithPendingVerification },
  ...User,
};
