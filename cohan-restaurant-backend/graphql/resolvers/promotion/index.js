import { PromotionQuery } from "./query.js";

const PromotionResolvers = {
  Query: {
    ...(PromotionQuery || {}),
  },
};

export default PromotionResolvers;
