import {
  cancelMenuAvailabilityWatch,
  registerMenuAvailabilityWatch,
} from "../../../src/services/menuAvailabilityWatch.service.js";

export const CartAvailabilityWatchMutation = {
  async registerMenuAvailabilityWatch(_, { input }, ctx) {
    return registerMenuAvailabilityWatch(input, ctx);
  },

  async cancelMenuAvailabilityWatch(_, { input }, ctx) {
    return cancelMenuAvailabilityWatch(input, ctx);
  },
};

export default CartAvailabilityWatchMutation;
