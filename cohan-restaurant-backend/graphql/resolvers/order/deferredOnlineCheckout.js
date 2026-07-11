import { CheckoutSession, Order } from "../../../models/index.js";

const ONLINE_CHECKOUT_METHODS = new Set(["card"]);

export function withDeferredOnlineCheckout(mutation = {}) {
  return {
    ...mutation,
    async createCheckoutOrders(parent, args, ctx, info) {
      const requestedMethod = String(
        args?.input?.paymentMethod || "",
      ).toLowerCase();
      if (!ONLINE_CHECKOUT_METHODS.has(requestedMethod)) {
        return mutation.createCheckoutOrders.call(
          mutation,
          parent,
          args,
          ctx,
          info,
        );
      }

      // Reuse the existing deferred-payment transaction so inventory and kitchen
      // work are not released before the online provider confirms payment.
      const result = await mutation.createCheckoutOrders.call(
        mutation,
        parent,
        {
          ...args,
          input: {
            ...args.input,
            paymentMethod: "transfer",
          },
        },
        ctx,
        info,
      );

      const orderIds = [
        ...(result?.checkout?.orderIds || []),
        ...((result?.orders || []).map((order) => order?.id || order?._id)),
      ]
        .map(String)
        .filter(Boolean);
      const uniqueOrderIds = [...new Set(orderIds)];
      const checkoutCode = result?.checkout?.checkoutCode;

      if (uniqueOrderIds.length) {
        await Order.updateMany(
          { _id: { $in: uniqueOrderIds } },
          {
            $set: {
              "payment.method": requestedMethod,
              "payment.status": "pending",
              customerVisibleNote:
                "Đơn đang chờ xác nhận thanh toán trực tuyến.",
            },
          },
        );
      }
      if (checkoutCode) {
        await CheckoutSession.updateOne(
          { checkoutCode },
          {
            $set: {
              "payment.method": requestedMethod,
              "payment.status": "pending",
            },
          },
        );
      }

      for (const order of result?.orders || []) {
        order.payment = {
          ...(order.payment || {}),
          method: requestedMethod,
          status: "pending",
        };
        order.customerVisibleNote =
          "Đơn đang chờ xác nhận thanh toán trực tuyến.";
      }
      return result;
    },
  };
}

export default withDeferredOnlineCheckout;
