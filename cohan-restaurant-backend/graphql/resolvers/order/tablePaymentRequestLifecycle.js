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
        await clearPaymentRequestAfterNewChildOrderBatchCreated({
          OrderModel: Order,
          order: createdOrder,
          reason: STALE_PAYMENT_REQUEST_CLEAR_REASON,
        });
      }

      return result;
    },
  };
}
