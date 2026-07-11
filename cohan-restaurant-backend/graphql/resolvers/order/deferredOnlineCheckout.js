import { CheckoutSession, Order } from "../../../models/index.js";
import { emitPaymentRealtime } from "../../../src/services/payment/paymentRealtime.service.js";
import { payOrdersWithWallet } from "../../../src/services/wallet/idempotentWalletPayment.service.js";

const ONLINE_CHECKOUT_METHODS = new Set(["card", "wallet"]);

const uniqueStrings = (values = []) => [
  ...new Set(values.map(String).filter(Boolean)),
];

function checkoutRestaurantIds(input = {}, result = {}) {
  const fromInput = uniqueStrings(
    (input?.items || []).map((item) => item?.restaurantId),
  );
  if (fromInput.length) return fromInput;
  return uniqueStrings(
    (result?.orders || []).map((order) => order?.restaurantId),
  );
}

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

      if (
        requestedMethod === "wallet" &&
        checkoutRestaurantIds(args?.input).length > 1
      ) {
        throw new Error(
          "Cohan wallet checkout only supports one restaurant at a time",
        );
      }

      // Reuse the existing deferred-payment transaction so inventory and kitchen
      // work are not released before either the provider or Cohan wallet confirms.
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

      if (requestedMethod !== "wallet") return result;

      const restaurantIds = checkoutRestaurantIds(args?.input, result);
      if (restaurantIds.length !== 1 || !uniqueOrderIds.length) {
        throw new Error(
          "Cohan wallet checkout requires orders from exactly one restaurant",
        );
      }
      const userId = ctx?.user?.id || ctx?.user?._id;
      if (!userId) throw new Error("Unauthorized");

      const walletPayment = await payOrdersWithWallet({
        userId,
        restaurantId: restaurantIds[0],
        orderIds: uniqueOrderIds,
        idempotencyKey: `${String(
          args?.input?.idempotencyKey || checkoutCode || uniqueOrderIds.join(":"),
        )}:wallet`,
      });
      if (!walletPayment?.ok || !walletPayment?.paymentTransactionId) {
        throw new Error("Cohan wallet payment was not completed");
      }

      if (checkoutCode) {
        await CheckoutSession.updateOne(
          { checkoutCode },
          {
            $set: {
              "payment.method": "wallet",
              "payment.status": "paid",
            },
          },
        );
      }

      for (const order of result?.orders || []) {
        order.payment = {
          ...(order.payment || {}),
          method: "e_wallet",
          provider: "cohan_wallet",
          status: "paid",
          paidAmount: Number(order?.totals?.grandTotal || 0),
          transactionId: walletPayment.paymentTransactionId,
        };
        if (["draft", "failed"].includes(String(order.currentStatus || ""))) {
          order.currentStatus = "pending";
        }
        order.customerVisibleNote = "Nhà hàng đã nhận đơn và đang xử lý.";
      }

      await emitPaymentRealtime({
        io: ctx?.io,
        payment: walletPayment.paymentSession,
        eventType: "PAYMENT_VERIFIED",
      });
      return result;
    },
  };
}

export default withDeferredOnlineCheckout;
