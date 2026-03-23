// src/graphql/reviews/index.js

import reviewQuery from "./query.js";
import reviewMutation from "./mutation.js";

export default {
  Query: {
    ...reviewQuery,
  },
  Mutation: {
    ...reviewMutation,
  },
  ReactionSummary: {
    total: (parent = {}) =>
      ["like", "love", "care", "haha", "wow", "sad", "angry"].reduce(
        (sum, key) => sum + Number(parent?.[key] || 0),
        0,
      ),
  },
};
