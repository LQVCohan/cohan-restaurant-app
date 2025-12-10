import { OrderTracking } from "../../../models/index.js";
import { toId } from "../order/helper/index.js";

export const OrderTrackingQuery = {
  async orderTrackingByOrderId(_, { orderId }) {
    return OrderTracking.find({ orderId: toId(orderId) })
      .sort({ createdAt: 1 }) // timeline từ cũ đến mới
      .lean();
  },

  async orderTrackingByOrderCode(_, { restaurantId, orderCode }) {
    return OrderTracking.find({
      restaurantId: toId(restaurantId),
      orderCode: String(orderCode),
    })
      .sort({ createdAt: 1 })
      .lean();
  },
};

export default { OrderTrackingQuery };
