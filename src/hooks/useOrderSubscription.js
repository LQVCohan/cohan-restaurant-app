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

export default function useOrderSubscription(restaurantId) {
  const client = useApolloClient();

  useSubscription(ORDER_EVENTS_SUB, {
    skip: !restaurantId,
    variables: { restaurantId },
    onData: ({ data }) => {
      const evt = data?.data?.orderEvents;
      if (!evt?.order) return;
      console.log("[SUB] event received:", evt.type, "ID:", evt.order.id);

      const order = evt.order;

      client.cache.writeFragment({
        id: client.cache.identify({ __typename: "Order", id: order.id }),
        fragment: gql`
          fragment _OrderSubPatch on Order {
            id
            orderCode
            tableCode
            restaurantId
            orderType
            currentStatus
            note
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
            updatedAt
          }
        `,
        data: order,
      });
    },
    onError: (err) => {
      console.error("[SUB] error:", err);
    },
  });
}
