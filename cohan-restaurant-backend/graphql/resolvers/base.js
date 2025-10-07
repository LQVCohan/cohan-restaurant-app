import { GraphQLDateTime } from "graphql-scalars";

export default {
  Date: GraphQLDateTime,
  Query: {
    _empty: () => "ok",
  },
  Mutation: {
    _empty: () => "ok",
  },
};
