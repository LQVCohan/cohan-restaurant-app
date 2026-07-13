import mongoose from "mongoose";
import {
  KitchenOrderWorkItem,
  Order,
  Reservation,
  Table,
} from "../../../models/index.js";
import TableOrderSplitSession from "../../../models/table-order-split-session.model.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
import generateOrderCode from "../../../utils/generateOrderCode.js";
import {
  ensureActiveTableSessionForDineInOrder,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
} from "../../../utils/orderLifecycle.js";

const ACTIVE_ORDER_STATUSES = { $nin: ["completed", "cancelled", "failed"] };
const CLOSED_ITEM_STATUSES = new Set(["cancelled", "returned"]);
const LOCKED_PAYMENT_STATUSES = new Set(["payment_requested", "paid"]);
const REVERT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const asId = (value) => String(value?._id || value?.id || value || "");

const businessError = (message, code = "TABLE_ORDER_SPLIT_INVALID") => {
  const error = new Error(message);
  error.extensions = { code };
  return error;
};

const isStandaloneTable = (table) =>
  Boolean(table) &&
  !table.joinGroupId &&
  !table.mergedIntoTableId &&
  !(Array.isArray(table.mergedFromTableIds) && table.mergedFromTableIds.length);

const isPaymentLocked = (order) => {
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  const lifecycleStatus = String(order?.orderPaymentStatus || "").toLowerCase();
  return (
    LOCKED_PAYMENT_STATUSES.has(paymentStatus) ||
    !["", ORDER_PAYMENT_STATUS.UNPAID].includes(lifecycleStatus)
  );
};

const hasPendingAdjustments = (item) =>
  (item?.voidRequests || []).some((request) => request?.status === "pending") ||
  (item?.returnRequests || []).some((request) => request?.status === "pending");

function stripSplitMeta(clientMeta) {
  const next = { ...(clientMeta || {}) };
  delete next.tableOrderSplit;
  return Object.keys(next).length ? next : null;
}

function activeItems(order) {
  return (order?.items || []).filter(
    (item) => !CLOSED_ITEM_STATUSES.has(String(item?.status || "").toLowerCase()),
  );
}

async function requireSplitPermissions(ctx, restaurantId) {
  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.ORDER_UPDATE);
  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_WRITE);
}

async function findActiveSplit(restaurantId, tableId, session = null) {
  const query = TableOrderSplitSession.findOne({
    restaurantId,
    status: "active",
    $or: [{ "source.tableId": tableId }, { "target.tableId": tableId }],
  }).sort({ createdAt: -1 });
  if (session) query.session(session);
  return query;
}

async function loadTablePair({ restaurantId, sourceTableId, targetTableId, session }) {
  const tables = await Table.find({
    _id: { $in: [sourceTableId, targetTableId] },
    restaurantId,
  })
    .session(session)
    .lean();

  const source = tables.find((table) => asId(table) === asId(sourceTableId));
  const target = tables.find((table) => asId(table) === asId(targetTableId));
  if (!source || !target) {
    throw businessError(
      "Không tìm thấy bàn nguồn hoặc bàn đích trong nhà hàng.",
      "TABLE_ORDER_SPLIT_TABLE_NOT_FOUND",
    );
  }
  if (!isStandaloneTable(source) || !isStandaloneTable(target)) {
    throw businessError(
      "Chỉ tách order giữa các bàn độc lập, chưa thuộc nhóm ghép.",
      "TABLE_ORDER_SPLIT_REQUIRES_STANDALONE_TABLES",
    );
  }
  if (String(source.floorId || "") !== String(target.floorId || "")) {
    throw businessError(
      "Bàn nguồn và bàn đích phải ở cùng một tầng.",
      "TABLE_ORDER_SPLIT_CROSS_FLOOR",
    );
  }
  if (String(target.status || "").toLowerCase() !== "available") {
    throw businessError(
      `Bàn ${target.code} không còn trống để nhận order được tách.`,
      "TABLE_ORDER_SPLIT_TARGET_UNAVAILABLE",
    );
  }
  return { source, target };
}

async function assertTargetEmpty({ restaurantId, target, session }) {
  const [activeOrder, activeReservation, activeSplit] = await Promise.all([
    Order.findOne({
      restaurantId,
      tableId: target._id,
      orderType: "dine_in",
      currentStatus: ACTIVE_ORDER_STATUSES,
    })
      .session(session)
      .lean(),
    Reservation.findOne({
      restaurantId,
      tableId: target._id,
      status: {
        $in: ["pending_payment", "confirmed", "seated", "pending_change"],
      },
    })
      .session(session)
      .lean(),
    findActiveSplit(restaurantId, target._id, session),
  ]);

  if (activeOrder || activeReservation || activeSplit) {
    throw businessError(
      `Bàn ${target.code} đã có phiên phục vụ, đặt chỗ hoặc thao tác tách khác.`,
      "TABLE_ORDER_SPLIT_TARGET_BUSY",
    );
  }
}

function selectionMap(selectedItems = []) {
  if (!Array.isArray(selectedItems) || !selectedItems.length) {
    throw businessError(
      "Vui lòng chọn ít nhất một món cần tách.",
      "TABLE_ORDER_SPLIT_EMPTY_SELECTION",
    );
  }

  const result = new Map();
  for (const row of selectedItems) {
    const orderId = toId(row?.orderId);
    const orderItemId = toId(row?.orderItemId);
    if (!orderId || !orderItemId) {
      throw businessError(
        "Danh sách món tách có dữ liệu không hợp lệ.",
        "TABLE_ORDER_SPLIT_BAD_SELECTION",
      );
    }
    const key = asId(orderId);
    if (!result.has(key)) result.set(key, new Set());
    result.get(key).add(asId(orderItemId));
  }
  return result;
}

function targetOrderPayload({
  sourceOrder,
  target,
  targetSession,
  selectedItems,
  splitId,
  now,
}) {
  return {
    orderCode: generateOrderCode("POS", now, target.code),
    parentOrderCode: targetSession.orderCode,
    orderKind: ORDER_KIND.SPLIT_BILL,
    parentOrderId: targetSession._id,
    rootOrderId: targetSession._id,
    splitStatus: "partial",
    sessionStatus: SESSION_STATUS.DINING,
    kitchenStatus: sourceOrder.kitchenStatus,
    orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
    openedAt: now,
    tableId: target._id,
    tableCode: target.code,
    tableName: target.code,
    guestCount: sourceOrder.guestCount || 1,
    userId: sourceOrder.userId || undefined,
    restaurantId: sourceOrder.restaurantId,
    orderType: "dine_in",
    items: selectedItems.map((item) => {
      const plain = typeof item?.toObject === "function" ? item.toObject() : { ...item };
      delete plain._id;
      return plain;
    }),
    totals: {
      subtotal: 0,
      discount: 0,
      tax: 0,
      taxRate: Number(sourceOrder?.totals?.taxRate || 0),
      service: 0,
      serviceRate: Number(sourceOrder?.totals?.serviceRate || 0),
      shippingFee: 0,
      grandTotal: 0,
    },
    payment: { method: "cash", status: "pending", paidAmount: 0 },
    currentStatus: sourceOrder.currentStatus,
    priority: sourceOrder.priority,
    note: sourceOrder.note,
    clientMeta: {
      ...(sourceOrder.clientMeta || {}),
      tableOrderSplit: {
        splitId: asId(splitId),
        originOrderId: asId(sourceOrder._id),
        originOrderCode: sourceOrder.orderCode,
        originParentOrderId: asId(
          sourceOrder.parentOrderId || sourceOrder.rootOrderId,
        ),
        originTableId: asId(sourceOrder.tableId),
        originTableCode: sourceOrder.tableCode,
      },
    },
    statusTimeline: [
      ...(sourceOrder.statusTimeline || []).map((entry) =>
        typeof entry?.toObject === "function" ? entry.toObject() : entry,
      ),
      {
        status: sourceOrder.currentStatus,
        at: now,
        note: `Tách món từ ${sourceOrder.tableCode} sang ${target.code}.`,
      },
    ],
  };
}

async function splitTableOrder(_parent, { input }, ctx) {
  const restaurantId = toId(input?.restaurantId);
  const sourceTableId = toId(input?.sourceTableId);
  const targetTableId = toId(input?.targetTableId);
  if (!restaurantId || !sourceTableId || !targetTableId) {
    throw businessError("restaurantId, sourceTableId và targetTableId không hợp lệ.");
  }
  if (asId(sourceTableId) === asId(targetTableId)) {
    throw businessError("Bàn nguồn và bàn đích phải khác nhau.");
  }

  await requireSplitPermissions(ctx, restaurantId);
  const selectedByOrder = selectionMap(input?.selectedItems);
  const splitId = new mongoose.Types.ObjectId();
  const now = new Date();
  const tx = await mongoose.startSession();
  let splitRecord = null;

  try {
    await tx.withTransaction(async () => {
      const existingSourceSplit = await findActiveSplit(
        restaurantId,
        sourceTableId,
        tx,
      );
      if (existingSourceSplit) {
        throw businessError(
          "Bàn nguồn đang có một lần tách chưa được gộp lại.",
          "TABLE_ORDER_SPLIT_ALREADY_ACTIVE",
        );
      }

      const { source, target } = await loadTablePair({
        restaurantId,
        sourceTableId,
        targetTableId,
        session: tx,
      });
      await assertTargetEmpty({ restaurantId, target, session: tx });

      const sourceOrders = await Order.find({
        restaurantId,
        tableId: source._id,
        orderType: "dine_in",
        orderKind: { $ne: ORDER_KIND.TABLE_SESSION },
        currentStatus: ACTIVE_ORDER_STATUSES,
      })
        .sort({ createdAt: 1, _id: 1 })
        .session(tx);

      if (!sourceOrders.length) {
        throw businessError(
          `Bàn ${source.code} không có order đang hoạt động để tách.`,
          "TABLE_ORDER_SPLIT_NO_ACTIVE_ORDER",
        );
      }

      const orderById = new Map(
        sourceOrders.map((order) => [asId(order._id), order]),
      );
      for (const orderId of selectedByOrder.keys()) {
        if (!orderById.has(orderId)) {
          throw businessError(
            "Có món không còn thuộc phiên order hiện tại của bàn nguồn.",
            "TABLE_ORDER_SPLIT_STALE_SELECTION",
          );
        }
      }

      let activeItemCount = 0;
      let selectedItemCount = 0;
      for (const order of sourceOrders) {
        const selectable = activeItems(order);
        activeItemCount += selectable.length;
        const selectedIds = selectedByOrder.get(asId(order._id)) || new Set();
        for (const itemId of selectedIds) {
          const item = selectable.find((row) => asId(row._id) === itemId);
          if (!item) {
            throw businessError(
              "Món đã thay đổi trạng thái hoặc không còn tồn tại. Vui lòng tải lại.",
              "TABLE_ORDER_SPLIT_STALE_SELECTION",
            );
          }
          if (hasPendingAdjustments(item)) {
            throw businessError(
              `Món ${item.name || ""} đang có yêu cầu hủy/trả chờ duyệt.`,
              "TABLE_ORDER_SPLIT_PENDING_ADJUSTMENT",
            );
          }
          selectedItemCount += 1;
        }
      }

      if (!selectedItemCount || selectedItemCount >= activeItemCount) {
        throw businessError(
          "Cần giữ lại ít nhất một món ở bàn nguồn và chuyển ít nhất một món sang bàn mới.",
          "TABLE_ORDER_SPLIT_MUST_KEEP_BOTH_TABLES",
        );
      }

      const { sessionOrder: targetSession } =
        await ensureActiveTableSessionForDineInOrder({
          OrderModel: Order,
          createOrderCode: generateOrderCode,
          restaurantId,
          tableId: target._id,
          tableCode: target.code,
          userId: ctx?.user?.id,
          session: tx,
          now,
        });

      targetSession.sessionStatus = SESSION_STATUS.DINING;
      targetSession.currentStatus = "pending";
      targetSession.splitStatus = "root";
      targetSession.clientMeta = {
        ...(targetSession.clientMeta || {}),
        tableOrderSplit: {
          splitId: asId(splitId),
          role: "target_session",
          sourceTableId: asId(source._id),
        },
      };
      await targetSession.save({ session: tx });

      const wholeOrderMoves = [];
      const sourceOrderSnapshots = [];
      const itemMoves = [];
      const createdTargetOrderIds = [];
      const kitchenBulk = [];

      for (const sourceOrder of sourceOrders) {
        const selectedIds = selectedByOrder.get(asId(sourceOrder._id));
        if (!selectedIds?.size) continue;

        if (isPaymentLocked(sourceOrder)) {
          throw businessError(
            `Order ${sourceOrder.orderCode} đã bắt đầu thanh toán nên không thể tách.`,
            "TABLE_ORDER_SPLIT_PAYMENT_LOCKED",
          );
        }

        const selectable = activeItems(sourceOrder);
        const picked = selectable.filter((item) =>
          selectedIds.has(asId(item._id)),
        );
        const movesWholeOrder = picked.length === selectable.length;

        sourceOrderSnapshots.push({
          orderId: sourceOrder._id,
          originalSplitStatus: sourceOrder.splitStatus || "none",
          originalClientMeta: sourceOrder.clientMeta || null,
        });

        if (movesWholeOrder) {
          wholeOrderMoves.push({
            orderId: sourceOrder._id,
            originalTableId: sourceOrder.tableId,
            originalTableCode: sourceOrder.tableCode,
            originalParentOrderId: sourceOrder.parentOrderId || null,
            originalRootOrderId: sourceOrder.rootOrderId || null,
            originalParentOrderCode: sourceOrder.parentOrderCode || null,
            originalOrderKind: sourceOrder.orderKind || ORDER_KIND.ORDER_BATCH,
            originalSplitStatus: sourceOrder.splitStatus || "none",
            originalClientMeta: sourceOrder.clientMeta || null,
          });

          sourceOrder.tableId = target._id;
          sourceOrder.tableCode = target.code;
          sourceOrder.tableName = target.code;
          sourceOrder.parentOrderId = targetSession._id;
          sourceOrder.rootOrderId = targetSession._id;
          sourceOrder.parentOrderCode = targetSession.orderCode;
          sourceOrder.orderKind = ORDER_KIND.ORDER_BATCH;
          sourceOrder.splitStatus = "partial";
          sourceOrder.clientMeta = {
            ...(sourceOrder.clientMeta || {}),
            tableOrderSplit: {
              splitId: asId(splitId),
              role: "whole_order",
              originTableId: asId(source._id),
              originTableCode: source.code,
              originParentOrderId: asId(
                wholeOrderMoves[wholeOrderMoves.length - 1].originalParentOrderId,
              ),
            },
          };
          sourceOrder.statusTimeline.push({
            status: sourceOrder.currentStatus,
            at: now,
            byUserId: toId(ctx?.user?.id),
            note: `Chuyển nguyên đợt order sang bàn ${target.code}.`,
          });
          await sourceOrder.save({ session: tx });
          continue;
        }

        const selectedWithIndex = sourceOrder.items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => selectedIds.has(asId(item._id)));
        const [targetOrder] = await Order.create(
          [
            targetOrderPayload({
              sourceOrder,
              target,
              targetSession,
              selectedItems: selectedWithIndex.map(({ item }) => item),
              splitId,
              now,
            }),
          ],
          { session: tx },
        );
        createdTargetOrderIds.push(targetOrder._id);

        selectedWithIndex.forEach(({ item, index }, moveIndex) => {
          const targetItem = targetOrder.items[moveIndex];
          itemMoves.push({
            sourceOrderId: sourceOrder._id,
            sourceOrderCode: sourceOrder.orderCode,
            sourceItemId: item._id,
            targetOrderId: targetOrder._id,
            targetOrderCode: targetOrder.orderCode,
            targetItemId: targetItem._id,
            originalIndex: index,
          });
          kitchenBulk.push({
            updateOne: {
              filter: {
                restaurantId,
                orderId: sourceOrder._id,
                orderItemId: item._id,
              },
              update: {
                $set: {
                  orderId: targetOrder._id,
                  orderCode: targetOrder.orderCode,
                  orderItemId: targetItem._id,
                },
              },
            },
          });
        });

        sourceOrder.items = sourceOrder.items.filter(
          (item) => !selectedIds.has(asId(item._id)),
        );
        sourceOrder.splitStatus = "root";
        sourceOrder.clientMeta = {
          ...(sourceOrder.clientMeta || {}),
          tableOrderSplit: {
            splitId: asId(splitId),
            role: "source_order",
            targetTableId: asId(target._id),
            targetTableCode: target.code,
          },
        };
        sourceOrder.statusTimeline.push({
          status: sourceOrder.currentStatus,
          at: now,
          byUserId: toId(ctx?.user?.id),
          note: `Đã tách ${picked.length} món sang bàn ${target.code}.`,
        });
        await sourceOrder.save({ session: tx });
      }

      if (kitchenBulk.length) {
        await KitchenOrderWorkItem.bulkWrite(kitchenBulk, { session: tx });
      }

      await Table.updateOne(
        { _id: source._id, restaurantId },
        { $set: { status: "occupied" } },
        { session: tx },
      );
      await Table.updateOne(
        { _id: target._id, restaurantId },
        { $set: { status: "occupied" } },
        { session: tx },
      );

      [splitRecord] = await TableOrderSplitSession.create(
        [
          {
            _id: splitId,
            restaurantId,
            status: "active",
            source: {
              tableId: source._id,
              tableCode: source.code,
              statusBefore: source.status || "occupied",
              sessionId:
                sourceOrders[0]?.parentOrderId ||
                sourceOrders[0]?.rootOrderId ||
                null,
            },
            target: {
              tableId: target._id,
              tableCode: target.code,
              statusBefore: target.status || "available",
              sessionId: targetSession._id,
            },
            wholeOrderMoves,
            sourceOrderSnapshots,
            itemMoves,
            createdTargetOrderIds,
            createdBy: toId(ctx?.user?.id),
          },
        ],
        { session: tx },
      );
    });
  } finally {
    await tx.endSession();
  }

  await logEvent({
    restaurantId,
    tableId: sourceTableId,
    actorUserId: ctx?.user?.id,
    verb: "order.split_table",
    object: { kind: "TableOrderSplitSession", id: splitRecord._id },
    meta: {
      sourceTableId: asId(splitRecord.source.tableId),
      targetTableId: asId(splitRecord.target.tableId),
      movedItemCount: splitRecord.itemMoves.length,
      movedWholeOrderCount: splitRecord.wholeOrderMoves.length,
    },
    ip: ctx?.req?.ip,
    userAgent: ctx?.req?.headers?.["user-agent"],
  });

  return {
    ok: true,
    message: `Đã tách order từ bàn ${splitRecord.source.tableCode} sang ${splitRecord.target.tableCode}.`,
    split: await serializeSplit(splitRecord),
  };
}

async function loadOrdersForRevert(split, session) {
  const ids = new Set([
    ...(split.wholeOrderMoves || []).map((row) => asId(row.orderId)),
    ...(split.itemMoves || []).flatMap((row) => [
      asId(row.sourceOrderId),
      asId(row.targetOrderId),
    ]),
  ]);
  const orders = await Order.find({
    _id: { $in: [...ids].map(toId).filter(Boolean) },
    restaurantId: split.restaurantId,
  }).session(session);
  return new Map(orders.map((order) => [asId(order._id), order]));
}

function assertRevertable(split, ordersById) {
  for (const order of ordersById.values()) {
    if (isPaymentLocked(order)) {
      throw businessError(
        `Order ${order.orderCode} đã bắt đầu thanh toán nên không thể gộp lại.`,
        "TABLE_ORDER_SPLIT_REVERT_PAYMENT_LOCKED",
      );
    }
  }

  const mappingsByTarget = new Map();
  for (const move of split.itemMoves || []) {
    const key = asId(move.targetOrderId);
    if (!mappingsByTarget.has(key)) mappingsByTarget.set(key, new Set());
    mappingsByTarget.get(key).add(asId(move.targetItemId));
  }
  for (const [targetOrderId, mappedItems] of mappingsByTarget) {
    const targetOrder = ordersById.get(targetOrderId);
    if (!targetOrder) {
      throw businessError(
        "Không tìm thấy order tách để gộp lại.",
        "TABLE_ORDER_SPLIT_REVERT_ORDER_MISSING",
      );
    }
    const currentIds = new Set((targetOrder.items || []).map((item) => asId(item._id)));
    if (
      currentIds.size !== mappedItems.size ||
      [...currentIds].some((id) => !mappedItems.has(id))
    ) {
      throw businessError(
        `Order ${targetOrder.orderCode} đã có món mới hoặc bị thay đổi; không thể gộp tự động.`,
        "TABLE_ORDER_SPLIT_REVERT_TARGET_CHANGED",
      );
    }
  }
}

async function revertTableOrderSplit(_parent, { input }, ctx) {
  const restaurantId = toId(input?.restaurantId);
  const splitId = toId(input?.splitId);
  if (!restaurantId || !splitId) {
    throw businessError("restaurantId hoặc splitId không hợp lệ.");
  }
  await requireSplitPermissions(ctx, restaurantId);

  const tx = await mongoose.startSession();
  let split = null;

  try {
    await tx.withTransaction(async () => {
      split = await TableOrderSplitSession.findOne({
        _id: splitId,
        restaurantId,
        status: "active",
      }).session(tx);
      if (!split) {
        throw businessError(
          "Không tìm thấy lần tách đang hoạt động.",
          "TABLE_ORDER_SPLIT_NOT_ACTIVE",
        );
      }

      const ordersById = await loadOrdersForRevert(split, tx);
      assertRevertable(split, ordersById);

      const involvedTargetIds = new Set([
        ...(split.wholeOrderMoves || []).map((row) => asId(row.orderId)),
        ...(split.createdTargetOrderIds || []).map(asId),
      ]);
      const unrelatedTargetOrder = await Order.findOne({
        restaurantId,
        tableId: split.target.tableId,
        orderKind: { $ne: ORDER_KIND.TABLE_SESSION },
        currentStatus: ACTIVE_ORDER_STATUSES,
        _id: { $nin: [...involvedTargetIds].map(toId).filter(Boolean) },
      })
        .session(tx)
        .lean();
      if (unrelatedTargetOrder) {
        throw businessError(
          `Bàn ${split.target.tableCode} đã phát sinh order mới; không thể gộp tự động.`,
          "TABLE_ORDER_SPLIT_REVERT_TARGET_BUSY",
        );
      }

      const snapshots = new Map(
        (split.sourceOrderSnapshots || []).map((row) => [asId(row.orderId), row]),
      );
      const movesByTarget = new Map();
      for (const move of split.itemMoves || []) {
        const key = asId(move.targetOrderId);
        if (!movesByTarget.has(key)) movesByTarget.set(key, []);
        movesByTarget.get(key).push(move);
      }

      const kitchenBulk = [];
      for (const [targetOrderId, moves] of movesByTarget) {
        const targetOrder = ordersById.get(targetOrderId);
        const byTargetItem = new Map(
          (targetOrder.items || []).map((item) => [asId(item._id), item]),
        );
        const sourceGroups = new Map();
        for (const move of moves) {
          const sourceKey = asId(move.sourceOrderId);
          if (!sourceGroups.has(sourceKey)) sourceGroups.set(sourceKey, []);
          sourceGroups.get(sourceKey).push(move);
        }

        for (const [sourceOrderId, sourceMoves] of sourceGroups) {
          const sourceOrder = ordersById.get(sourceOrderId);
          if (!sourceOrder) {
            throw businessError(
              "Order nguồn không còn tồn tại để gộp lại.",
              "TABLE_ORDER_SPLIT_REVERT_SOURCE_MISSING",
            );
          }
          const mergedItems = [...sourceOrder.items];
          for (const move of [...sourceMoves].sort(
            (a, b) => a.originalIndex - b.originalIndex,
          )) {
            const targetItem = byTargetItem.get(asId(move.targetItemId));
            if (!targetItem) {
              throw businessError(
                "Một món đã tách không còn tồn tại.",
                "TABLE_ORDER_SPLIT_REVERT_ITEM_MISSING",
              );
            }
            const plain =
              typeof targetItem.toObject === "function"
                ? targetItem.toObject()
                : { ...targetItem };
            plain._id = toId(move.sourceItemId);
            mergedItems.splice(
              Math.min(move.originalIndex, mergedItems.length),
              0,
              plain,
            );
            kitchenBulk.push({
              updateOne: {
                filter: {
                  restaurantId,
                  orderId: move.targetOrderId,
                  orderItemId: move.targetItemId,
                },
                update: {
                  $set: {
                    orderId: sourceOrder._id,
                    orderCode: sourceOrder.orderCode,
                    orderItemId: move.sourceItemId,
                  },
                },
              },
            });
          }
          sourceOrder.items = mergedItems;
          const snapshot = snapshots.get(sourceOrderId);
          sourceOrder.splitStatus = snapshot?.originalSplitStatus || "none";
          sourceOrder.clientMeta =
            snapshot?.originalClientMeta || stripSplitMeta(sourceOrder.clientMeta);
          sourceOrder.statusTimeline.push({
            status: sourceOrder.currentStatus,
            at: new Date(),
            byUserId: toId(ctx?.user?.id),
            note: `Gộp các món đã tách từ bàn ${split.target.tableCode} về lại bàn ${split.source.tableCode}.`,
          });
          await sourceOrder.save({ session: tx });
        }

        await Order.deleteOne(
          { _id: targetOrder._id, restaurantId },
          { session: tx },
        );
      }

      for (const move of split.wholeOrderMoves || []) {
        const order = ordersById.get(asId(move.orderId));
        if (!order) {
          throw businessError(
            "Một đợt order nguyên vẹn không còn tồn tại để gộp lại.",
            "TABLE_ORDER_SPLIT_REVERT_ORDER_MISSING",
          );
        }
        order.tableId = move.originalTableId;
        order.tableCode = move.originalTableCode;
        order.tableName = move.originalTableCode;
        order.parentOrderId = move.originalParentOrderId || null;
        order.rootOrderId = move.originalRootOrderId || null;
        order.parentOrderCode = move.originalParentOrderCode || null;
        order.orderKind = move.originalOrderKind || ORDER_KIND.ORDER_BATCH;
        order.splitStatus = move.originalSplitStatus || "none";
        order.clientMeta = move.originalClientMeta || null;
        order.statusTimeline.push({
          status: order.currentStatus,
          at: new Date(),
          byUserId: toId(ctx?.user?.id),
          note: `Gộp nguyên đợt order về lại bàn ${split.source.tableCode}.`,
        });
        await order.save({ session: tx });
      }

      if (kitchenBulk.length) {
        await KitchenOrderWorkItem.bulkWrite(kitchenBulk, { session: tx });
      }

      const remainingTargetChildren = await Order.countDocuments({
        restaurantId,
        parentOrderId: split.target.sessionId,
        orderKind: { $ne: ORDER_KIND.TABLE_SESSION },
        currentStatus: ACTIVE_ORDER_STATUSES,
      }).session(tx);
      if (!remainingTargetChildren && split.target.sessionId) {
        await Order.deleteOne(
          {
            _id: split.target.sessionId,
            restaurantId,
            orderKind: ORDER_KIND.TABLE_SESSION,
          },
          { session: tx },
        );
      }

      await Table.updateOne(
        { _id: split.source.tableId, restaurantId },
        { $set: { status: "occupied" } },
        { session: tx },
      );
      await Table.updateOne(
        { _id: split.target.tableId, restaurantId },
        { $set: { status: split.target.statusBefore || "available" } },
        { session: tx },
      );

      split.status = "reverted";
      split.revertedBy = toId(ctx?.user?.id);
      split.revertedAt = new Date();
      split.revertReason = String(input?.reason || "").trim() || "merged_back";
      split.cleanupAt = new Date(Date.now() + REVERT_RETENTION_MS);
      await split.save({ session: tx });
    });
  } finally {
    await tx.endSession();
  }

  await logEvent({
    restaurantId,
    tableId: split.source.tableId,
    actorUserId: ctx?.user?.id,
    verb: "order.revert_table_split",
    object: { kind: "TableOrderSplitSession", id: split._id },
    meta: {
      sourceTableId: asId(split.source.tableId),
      targetTableId: asId(split.target.tableId),
    },
    ip: ctx?.req?.ip,
    userAgent: ctx?.req?.headers?.["user-agent"],
  });

  return {
    ok: true,
    message: `Đã gộp order từ bàn ${split.target.tableCode} về lại ${split.source.tableCode}.`,
    split: await serializeSplit(split),
  };
}

async function canRevertSplit(split) {
  if (!split || split.status !== "active") return false;
  const orderIds = [
    ...(split.wholeOrderMoves || []).map((row) => row.orderId),
    ...(split.itemMoves || []).flatMap((row) => [
      row.sourceOrderId,
      row.targetOrderId,
    ]),
  ];
  const orders = await Order.find({
    _id: { $in: orderIds },
    restaurantId: split.restaurantId,
  })
    .select({
      payment: 1,
      orderPaymentStatus: 1,
      items: 1,
      orderCode: 1,
    })
    .lean();
  if (orders.some(isPaymentLocked)) return false;

  const mappedTargetItems = new Map();
  for (const move of split.itemMoves || []) {
    const key = asId(move.targetOrderId);
    if (!mappedTargetItems.has(key)) mappedTargetItems.set(key, new Set());
    mappedTargetItems.get(key).add(asId(move.targetItemId));
  }
  for (const order of orders) {
    const mapped = mappedTargetItems.get(asId(order._id));
    if (!mapped) continue;
    const current = new Set((order.items || []).map((item) => asId(item._id)));
    if (
      current.size !== mapped.size ||
      [...current].some((id) => !mapped.has(id))
    ) {
      return false;
    }
  }
  return true;
}

async function serializeSplit(split) {
  if (!split) return null;
  const plain =
    typeof split?.toObject === "function"
      ? split.toObject({ virtuals: true })
      : split;
  return {
    id: asId(plain._id || plain.id),
    status: plain.status,
    sourceTable: {
      id: asId(plain.source?.tableId),
      code: plain.source?.tableCode,
    },
    targetTable: {
      id: asId(plain.target?.tableId),
      code: plain.target?.tableCode,
    },
    movedItemCount:
      Number(plain.itemMoves?.length || 0) +
      Number(plain.wholeOrderMoves?.length || 0),
    movedPartialItemCount: Number(plain.itemMoves?.length || 0),
    movedWholeOrderCount: Number(plain.wholeOrderMoves?.length || 0),
    canRevert: await canRevertSplit(plain),
    createdAt: plain.createdAt,
    revertedAt: plain.revertedAt,
  };
}

async function activeTableOrderSplit(_parent, { restaurantId, tableId }, ctx) {
  const rid = toId(restaurantId);
  const tid = toId(tableId);
  if (!rid || !tid) return null;
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_READ);
  return serializeSplit(await findActiveSplit(rid, tid));
}

export const TableOrderSplitQuery = { activeTableOrderSplit };
export const TableOrderSplitMutation = {
  splitTableOrder,
  revertTableOrderSplit,
};

export default {
  Query: TableOrderSplitQuery,
  Mutation: TableOrderSplitMutation,
};
