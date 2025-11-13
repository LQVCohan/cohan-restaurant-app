// src/graphql/order/subscription.js
export const OrderSubscription = {
  orderEvents: {
    subscribe: async (_, { restaurantId }, { pubsub, user }) => {
      console.log("[SUB] client subscribed", {
        restaurantId,
        user: user?.id || null,
      });

      // topic dựa theo restaurantId
      return pubsub.subscribe(`ORDER_EVENTS_${restaurantId}`);
    },
    resolve: (payload) => {
      console.log("[SUB] payload sent to client", payload?.type);
      return payload; // { type, order }
    },
  },
};
