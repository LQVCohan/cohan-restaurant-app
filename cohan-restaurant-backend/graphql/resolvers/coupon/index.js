import { CouponQuery } from "./query.js";

const CouponResolvers = {
  Query: {
    ...(CouponQuery || {}),
  },
};

export default CouponResolvers;
