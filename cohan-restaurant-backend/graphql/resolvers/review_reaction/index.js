// src/graphql/reviewReaction/index.js
import reviewReactionQuery from "./query.js";
import reviewReactionMutation from "./mutation.js";

export default {
  Query: {
    ...reviewReactionQuery,
  },
  Mutation: {
    ...reviewReactionMutation,
  },
};
