// src/resolvers/mutation/payOrder.js
import { startSession } from "mongoose";
import dayjs from "dayjs";
import { generateInvoiceNumber } from "../../../utils/generateInvoiceNumber.ts";
import {
  Order,
  Invoice,
  PaymentTransaction,
  Cashflow,
  EventLog,
} from "../../../models/index.js";

export const payOrder = async (_parent, { input }, ctx) => {
  const {
    orderId,
    paidAmount, // số tiền user gửi
    method, // 'cash' | 'card' | 'transfer'
    paidAt,
    note,
    externalRef,
    restaurantId,
  } = input || {};

  if (!orderId) throw new Error("Thiếu orderId");
  if (!(Number(paidAmount) > 0)) throw new Error("paidAmount phải > 0");
  if (!restaurantId) throw new Error("Thiếu restaurantId");

  const normMethod = String(method || "").toLowerCase();
  if (!["cash", "card", "transfer"].includes(normMethod)) {
    throw new Error("method không hợp lệ (cash|card|transfer)");
  }

  const session = await startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Không tìm thấy order");

    if (
      order.restaurantId &&
      String(order.restaurantId) !== String(restaurantId)
    ) {
      throw new Error("restaurantId của order không khớp.");
    }

    const totalAmount = Number(order.totalAmount ?? 0);
    const totalPaid = Number(order.totalPaid ?? 0);
    const remain = Math.max(0, totalAmount - totalPaid);

    const now = paidAt ? dayjs(paidAt).toDate() : new Date();
    const pay = Math.min(Number(paidAmount), remain || Number(paidAmount));

    // Idempotency theo externalRef
    if (externalRef) {
      const existed = await PaymentTransaction.findOne({
        externalRef,
        ...(PaymentTransaction.schema.path("restaurantId")
          ? { restaurantId }
          : {}),
      }).session(session);

      if (existed) {
        const inv = await Invoice.findOne({
          refTransactionId: existed._id,
          ...(Invoice.schema.path("restaurantId") ? { restaurantId } : {}),
        }).session(session);

        const cf = await Cashflow.findOne({
          "reference.id": existed._id,
          ...(Cashflow.schema.path("restaurantId") ? { restaurantId } : {}),
        }).session(session);

        const ord = await Order.findById(orderId).session(session);

        await session.commitTransaction();
        session.endSession();

        if (!inv || !ord || !cf)
          throw new Error("Thiếu liên kết giao dịch trước đó");
        return { order: ord, invoice: inv, transaction: existed, cashflow: cf };
      }
    }

    // 1) Tạo PaymentTransaction
    const trx = await PaymentTransaction.create(
      [
        {
          orderId,
          restaurantId,
          paidAmount: pay,
          method: normMethod,
          status: "SUCCESS",
          paidAt: now,
          note,
          externalRef,
          createdBy: ctx?.user?.id,
          meta: { beforePaid: totalPaid, afterPaid: totalPaid + pay },
        },
      ],
      { session }
    ).then((r) => r[0]);

    // 2) Cập nhật Order
    const newTotalPaid = totalPaid + pay;
    order.totalPaid = newTotalPaid;
    order.paymentMethod = normMethod;

    if (newTotalPaid + 1e-6 >= totalAmount) {
      order.status = "PAID";
      order.paidAt = now;
    } else {
      order.status = "PARTIALLY_PAID";
    }
    if (!order.restaurantId) order.restaurantId = restaurantId;
    await order.save({ session });

    // 3) totals cho Invoice (object)
    const totals = {
      subtotal: Number(order.subtotal ?? totalAmount),
      discount: Number(order.discount ?? 0),
      tax: Number(order.tax ?? 0),
      service: Number(order.service ?? 0),
      grandTotal:
        Number(order.subtotal ?? totalAmount) -
        Number(order.discount ?? 0) +
        Number(order.tax ?? 0) +
        Number(order.service ?? 0),
    };

    // 4) Tạo / cập nhật Invoice
    let invoice = await Invoice.findOne({
      orderId,
      ...(Invoice.schema.path("restaurantId") ? { restaurantId } : {}),
    }).session(session);

    if (!invoice) {
      const number = await generateInvoiceNumber(Invoice, session); // số hoá đơn
      invoice = await Invoice.create(
        [
          {
            restaurantId,
            orderId,
            userId: ctx?.user?.id,
            tableCode: order.tableCode,
            number,
            issuedAt: now,
            lines:
              order.items?.map((it) => ({
                dishId: String(it.dishId ?? ""),
                menuId: String(it.menuId ?? ""),
                categoryId: String(it.categoryId ?? ""),
                name: it.name,
                unit: it.unit,
                price: it.price,
                modifiersPrice: it.modifiersPrice ?? 0,
                quantity: it.quantity,
                totals:
                  (Number(it.price) + Number(it.modifiersPrice ?? 0)) *
                  Number(it.quantity),
                modifiers: (it.modifiers ?? []).map((m) => ({
                  optionId: m.optionId,
                  optionName: m.optionName,
                  groupId: m.groupId,
                  price: m.price,
                })),
              })) ?? [],
            totals,
            paid: newTotalPaid,
            status:
              newTotalPaid >= totals.grandTotal
                ? "PAID"
                : newTotalPaid > 0
                ? "PARTIAL"
                : "UNPAID",
            currency: order.currency ?? "VND",
            refTransactionId: trx._id,
            code: undefined, // nếu còn dùng mã QR khác thì set lại
          },
        ],
        { session }
      ).then((r) => r[0]);
    } else {
      invoice.totals = totals;
      invoice.paid = newTotalPaid;
      invoice.status =
        newTotalPaid >= totals.grandTotal
          ? "PAID"
          : newTotalPaid > 0
          ? "PARTIAL"
          : "UNPAID";
      invoice.currency = order.currency ?? invoice.currency ?? "VND";
      invoice.refTransactionId = trx._id;
      if (!invoice.issuedAt) invoice.issuedAt = now;
      if (!invoice.number)
        invoice.number = await generateInvoiceNumber(Invoice, session);
      if (!invoice.restaurantId) invoice.restaurantId = restaurantId;
      if (!invoice.userId) invoice.userId = ctx?.user?.id;
      await invoice.save({ session });
    }

    // 5) Cashflow
    const cashflow = await Cashflow.create(
      [
        {
          restaurantId,
          type: "INFLOW",
          category: "SALE",
          amount: pay,
          occurredAt: now,
          method: normMethod,
          currency: order.currency ?? "VND",
          reference: { kind: "PAYMENT_TRANSACTION", id: trx._id, orderId },
          note: `Thanh toán order #${order.code || order._id}`,
          createdBy: ctx?.user?.id,
        },
      ],
      { session }
    ).then((r) => r[0]);

    // 6) Event log (yêu cầu EventLog model có static log)
    await EventLog.log(
      {
        restaurantId,
        orderId,
        verb: "order.pay",
        actorUserId: ctx?.user?.id,
        object: { kind: "Order", id: orderId, code: order.code },
        target: { kind: "PaymentTransaction", id: trx._id },
        source: "pos",
        status: "success",
        meta: {
          paidAmount,
          captured: pay,
          method: normMethod,
          transactionId: trx._id,
          invoiceId: invoice._id,
          currency: order.currency ?? "VND",
          newStatus: order.status,
        },
        correlationId: externalRef || undefined,
        sessionId: ctx?.sessionId || undefined,
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const freshOrder = await Order.findById(orderId);
    return { order: freshOrder, invoice, transaction: trx, cashflow };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
};

export default { payOrder };
