import {
  OrderCoreRecoveryQuery as LegacyOrderCoreRecoveryQuery,
} from "./queryCoreRecoveryLegacy.js";

const isPaidOrder = (order) => {
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  const orderPaymentStatus = String(
    order?.orderPaymentStatus || "",
  ).toLowerCase();

  return paymentStatus === "paid" || orderPaymentStatus === "paid";
};

const filterActiveOrders = (orders = []) =>
  (Array.isArray(orders) ? orders : []).filter(
    (order) => !isPaidOrder(order),
  );

async function activeTableSessionOrders(parent, args, ctx, info) {
  const result = await LegacyOrderCoreRecoveryQuery.activeTableSessionOrders(
    parent,
    args,
    ctx,
    info,
  );

  return {
    ...result,
    orders: filterActiveOrders(result?.orders),
  };
}

async function ordersGroupedByTable(parent, args, ctx, info) {
  const groups = await LegacyOrderCoreRecoveryQuery.ordersGroupedByTable(
    parent,
    args,
    ctx,
    info,
  );

  return (Array.isArray(groups) ? groups : [])
    .map((group) => {
      const orders = filterActiveOrders(group?.orders);
      return {
        ...group,
        orders,
        count: orders.length,
        latestStatus:
          orders[orders.length - 1]?.currentStatus ||
          group?.latestStatus ||
          null,
      };
    })
    .filter((group) => group.orders.length > 0);
}

async function ordersByRestaurantNow(parent, args, ctx, info) {
  const result = await LegacyOrderCoreRecoveryQuery.ordersByRestaurantNow(
    parent,
    args,
    ctx,
    info,
  );

  return {
    ...result,
    edges: (Array.isArray(result?.edges) ? result.edges : []).filter(
      (edge) => !isPaidOrder(edge?.node),
    ),
  };
}

export const OrderCoreRecoveryQuery = {
  ...LegacyOrderCoreRecoveryQuery,
  activeTableSessionOrders,
  ordersGroupedByTable,
  ordersByRestaurantNow,
};
