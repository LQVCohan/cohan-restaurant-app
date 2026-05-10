import { gql } from "@apollo/client";
import { groupPaymentRequests } from "@/utils/paymentRequestGrouping";

const REQUESTED_PAYMENT_STATUSES = new Set([
  "payment_requested",
  "ready_to_pay",
]);

export const POS_PAYMENT_REQUESTS_QUERY = gql`
  query PosPaymentRequests($restaurantId: ID!, $limit: Int) {
    ordersByRestaurantNow(restaurantId: $restaurantId, limit: $limit) {
      edges {
        node {
          id
          orderCode
          tableCode
          orderType
          currentStatus
          totals {
            grandTotal
          }
          payment {
            status
            requestedAt
            requestedBy
            paidAt
            paidBy
          }
          customerInfo {
            name
            phone
            email
            note
            partySize
            timeTo
          }
          shipping {
            fullName
            phone
            address
            deliveryMethod
            deliveryTime
            scheduleDate
            scheduleTime
          }
        }
      }
    }
  }
`;

const hasRequestedPaymentStatus = (...statuses) =>
  statuses.some((status) =>
    REQUESTED_PAYMENT_STATUSES.has(String(status || "").toLowerCase()),
  );

export function normalizePosPaymentRequests(data) {
  const orders = (data?.ordersByRestaurantNow?.edges || [])
    .map((edge) => edge?.node)
    .filter(Boolean);

  return orders
    .filter((order) =>
      hasRequestedPaymentStatus(order?.payment?.status, order?.currentStatus),
    )
    .map((order) => ({
      orderId: order?.id || order?._id || null,
      orderCode: order?.orderCode || null,
      tableCode: order?.tableCode || null,
      orderType: order?.orderType || "dine_in",
      payment: order?.payment || null,
      totals: order?.totals || null,
      requestedAt: order?.payment?.requestedAt || null,
      customer: order?.customerInfo || null,
      shipping: order?.shipping || null,
    }))
    .filter((request) => request.orderId);
}

export function buildTablePaymentRequestMap(requests = []) {
  const grouped = groupPaymentRequests(requests);
  const map = new Map();

  grouped.forEach((group) => {
    if (!group?.isTableGroup || !group?.tableCode) return;
    map.set(String(group.tableCode).trim().toUpperCase(), group);
  });

  return map;
}
