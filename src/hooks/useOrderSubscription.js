import { gql, useSubscription, useApolloClient } from "@apollo/client";

const ORDER_EVENTS_SUB = gql`
  subscription OrderEvents($restaurantId: ID!) {
    orderEvents(restaurantId: $restaurantId) {
      type
      order {
        id
        orderCode
        tableCode
        restaurantId
        orderType
        currentStatus
        note
        user {
          id
          fullName
        }
        totals {
          subtotal
          discount
          tax
          service
          grandTotal
        }
        items {
          dishId
          menuId
          categoryId
          name
          unit
          price
          modifiersPrice
          method
          note
          quantity
          status
        }
        createdAt
        updatedAt
      }
    }
  }
`;

export default function useOrderSubscription(input) {
  const client = useApolloClient();

  // ✅ Tự động nhận cả object { restaurantId } hoặc string ID
  const restaurantId = typeof input === "object" ? input?.restaurantId : input;

  useSubscription(ORDER_EVENTS_SUB, {
    skip: !restaurantId,
    variables: { restaurantId },
    onData: ({ data }) => {
      const evt = data?.data?.orderEvents;
      if (!evt?.order) return;

      const order = evt.order;
      const type = evt.type;
      console.log("[SUB] event:", type, order.id);

      // Kiểm tra xem order đã có trong cache chưa
      const existing = client.cache.identify({
        __typename: "Order",
        id: order.id,
      });
      const cached = client.cache.readFragment({
        id: existing,
        fragment: gql`
          fragment CheckOrderExists on Order {
            id
          }
        `,
      });

      if (!cached) {
        console.log("[SUB] New order — adding to cache");
        try {
          // Ghi vào danh sách orders query (OrderManagement.jsx đang đọc từ đây)
          const dataInCache = client.readQuery({
            query: gql`
              query GetOrders($restaurantId: ID!) {
                orders(restaurantId: $restaurantId) {
                  id
                  orderCode
                  currentStatus
                  grandTotal
                  createdAt
                }
              }
            `,
            variables: { restaurantId },
          });

          client.writeQuery({
            query: gql`
              query GetOrders($restaurantId: ID!) {
                orders(restaurantId: $restaurantId) {
                  id
                  orderCode
                  currentStatus
                  grandTotal
                  createdAt
                }
              }
            `,
            variables: { restaurantId },
            data: {
              orders: [order, ...(dataInCache?.orders ?? [])],
            },
          });
        } catch (e) {
          console.warn("[SUB] Could not update GetOrders cache:", e.message);
        }
      } else {
        console.log("[SUB] Updating existing order:", order.id);
        client.cache.writeFragment({
          id: existing,
          fragment: gql`
            fragment UpdatedOrder on Order {
              id
              currentStatus
              updatedAt
            }
          `,
          data: {
            id: order.id,
            currentStatus: order.currentStatus,
            updatedAt: order.updatedAt,
          },
        });
      }
    },
  });
}
