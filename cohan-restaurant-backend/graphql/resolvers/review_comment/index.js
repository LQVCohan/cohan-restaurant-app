import reviewCommentQuery from "./query.js";
import reviewCommentMutation from "./mutation.js";

export default {
  Query: {
    ...reviewCommentQuery,
  },
  Mutation: {
    ...reviewCommentMutation,
  },
};
