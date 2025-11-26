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
};
