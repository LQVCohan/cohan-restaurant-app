import mongoose from "mongoose";

import { Order } from "../../../models/index.js";
import generateOrderCode from "../../../utils/generateOrderCode.js";
import {
  buildActiveTableSessionKey,
  clearPaymentRequestAfterNewChildOrderBatchCreated,
  ensureActiveTableSessionForDineInOrder,
  KITCHEN_STATUS,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  SPLIT_STATUS,
} from "../../../utils/orderLifecycle.js";

const STALE_PAYMENT_REQUEST_CLEAR_REASON =
  "Thêm món mới sau khi khách yêu cầu thanh toán.";

function normalizeTableCode(value) {
  return String(value || "").trim().toUpperCase();
}

function buildEmptyTotals() {
  return {
    subtotal: 0,
    discount: 0,
    tax: 0,
    service: 0,
    shippingFee: 0,
    grandTotal: 0,
  };
}

function normalizeChildKitchenStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === KITCHEN_STATUS.DRAFT) {
    return KITCHEN_STATUS.PENDING;
  }
  return value;
}

async function hardenCreatedDineInOrderBatch({ order, input }) {
  if (!order || order.orderType !== "dine_in") {
    return order;
  }

  const orderId = order._id || order.id || null;
  const restaurantId = order.restaurantId || input?.restaurantId || null;
  const tableId = order.tableId || input?.tableId || null;
  const tableCode = normalizeTableCode(order.tableCode || input?.tableCode);

  if (!orderId || !restaurantId || !tableId || !tableCode) {
    return order;
  }

  const dbSession = await mongoose.startSession();
  let normalizedOrder = order;

  try {
    await dbSession.withTransaction(async () => {
      const { sessionOrder } = await ensureActiveTableSessionForDineInOrder({
        OrderModel: Order,
        createOrderCode: generateOrderCode,
        restaurantId,
        tableId,
        tableCode,
        userId: order.userId || input?.userId || null,
        session: dbSession,
      });

      if (!sessionOrder?._id) {
        return;
      }

      const parentOrderId = sessionOrder._id;
      const activeSessionKey =
        sessionOrder.activeSessionKey ||
        buildActiveTableSessionKey({ restaurantId, tableId });

      const parentPatch = {
        activeSessionKey,
        sessionStatus: SESSION_STATUS.DINING,
        kitchenStatus: KITCHEN_STATUS.DRAFT,
        orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
        openedAt: sessionOrder.openedAt || order.openedAt || new Date(),
        closedAt: null,
        currentStatus: sessionOrder.currentStatus || KITCHEN_STATUS.PENDING,
        "payment.status": "pending",
      };

      if (
        String(parentOrderId) === String(orderId) ||
        order.orderKind === ORDER_KIND.TABLE_SESSION
      ) {
        const childOrderCode = generateOrderCode("POS", new Date(), tableCode);

        const [createdChild] = await Order.create(
          [
            {
              restaurantId,
              tableId,
              tableCode,
              userId: order.userId || input?.userId || null,
              orderCode: childOrderCode,
              parentOrderCode: sessionOrder.orderCode || order.orderCode || null,
              orderType: "dine_in",
              orderKind: ORDER_KIND.ORDER_BATCH,
              parentOrderId,
              rootOrderId: parentOrderId,
              splitStatus: SPLIT_STATUS.NONE,
              sessionStatus: SESSION_STATUS.DINING,
              kitchenStatus: normalizeChildKitchenStatus(order.kitchenStatus),
              orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
              activeSessionKey: null,
              openedAt: null,
              closedAt: null,
              items: Array.isArray(order.items) ? order.items : [],
              totals: order.totals || buildEmptyTotals(),
              note: order.note,
              clientMeta: order.clientMeta,
              currentStatus: order.currentStatus || KITCHEN_STATUS.PENDING,
              payment: {
                ...(order.payment || {}),
                status: "pending",
              },
              statusTimeline: Array.isArray(order.statusTimeline)
                ? order.statusTimeline
                : [],
              priority: order.priority,
            },
          ],
          { session: dbSession },
        );

        await Order.updateOne(
          {
            _id: parentOrderId,
            restaurantId,
            orderKind: ORDER_KIND.TABLE_SESSION,
          },
          {
            $set: {
              ...parentPatch,
              items: [],
              totals: buildEmptyTotals(),
            },
          },
          { session: dbSession },
        );

        let childQuery = Order.findById(createdChild._id);
        childQuery = childQuery.session(dbSession);
        normalizedOrder = await childQuery.lean();
        return;
      }

      await Order.updateOne(
        { _id: orderId, restaurantId },
        {
          $set: {
            orderKind: ORDER_KIND.ORDER_BATCH,
            parentOrderId,
            rootOrderId: parentOrderId,
            parentOrderCode: sessionOrder.orderCode || order.parentOrderCode || null,
            splitStatus: SPLIT_STATUS.NONE,
            orderType: "dine_in",
            tableId,
            tableCode,
            kitchenStatus: normalizeChildKitchenStatus(order.kitchenStatus),
            sessionStatus: SESSION_STATUS.DINING,
            orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
            activeSessionKey: null,
            openedAt: null,
            closedAt: null,
            "payment.status": "pending",
          },
        },
        { session: dbSession },
      );

      await Order.updateOne(
        {
          _id: parentOrderId,
          restaurantId,
          orderKind: ORDER_KIND.TABLE_SESSION,
        },
        {
          $set: parentPatch,
        },
        { session: dbSession },
      );

      let query = Order.findById(orderId);
      query = query.session(dbSession);
      normalizedOrder = await query.lean();
    });
  } finally {
    await dbSession.endSession();
  }

  return normalizedOrder || order;
}

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
      let orderForPaymentRequestClear = createdOrder;

      if (createdOrder) {
        try {
          const hardenedOrder = await hardenCreatedDineInOrderBatch({
            order: createdOrder,
            input: args?.input,
          });

          if (hardenedOrder) {
            result.order = hardenedOrder;
            orderForPaymentRequestClear = hardenedOrder;
          }
        } catch (error) {
          console.warn(
            "[order] Failed to harden dine-in session lifecycle after createOrderForTable",
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

        try {
          await clearPaymentRequestAfterNewChildOrderBatchCreated({
            OrderModel: Order,
            order: orderForPaymentRequestClear,
            reason: STALE_PAYMENT_REQUEST_CLEAR_REASON,
          });
        } catch (error) {
          console.warn(
            "[order] Failed to clear stale table payment request after new batch",
            {
              orderId:
                orderForPaymentRequestClear?._id ||
                orderForPaymentRequestClear?.id ||
                null,
              parentOrderId: orderForPaymentRequestClear?.parentOrderId || null,
              rootOrderId: orderForPaymentRequestClear?.rootOrderId || null,
              restaurantId:
                orderForPaymentRequestClear?.restaurantId ||
                args?.input?.restaurantId ||
                null,
              tableId:
                orderForPaymentRequestClear?.tableId || args?.input?.tableId || null,
              tableCode:
                orderForPaymentRequestClear?.tableCode ||
                args?.input?.tableCode ||
                null,
              error: error?.message || String(error),
            },
          );
        }
      }

      return result;
    },
  };
}
