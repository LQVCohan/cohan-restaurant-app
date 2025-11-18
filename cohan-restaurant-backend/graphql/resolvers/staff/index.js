import staffQuery from "./query.js";
import staffMutation from "./mutation.js";
const resolvers = {
  Query: {
    ...staffQuery,
    // ... các Query khác
  },
  Mutation: {
    ...staffMutation,
    // ... các Mutation khác
  },
};

export default resolvers;
