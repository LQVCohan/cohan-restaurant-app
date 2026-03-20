import { gql, useQuery } from "@apollo/client";
import { useMemo } from "react";

const Q_TABLE_CUSTOMERS = gql`
  query TableCustomersByRestaurant($restaurantId: ID!) {
    tableCustomersByRestaurant(restaurantId: $restaurantId) {
      id
      restaurantId
      tableId
      tableCode
      customerName
      customerPhone
      customerEmail
      customerUserId
      note
      dietaryNotes
      customerPreferences
      partySize
      timeTo
      createdAt
      updatedAt
    }
  }
`;

export default function useTableCustomers({ restaurantId } = {}) {
  const { data, loading, error, refetch } = useQuery(Q_TABLE_CUSTOMERS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const customers = useMemo(
    () => data?.tableCustomersByRestaurant || [],
    [data]
  );

  return {
    customers,
    loading,
    error,
    refetch,
  };
}
