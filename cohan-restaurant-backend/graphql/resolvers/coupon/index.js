import { CouponQuery } from "./query.js";
import { CouponMutation } from "./mutation.js";

const CouponResolvers = {
  Query: {
    ...(CouponQuery || {}),
  },
  Mutation: {
    ...(CouponMutation || {}),
  },
};

export default CouponResolvers;
