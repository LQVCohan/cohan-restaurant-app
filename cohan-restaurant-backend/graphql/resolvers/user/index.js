import { User as UserModel } from "../../../models/index.js";
import { UserQuery } from "./query.js";
import { UserMutation } from "./mutation.js";
import { loginWithPendingVerification } from "./loginWithPendingVerification.mutation.js";
import User from "./types.js";
import customerAccountSecurity from "./customerAccountSecurity.js";
import customerArchive from "./customerArchive.js";

const changeMyPassword = async (root, args, ctx, info) => {
  const changed = await UserMutation.changeMyPassword(root, args, ctx, info);
  if (changed && ctx?.user?.id) {
    await UserModel.updateOne(
      { _id: ctx.user.id },
      { $set: { forcePasswordChange: false } },
    );
  }
  return changed;
};

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
    changeMyPassword,
    login: loginWithPendingVerification,
  },
  ...User,
};
