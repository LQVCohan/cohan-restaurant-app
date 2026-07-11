import {
  cancelMenuAvailabilityWatch,
  registerMenuAvailabilityWatch,
} from "../../../src/services/menuAvailabilityWatch.service.js";
import { registerTableAvailabilityWatch } from "../../../src/services/tableAvailabilityWatch.service.js";

export const CartAvailabilityWatchMutation = {
  async registerMenuAvailabilityWatch(_, { input }, ctx) {
    return registerMenuAvailabilityWatch(input, ctx);
  },

  async cancelMenuAvailabilityWatch(_, { input }, ctx) {
    return cancelMenuAvailabilityWatch(input, ctx);
  },

  async registerTableAvailabilityWatch(_, { input }, ctx) {
    return registerTableAvailabilityWatch(input, ctx);
  },
};

export default CartAvailabilityWatchMutation;
