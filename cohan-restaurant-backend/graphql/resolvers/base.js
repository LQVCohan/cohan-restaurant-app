import { GraphQLDateTime, GraphQLJSON } from "graphql-scalars";

export default {
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,
  Query: {
    _empty: () => "ok",
  },
  Mutation: {
    _empty: () => "ok",
  },
};
