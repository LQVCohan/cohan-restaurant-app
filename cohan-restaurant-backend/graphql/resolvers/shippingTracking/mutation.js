// src/graphql/resolvers/shipping_tracking/mutation.js
import { Order } from "../../../models/index.js";
import { emitOrderEvent, toId } from "../order/helper/index.js";
import { createOrderTrackingEvent } from "../order/helper/tracking.js";
import { requireRestaurantAccess } from "../../guards.js";


function requireValidRestaurantId(restaurantId) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  return rid;
}

export const ShippingTrackingMutation = {
  /** DRIVER UPDATE LOCATION (real-time) */
  async updateDriverLocation(_, { input }, ctx) {
    const {
      orderId,
      restaurantId,
      lat,
      lng,
      accuracy,
      speed,
      bearing,
      address,
    } = input || {};

    const rid = requireValidRestaurantId(restaurantId);
    await requireRestaurantAccess(ctx, rid);

    const order = await Order.findOne({
      _id: toId(orderId),
      restaurantId: rid,
      orderType: "delivery",
    });
    if (!order) throw new Error("Order not found");

    order.shipping = order.shipping || {};
    order.shipping.driverLocation = {
      lat,
      lng,
      accuracy: accuracy ?? null,
      speed: speed ?? null,
      bearing: bearing ?? null,
      address: address || null,
      updatedAt: new Date(),
    };

    await order.save();

    // Log vào OrderTracking (event shipping_updated)
    await createOrderTrackingEvent({
      order,
      restaurantId: order.restaurantId,
      eventType: "shipping_updated",
      ctx,
      payload: {
        shippingStatusFrom: order.shipping.deliveryStatus || null,
        shippingStatusTo: order.shipping.deliveryStatus || null,
        note: "Driver location updated",
        driverLocation: order.shipping.driverLocation,
      },
    });

    // Socket cho phía nhà hàng (bếp / quản lý)
    await emitOrderEvent(ctx, order.restaurantId, "DRIVER_LOCATION_UPDATED", {
      order,
      meta: {
        driverLocation: order.shipping.driverLocation,
      },
    });

    // Nếu muốn báo luôn cho khách: emit room riêng theo orderCode
    if (ctx?.io && order.orderCode) {
      const room = `order_${order.orderCode}`;
      ctx.io.to(room).emit("orderCustomerEvents", {
        type: "DRIVER_LOCATION_UPDATED",
        order: order.toJSON(),
        meta: {
          driverLocation: order.shipping.driverLocation,
        },
      });
    }

    return true;
  },

  /** UPDATE DELIVERY STATUS (picked_up / delivering / delivered / cancelled, ...) */
  async updateDeliveryStatus(_, { input }, ctx) {
    const { orderId, restaurantId, status, message } = input || {};

    const rid = requireValidRestaurantId(restaurantId);
    await requireRestaurantAccess(ctx, rid);

    const order = await Order.findOne({
      _id: toId(orderId),
      restaurantId: rid,
      orderType: "delivery",
    });
    if (!order) throw new Error("Delivery order not found");

    order.shipping = order.shipping || {};
    const prev = order.shipping.deliveryStatus || "pending";
    order.shipping.deliveryStatus = status;

    await order.save();

    // Log OrderTracking
    await createOrderTrackingEvent({
      order,
      restaurantId: order.restaurantId,
      eventType: "shipping_updated",
      ctx,
      payload: {
        shippingStatusFrom: prev,
        shippingStatusTo: status,
        note: message || `Delivery status: ${prev} → ${status}`,
      },
    });

    // Socket cho nhà hàng
    await emitOrderEvent(ctx, order.restaurantId, "DELIVERY_STATUS_UPDATED", {
      order,
      meta: {
        statusFrom: prev,
        statusTo: status,
        message,
      },
    });

    // Socket cho khách (nếu cần)
    if (ctx?.io && order.orderCode) {
      const room = `order_${order.orderCode}`;
      ctx.io.to(room).emit("orderCustomerEvents", {
        type: "DELIVERY_STATUS_UPDATED",
        order: order.toJSON(),
        meta: {
          statusFrom: prev,
          statusTo: status,
          message,
        },
      });
    }

    return true;
  },

  /** UPDATE ETA / DISTANCE / DURATION */
  async updateDeliveryETA(_, { input }, ctx) {
    const { orderId, restaurantId, eta, distance, duration } = input || {};

    const rid = requireValidRestaurantId(restaurantId);
    await requireRestaurantAccess(ctx, rid);

    const order = await Order.findOne({
      _id: toId(orderId),
      restaurantId: rid,
      orderType: "delivery",
    });
    if (!order) throw new Error("Delivery order not found");

    order.shipping = order.shipping || {};

    if (eta !== undefined && eta !== null) {
      order.shipping.eta = new Date(eta);
    }
    if (distance !== undefined) {
      order.shipping.distance = distance;
    }
    if (duration !== undefined) {
      order.shipping.duration = duration;
    }

    await order.save();

    await createOrderTrackingEvent({
      order,
      restaurantId: order.restaurantId,
      eventType: "shipping_updated",
      ctx,
      payload: {
        eta: order.shipping.eta,
        distance: order.shipping.distance,
        duration: order.shipping.duration,
      },
    });

    await emitOrderEvent(ctx, order.restaurantId, "DELIVERY_ETA_UPDATED", {
      order,
      meta: {
        eta: order.shipping.eta,
        distance: order.shipping.distance,
        duration: order.shipping.duration,
      },
    });

    if (ctx?.io && order.orderCode) {
      const room = `order_${order.orderCode}`;
      ctx.io.to(room).emit("orderCustomerEvents", {
        type: "DELIVERY_ETA_UPDATED",
        order: order.toJSON(),
        meta: {
          eta: order.shipping.eta,
          distance: order.shipping.distance,
          duration: order.shipping.duration,
        },
      });
    }

    return true;
  },

  /**
   * 🚴 SHIPPER NHẬN ĐƠN / ASSIGN DRIVER
   * - Cập nhật thông tin tài xế
   * - Đẩy deliveryStatus = driver_assigned
   * - Log OrderTracking
   * - Bắn socket cho nhà hàng + khách
   */
  async assignDriverToOrder(_, { input }, ctx) {
    const {
      orderId,
      restaurantId,
      driverId,
      driverName,
      driverPhone,
      driverAvatar,
      driverVehiclePlate,
      channel,
    } = input || {};

    const rid = requireValidRestaurantId(restaurantId);
    await requireRestaurantAccess(ctx, rid);

    const order = await Order.findOne({
      _id: toId(orderId),
      restaurantId: rid,
      orderType: "delivery",
    });
    if (!order) throw new Error("Delivery order not found");

    order.shipping = order.shipping || {};

    const prevStatus = order.shipping.deliveryStatus || "pending";
    const newStatus = "driver_assigned";

    order.shipping.driverName = driverName || order.shipping.driverName || null;
    order.shipping.driverPhone =
      driverPhone || order.shipping.driverPhone || null;
    order.shipping.driverAvatar =
      driverAvatar || order.shipping.driverAvatar || null;
    order.shipping.driverVehiclePlate =
      driverVehiclePlate || order.shipping.driverVehiclePlate || null;
    order.shipping.deliveryStatus = newStatus;

    await order.save();

    // Log OrderTracking chi tiết
    await createOrderTrackingEvent({
      order,
      restaurantId: order.restaurantId,
      eventType: "shipping_updated",
      ctx,
      payload: {
        shippingStatusFrom: prevStatus,
        shippingStatusTo: newStatus,
        note: "Driver assigned to delivery order",
        driverId: driverId || null,
        driverName: order.shipping.driverName,
        driverPhone: order.shipping.driverPhone,
        driverVehiclePlate: order.shipping.driverVehiclePlate,
        channel: channel || "system",
      },
    });

    // Socket cho phía nhà hàng
    await emitOrderEvent(ctx, order.restaurantId, "DELIVERY_DRIVER_ASSIGNED", {
      order,
      meta: {
        statusFrom: prevStatus,
        statusTo: newStatus,
        driverId: driverId || null,
        driverName: order.shipping.driverName,
        driverPhone: order.shipping.driverPhone,
        driverVehiclePlate: order.shipping.driverVehiclePlate,
      },
    });

    // Socket cho phía khách hàng (sau này trang khách join room này)
    if (ctx?.io && order.orderCode) {
      const room = `order_${order.orderCode}`;
      ctx.io.to(room).emit("orderCustomerEvents", {
        type: "DELIVERY_DRIVER_ASSIGNED",
        order: order.toJSON(),
        meta: {
          statusFrom: prevStatus,
          statusTo: newStatus,
          driverId: driverId || null,
          driverName: order.shipping.driverName,
          driverPhone: order.shipping.driverPhone,
          driverVehiclePlate: order.shipping.driverVehiclePlate,
        },
      });
    }

    return true;
  },
};
