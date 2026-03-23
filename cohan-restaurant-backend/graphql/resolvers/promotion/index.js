import { PromotionQuery } from "./query.js";
import { PromotionMutation } from "./mutation.js";

const PromotionResolvers = {
  Query: {
    ...(PromotionQuery || {}),
  },
  Mutation: {
    ...(PromotionMutation || {}),
  },
};

export default PromotionResolvers;
