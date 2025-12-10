// src/graphql/queries/orderTracking.queries.js
import { gql } from "@apollo/client";

export const GET_ORDER_TRACKING = gql`
  query GetOrderTracking($orderId: ID!, $restaurantId: ID!) {
    getOrderTracking(orderId: $orderId, restaurantId: $restaurantId) {
      orderId
      orderCode
      deliveryStatus

      driverLocation {
        lat
        lng
        address
        updatedAt
      }
      customerLocation {
        lat
        lng
        address
        updatedAt
      }
      restaurantLocation {
        lat
        lng
        address
        updatedAt
      }

      eta
      distance
      duration

      events {
        id
        type
        message
        createdAt
        data
      }
    }
  }
`;
