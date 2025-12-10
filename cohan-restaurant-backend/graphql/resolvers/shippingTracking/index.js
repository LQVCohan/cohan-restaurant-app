import { ShippingTrackingQuery } from "./query.js";
import { ShippingTrackingMutation } from "./mutation.js";

// Không có type-level resolvers đặc biệt nên export rỗng
export default {
  Query: {
    ...ShippingTrackingQuery,
  },

  Mutation: {
    ...ShippingTrackingMutation,
  },

  // Không có custom object resolvers
  ShippingTrackingEvent: {},
  TrackingLocation: {},
};
