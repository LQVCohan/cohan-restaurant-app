import Order from "../../../models/order.model.js";
import { ShippingTracking } from "../../../models/index.js";

export const ShippingTrackingQuery = {
  async getOrderTracking(_, { orderId, restaurantId }) {
    const order = await Order.findOne({
      _id: orderId,
      restaurantId,
      orderType: "delivery",
    }).lean();

    if (!order) throw new Error("Delivery order not found");

    const events = await ShippingTracking.find({ orderId })
      .sort({ createdAt: -1 })
      .lean();

    return {
      orderId,
      orderCode: order.orderCode,
      deliveryStatus: order.shipping?.deliveryStatus,
      driverLocation: order.shipping?.driverLocation,
      customerLocation: order.shipping?.customerLocation,
      restaurantLocation: order.shipping?.restaurantLocation,
      eta: order.shipping?.eta,
      distance: order.shipping?.distance,
      duration: order.shipping?.duration,
      events,
    };
  },

  async getOrderTrackingEvents(_, { orderId }) {
    return ShippingTracking.find({ orderId }).sort({ createdAt: -1 }).lean();
  },
};
