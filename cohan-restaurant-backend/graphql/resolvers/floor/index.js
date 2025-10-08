import floorQueries from "./query.js";
import floorMutations from "./mutation.js";

export default {
  Query: {
    ...floorQueries,
  },
  Mutation: {
    ...floorMutations,
  },
};
