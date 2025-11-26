// src/graphql/reviewCommentReaction/index.js
import reviewCommentReactionQuery from "./query.js";
import reviewCommentReactionMutation from "./mutation.js";

export default {
  Query: {
    ...reviewCommentReactionQuery,
  },
  Mutation: {
    ...reviewCommentReactionMutation,
  },
};
