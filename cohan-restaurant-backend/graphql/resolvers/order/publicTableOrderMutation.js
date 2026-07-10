import { timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import { Customer, Order, Table, Warehouse } from "../../../models/index.js";
import generateOrderCode from "../../../utils/generateOrderCode.js";
import {
  KITCHEN_STATUS,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  SPLIT_STATUS,
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
  ensureActiveTableSessionForDineInOrder,
} from "../../../utils/orderLifecycle.js";
import {
  TABLE_ACCESS_TOKEN_ERROR,
  TABLE_IDENTITY_TOKEN_ERROR,
  getPublicTableDemoOtp,
  getPublicTableOrderCapability,
  mapPublicTableOrder,
  maskPublicCustomerName,
  maskPublicPhone,
  normalizePublicPhone,
  normalizePublicTableCode,
  signTableIdentityCandidate,
  signTableIdentityChallenge,
  signTableIdentityToken,
  verifyTableAccessToken,
  verifyTableIdentityCandidate,
  verifyTableIdentityChallenge,
  verifyTableIdentityToken,
} from "../../../utils/publicTableSession.js";
import { reserveForOrderTx } from "../../../src/services/inventory.service.js";
import { hydrateOrderItems } from "../../../src/services/orderItemHydration.service.js";
import {
  ensureOrderTracking,
  updatePublicStatusHistory,
} from "../../../src/services/orderTracking.service.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";
import { normalizeItem } from "./helper/orderUtils.js";
import { resolveOrCreateGuestCustomerForOrder } from "./helper/userUtils.js";

const MAX_ORDER_LINES = 30;
const MAX_PENDING_QR_BATCHES = 3;
const MAX_ITEM_QUANTITY = 20;
const MAX_NOTE_LENGTH = 500;
const QR_ORDER_SOURCE = "customer_table_qr";

const toId = (value) =>
  value && mongoose.isValidObjectId(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

function fixedOtpMatches(inputOtp) {
  const expected = Buffer.from(getPublicTableDemoOtp());
  const incoming = Buffer.from(String(inputOtp || "").trim());
  return expected.length === incoming.length && timingSafeEqual(expected, incoming);
}

function assertScope(payload, { restaurantId, tableId }) {
  if (
    !payload ||
    String(payload.restaurantId) !== String(restaurantId) ||
    String(payload.tableId) !== String(tableId)
  ) {
    throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  }
}

async function loadPublicTableAccess({ restaurantId, tableId, token, session = null }) {
  const rid = toId(restaurantId);
  const tid = toId(tableId);
  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  const verifiedToken = verifyTableAccessToken(token);
  if (
    verifiedToken.restaurantId !== String(rid) ||
    verifiedToken.tableId !== String(tid)
  ) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  let query = Table.findOne({ _id: tid, restaurantId: rid }).select({
    _id: 1,
    code: 1,
    status: 1,
    tableAccessToken: 1,
  });
  if (session) query = query.session(session);
  const table = await query.lean();

  if (!table) throw new Error("Table not found");
  if (!table.tableAccessToken || table.tableAccessToken !== String(token || "").trim()) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  const tableCode = normalizePublicTableCode(table.code);
  if (verifiedToken.tableCode && verifiedToken.tableCode !== tableCode) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  return { rid, tid, table, tableCode };
}

async function loadActiveSession({ rid, tid, tableCode, session = null }) {
  let query = Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode,
    }),
  ).sort({ openedAt: -1, createdAt: -1, _id: -1 });
  if (session) query = query.session(session);
  return query.lean({ virtuals: true });
}

async function assertTableAcceptsOrders(access, session = null) {
  const activeSession = await loadActiveSession({
    rid: access.rid,
    tid: access.tid,
    tableCode: access.tableCode,
    session,
  });
  const capability = getPublicTableOrderCapability({
    tableStatus: access.table.status,
    session: activeSession,
  });
  if (!capability.canOrder) {
    throw new GraphQLError(capability.reason || "Bàn chưa sẵn sàng nhận món.", {
      extensions: { code: "TABLE_NOT_ACCEPTING_ORDERS" },
    });
  }
  return activeSession;
}

async function createUniqueOrderCode({ restaurantId, tableCode, session, source = "QR" }) {
  for (let index = 0; index < 10; index += 1) {
    const code = generateOrderCode(source, new Date(), tableCode || null);
    const query = Order.exists({ restaurantId, orderCode: code });
    if (session) query.session(session);
    if (!(await query)) return code;
  }
  return generateOrderCode(source, new Date(), tableCode || null);
}

function buildTotals(items = []) {
  const subtotal = Math.round(
    items.reduce(
      (sum, item) =>
        ["cancelled", "returned"].includes(String(item?.status || "").toLowerCase())
          ? sum
          : sum + Number(item?.lineSubtotal || 0),
      0,
    ),
  );
  return {
    subtotal,
    discount: 0,
    tax: 0,
    taxRate: 0,
    service: 0,
    serviceRate: 0,
    shippingFee: 0,
    grandTotal: subtotal,
  };
}

function buildInventoryLines(items = []) {
  return items
    .filter((item) => item && !["cancelled", "returned"].includes(item.status))
    .map((item) => {
      const servingKey = String(item.servingKey || "").trim();
      if (!item.dishId || !servingKey) {
        throw new Error("Món chưa có thông tin tồn kho hợp lệ.");
      }
      const mode = String(item?.servingVariant?.mode || "").toUpperCase();
      if (mode === "BY_WEIGHT") {
        const weightGrams = Number(item.weightGrams);
        if (!Number.isInteger(weightGrams) || weightGrams <= 0) {
          throw new Error("Món cân ký cần khối lượng gram hợp lệ.");
        }
        return {
          menuItemId: item.dishId,
          quantity: 1,
          weightGrams,
          servingKey,
          servingMode: "BY_WEIGHT",
          preparationMethodName: item?.servingVariant?.name || null,
        };
      }
      const quantity = Number(item.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_ITEM_QUANTITY) {
        throw new Error(`Mỗi món chỉ được gọi tối đa ${MAX_ITEM_QUANTITY} phần trong một lần.`);
      }
      return {
        menuItemId: item.dishId,
        quantity,
        weightGrams: item.weightGrams || null,
        servingKey,
        servingMode: item?.servingVariant?.mode || null,
        preparationMethodName: item?.servingVariant?.name || null,
      };
    });
}

async function resolveWarehouseId(restaurantId, session) {
  const warehouse = await Warehouse.findOne({
    restaurantId,
    isActive: { $ne: false },
  })
    .sort({ createdAt: 1, _id: 1 })
    .session(session)
    .lean();
  if (!warehouse?._id) throw new Error("Nhà hàng chưa có kho hoạt động để giữ món.");
  return warehouse._id;
}

function normalizeOrderInput(input = {}) {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw new Error("Vui lòng chọn ít nhất một món.");
  if (items.length > MAX_ORDER_LINES) {
    throw new Error(`Mỗi đợt gọi món tối đa ${MAX_ORDER_LINES} dòng món.`);
  }
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    throw new Error("Yêu cầu gửi món không hợp lệ. Vui lòng thử lại.");
  }
  return {
    items,
    note: String(input.note || "").trim().slice(0, MAX_NOTE_LENGTH) || null,
    idempotencyKey,
  };
}

async function resolveIdentityCustomer({ identityToken, restaurantId, tableId }) {
  if (!identityToken) return null;
  const identity = verifyTableIdentityToken(identityToken);
  assertScope(identity, { restaurantId, tableId });
  const customer = await Customer.findOne({
    _id: toId(identity.customerId),
    userType: "CUSTOMER",
    deletedAt: null,
  }).lean();
  if (!customer) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  if (
    customer.isGuest &&
    customer.guestExpiresAt &&
    new Date(customer.guestExpiresAt).getTime() <= Date.now()
  ) {
    throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  }
  return customer;
}

function toOutOfStockError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (
    error?.extensions?.code === "OUT_OF_STOCK" ||
    message.includes("insufficient") ||
    message.includes("không đủ tồn kho") ||
    message.includes("hết hàng") ||
    message.includes("out of stock")
  ) {
    return new GraphQLError(
      "Một số món vừa hết hoặc không đủ tồn kho. Vui lòng kiểm tra lại giỏ.",
      { extensions: { code: "OUT_OF_STOCK" } },
    );
  }
  return error;
}

function buildQrIdempotencyFilter({ restaurantId, tableId, idempotencyKey }) {
  return {
    restaurantId,
    tableId,
    "clientMeta.source": QR_ORDER_SOURCE,
    "clientMeta.idempotencyKey": idempotencyKey,
  };
}

function buildExistingOrderResult(order) {
  return {
    ok: true,
    message: "Đợt gọi món này đã được gửi trước đó.",
    order: mapPublicTableOrder(order.toObject()),
  };
}

export async function publicRequestTableIdentityOtp(_parent, { input }) {
  const access = await loadPublicTableAccess(input || {});
  await assertTableAcceptsOrders(access);
  const phone = normalizePublicPhone(input?.phone);
  const challengeToken = signTableIdentityChallenge({
    restaurantId: access.rid,
    tableId: access.tid,
    phone,
  });
  return {
    ok: true,
    message: "Mã OTP demo đã sẵn sàng. Mã chỉ dùng cho bản trình diễn khóa luận.",
    challengeToken,
    maskedPhone: maskPublicPhone(phone),
    demoOtp: getPublicTableDemoOtp(),
  };
}

export async function publicVerifyTableIdentityOtp(_parent, { input }) {
  const challenge = verifyTableIdentityChallenge(input?.challengeToken);
  if (!fixedOtpMatches(input?.otp)) {
    throw new GraphQLError("Mã OTP không đúng.", {
      extensions: { code: "INVALID_OTP" },
    });
  }

  const registered = await Customer.findOne({
    phone: challenge.phone,
    userType: "CUSTOMER",
    deletedAt: null,
    isGuest: { $ne: true },
  }).lean();

  if (registered?._id) {
    return {
      ok: true,
      message: "Đã xác minh số điện thoại. Vui lòng xác nhận tài khoản trước khi lưu đơn.",
      requiresAccountConfirmation: true,
      candidateToken: signTableIdentityCandidate({
        restaurantId: challenge.restaurantId,
        tableId: challenge.tableId,
        phone: challenge.phone,
        customerId: registered._id,
      }),
      identityToken: null,
      maskedCustomerName: maskPublicCustomerName(registered.fullName),
      linkedAsGuest: false,
    };
  }

  const guest = await resolveOrCreateGuestCustomerForOrder({
    customer: { fullName: "Khách tại bàn", phone: challenge.phone },
    requireContact: true,
    createIfMissing: true,
    restaurantId: challenge.restaurantId,
  });
  if (!guest?.userId) throw new Error("Không thể tạo hồ sơ khách tạm thời.");

  return {
    ok: true,
    message: "Đã lưu số điện thoại cho phiên gọi món này.",
    requiresAccountConfirmation: false,
    candidateToken: null,
    identityToken: signTableIdentityToken({
      restaurantId: challenge.restaurantId,
      tableId: challenge.tableId,
      customerId: guest.userId,
      isGuest: true,
    }),
    maskedCustomerName: "Khách tại bàn",
    linkedAsGuest: true,
  };
}

export async function publicConfirmTableIdentity(_parent, { input }) {
  const candidate = verifyTableIdentityCandidate(input?.candidateToken);
  if (!input?.accept) {
    return {
      ok: true,
      message: "Đơn tại bàn sẽ tiếp tục ở chế độ không lưu tài khoản.",
      identityToken: null,
    };
  }

  const customer = await Customer.findOne({
    _id: toId(candidate.customerId),
    phone: candidate.phone,
    userType: "CUSTOMER",
    deletedAt: null,
    isGuest: { $ne: true },
  }).lean();
  if (!customer) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);

  return {
    ok: true,
    message: "Đã liên kết phiên gọi món với tài khoản khách hàng.",
    identityToken: signTableIdentityToken({
      restaurantId: candidate.restaurantId,
      tableId: candidate.tableId,
      customerId: customer._id,
      isGuest: false,
    }),
  };
}

export async function publicSubmitTableOrder(_parent, { input }, ctx) {
  const normalized = normalizeOrderInput(input);
  const access = await loadPublicTableAccess(input || {});
  const identityCustomer = await resolveIdentityCustomer({
    identityToken: input?.identityToken,
    restaurantId: access.rid,
    tableId: access.tid,
  });
  const idempotencyFilter = buildQrIdempotencyFilter({
    restaurantId: access.rid,
    tableId: access.tid,
    idempotencyKey: normalized.idempotencyKey,
  });

  const existing = await Order.findOne(idempotencyFilter).sort({ createdAt: -1 });
  if (existing) return buildExistingOrderResult(existing);

  const transaction = await mongoose.startSession();
  let createdOrder = null;
  let reusedExistingOrder = false;
  try {
    await transaction.withTransaction(async () => {
      const currentAccess = await loadPublicTableAccess({ ...input, session: transaction });
      const activeBefore = await assertTableAcceptsOrders(currentAccess, transaction);
      const requestedCustomerId = identityCustomer?._id || null;
      const tableCustomerId = activeBefore?.userId || requestedCustomerId || null;

      const sessionMeta = await ensureActiveTableSessionForDineInOrder({
        OrderModel: Order,
        createOrderCode: (_prefix, _now, tableCode) =>
          createUniqueOrderCode({
            restaurantId: currentAccess.rid,
            tableCode,
            session: transaction,
            source: "TABLE",
          }),
        restaurantId: currentAccess.rid,
        tableId: currentAccess.tid,
        tableCode: currentAccess.tableCode,
        userId: tableCustomerId ? toId(tableCustomerId) : undefined,
        session: transaction,
      });
      const parentSession = sessionMeta.sessionOrder;
      const submissionAt = new Date();

      // The active table-session row is the serialization point for all QR batches
      // of one table. Concurrent retries now conflict/retry before another batch is
      // created, then observe the first committed idempotency key.
      await Order.updateOne(
        { _id: parentSession._id, orderKind: ORDER_KIND.TABLE_SESSION },
        { $set: { "clientMeta.lastQrSubmissionAt": submissionAt } },
        { session: transaction },
      );

      const existingInTransaction = await Order.findOne(idempotencyFilter).session(
        transaction,
      );
      if (existingInTransaction) {
        createdOrder = existingInTransaction;
        reusedExistingOrder = true;
        return;
      }

      const pendingCount = await Order.countDocuments({
        ...childOrdersForSessionFilter({
          restaurantId: currentAccess.rid,
          parentOrderId: parentSession._id,
        }),
        currentStatus: "pending",
        "clientMeta.source": QR_ORDER_SOURCE,
      }).session(transaction);
      if (pendingCount >= MAX_PENDING_QR_BATCHES) {
        throw new GraphQLError(
          "Bàn đang có nhiều đợt món chờ xác nhận. Vui lòng chờ nhân viên xử lý.",
          { extensions: { code: "TOO_MANY_PENDING_TABLE_ORDERS" } },
        );
      }

      const normalizedItems = normalized.items.map((item) => normalizeItem({ ...item }));
      await hydrateOrderItems({
        restaurantId: currentAccess.rid,
        items: normalizedItems,
        session: transaction,
      });
      const totals = buildTotals(normalizedItems);
      const orderCode = await createUniqueOrderCode({
        restaurantId: currentAccess.rid,
        tableCode: currentAccess.tableCode,
        session: transaction,
      });

      const [order] = await Order.create(
        [
          {
            restaurantId: currentAccess.rid,
            tableId: currentAccess.tid,
            tableCode: currentAccess.tableCode,
            userId: tableCustomerId ? toId(tableCustomerId) : undefined,
            orderCode,
            orderType: "dine_in",
            orderKind: ORDER_KIND.ORDER_BATCH,
            parentOrderId: parentSession._id,
            rootOrderId: parentSession._id,
            splitStatus: SPLIT_STATUS.NONE,
            sessionStatus: SESSION_STATUS.DINING,
            kitchenStatus: KITCHEN_STATUS.DRAFT,
            orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
            items: normalizedItems,
            totals,
            note: normalized.note,
            currentStatus: "pending",
            payment: { method: "cash", status: "pending" },
            statusTimeline: [
              {
                status: "pending",
                at: submissionAt,
                byUserId: tableCustomerId ? toId(tableCustomerId) : undefined,
                note: "Khách gửi món từ mã QR, chờ nhân viên xác nhận",
              },
            ],
            clientMeta: {
              source: QR_ORDER_SOURCE,
              idempotencyKey: normalized.idempotencyKey,
              identityMode: tableCustomerId ? "linked" : "anonymous",
              submittedAt: submissionAt,
            },
          },
        ],
        { session: transaction },
      );

      const inventoryLines = buildInventoryLines(normalizedItems);
      if (inventoryLines.length) {
        const warehouseId = await resolveWarehouseId(currentAccess.rid, transaction);
        await reserveForOrderTx({
          restaurantId: currentAccess.rid,
          warehouseId,
          orderCode,
          lines: inventoryLines,
          session: transaction,
        });
      }

      const parentUpdate = {
        sessionStatus: SESSION_STATUS.DINING,
        orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
      };
      if (tableCustomerId && !parentSession.userId) {
        parentUpdate.userId = toId(tableCustomerId);
      }
      await Order.updateOne(
        { _id: parentSession._id },
        { $set: parentUpdate },
        { session: transaction },
      );

      await Table.updateOne(
        {
          _id: currentAccess.tid,
          restaurantId: currentAccess.rid,
          status: { $in: ["reserved", "occupied", "payment_pending"] },
        },
        { $set: { status: "occupied" } },
        { session: transaction },
      );

      await ensureOrderTracking(order);
      updatePublicStatusHistory(order, "CUSTOMER");
      await order.save({ session: transaction });
      createdOrder = order;
    });
  } catch (error) {
    throw toOutOfStockError(error);
  } finally {
    await transaction.endSession();
  }

  if (!createdOrder) {
    throw new Error("Không thể tạo đợt gọi món. Vui lòng thử lại.");
  }
  if (reusedExistingOrder) return buildExistingOrderResult(createdOrder);

  try {
    await emitOrderEvent(ctx, String(access.rid), "ORDER_CREATED", createdOrder);
  } catch (error) {
    console.warn(
      "[QR_ORDER] Order committed but realtime notification failed",
      error?.message || error,
    );
  }

  return {
    ok: true,
    message: "Đã gửi món. Nhân viên/POS sẽ kiểm tra trước khi chuyển bếp.",
    order: mapPublicTableOrder(createdOrder.toObject()),
  };
}

export default {
  publicRequestTableIdentityOtp,
  publicVerifyTableIdentityOtp,
  publicConfirmTableIdentity,
  publicSubmitTableOrder,
};
