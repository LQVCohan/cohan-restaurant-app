import emailVerification from "./emailVerification.mutation.js";

export default {
  Mutation: {
    ...(emailVerification || {}),
  },
};
