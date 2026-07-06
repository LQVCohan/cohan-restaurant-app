import { UserQuery } from "./query.js";
import { UserMutation } from "./mutation.js";
import { loginWithPendingVerification } from "./loginWithPendingVerification.mutation.js";
import User from "./types.js";
import customerAccountSecurity from "./customerAccountSecurity.js";
import customerArchive from "./customerArchive.js";

export default {
  Query: {
    ...UserQuery,
    ...customerAccountSecurity.Query,
    ...customerArchive.Query,
  },
  Mutation: {
    ...UserMutation,
    ...customerAccountSecurity.Mutation,
    ...customerArchive.Mutation,
    login: loginWithPendingVerification,
  },
  ...User,
};
