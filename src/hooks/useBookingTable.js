// src/hooks/useBooking.js
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

const CREATE_RESERVATION = gql`
  mutation CreateReservation($input: CreateReservationInput!) {
    createReservation(input: $input) {
      id
      orderCode
      restaurantId
      restaurantName
      tableId
      userId
      timeTo
      durationMinutes
      isUnlimitedTime
      paymentMethod
      customerName
      customerPhone
      customerEmail
      partySize
      note
      linkedMenuSubtotal
      linkedMenuDiscount
      linkedMenuTotal
      linkedMenuPromotionIds
      depositAmount
      depositStatus
      status
      pendingPaymentExpiresAt
      createdAt
      updatedAt
    }
  }
`;

export function useBookingTable() {
  const [mutate, { loading, error }] = useMutation(CREATE_RESERVATION, {
    fetchPolicy: "no-cache",
  });

  const createBooking = async (input) => {
    const { data } = await mutate({ variables: { input } });
    return data?.createReservation || null;
  };

  return {
    createBooking,
    isLoading: loading,
    error,
  };
}
