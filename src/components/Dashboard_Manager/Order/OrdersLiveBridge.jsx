// src/components/OrdersLiveBridge.jsx
import { useApolloClient, gql, useSubscription } from "@apollo/client";

const ORDER_EVENTS = gql`
  subscription OrderEvents($restaurantId: ID!) {
    orderEvents(restaurantId: $restaurantId) {
      type
      order {
        id
        orderCode
        currentStatus
        restaurantId
        tableCode
        updatedAt
      }
    }
  }
`;

export default function OrdersLiveBridge({ restaurantId }) {
  const client = useApolloClient();

  useSubscription(ORDER_EVENTS, {
    skip: !restaurantId,
    variables: { restaurantId },
    onData: async ({ data }) => {
      const evt = data?.data?.orderEvents;
      if (!evt?.type) return;
      console.log("[WS][ORDER_EVENTS]", evt.type, evt.order?.orderCode);

      // Cách nhanh & chắc: refetch các query list bạn đang dùng
      await client.refetchQueries({
        include: ["OrdersByRestaurantNow", "OrdersByRestaurant"],
      });

      // Hoặc viết tay vào cache nếu muốn mượt hơn (optional)
      client.cache.writeFragment({...});
    },
  });

  return null;
}
