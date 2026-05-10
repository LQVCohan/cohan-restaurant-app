import { Order } from "../../../models/index.js";
import {
  clearPaymentRequestAfterNewChildOrderBatchCreated,
} from "../../../utils/orderLifecycle.js";

const STALE_PAYMENT_REQUEST_CLEAR_REASON =
  "Thêm món mới sau khi khách yêu cầu thanh toán.";

export function withTablePaymentRequestLifecycle(orderMutation) {
  return {
    ...orderMutation,

    async createOrderForTable(parent, args, ctx, info) {
      const result = await orderMutation.createOrderForTable.call(
        this,
        parent,
        args,
        ctx,
        info,
      );

      const createdOrder = result?.order;
      if (createdOrder) {
        try {
          await clearPaymentRequestAfterNewChildOrderBatchCreated({
            OrderModel: Order,
            order: createdOrder,
            reason: STALE_PAYMENT_REQUEST_CLEAR_REASON,
          });
        } catch (error) {
          console.warn(
            "[order] Failed to clear stale table payment request after new batch",
            {
              orderId: createdOrder?._id || createdOrder?.id || null,
              parentOrderId: createdOrder?.parentOrderId || null,
              rootOrderId: createdOrder?.rootOrderId || null,
              restaurantId:
                createdOrder?.restaurantId || args?.input?.restaurantId || null,
              tableId: createdOrder?.tableId || args?.input?.tableId || null,
              tableCode:
                createdOrder?.tableCode || args?.input?.tableCode || null,
              error: error?.message || String(error),
            },
          );
        }
      }

      return result;
    },
  };
}
