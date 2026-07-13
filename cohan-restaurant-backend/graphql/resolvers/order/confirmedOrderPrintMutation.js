import mongoose from "mongoose";
import {
  KitchenOrderWorkItem,
  Order,
  PrintSetting,
  Table,
  Warehouse,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { cancelReservationForOrderTx } from "../../../src/services/inventory.service.js";
import { syncKitchenOrderWorkItemsForKitchenEntry } from "../../../src/services/kitchen/kitchenOrderWorkItem.service.js";
import {
  emitCustomerTrackingUpdateIfChanged,
  updatePublicStatusHistory,
} from "../../../src/services/orderTracking.service.js";
import {
  KITCHEN_STATUS,
  SESSION_STATUS,
} from "../../../utils/orderLifecycle.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";
import { toId } from "./helper/orderUtils.js";

const VALID_STATIONS = new Set(["kitchen", "bar"]);
const SKIPPED_STATUSES = new Set(["cancelled", "returned"]);
const CLAIMED_STATUS = "customer_attached";

async function requireIncomingReviewPermission(ctx, restaurantId, primaryPermission) {
  try {
    await requireRestaurantPermission(ctx, restaurantId, primaryPermission);
  } catch (primaryError) {
    try {
      await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.PAYMENT_WRITE);
    } catch {
      throw primaryError;
    }
  }
}

function assertPositiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return number;
}

function assertPositiveNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${field} must be greater than zero`);
  }
  return number;
}

function buildInventoryLines(items = []) {
  return (items || [])
    .filter(
      (item) =>
        item?.dishId &&
        !SKIPPED_STATUSES.has(String(item?.status || "").toLowerCase()),
    )
    .map((item) => {
      const servingKey = String(item?.servingKey || "").trim();
      if (!servingKey) throw new Error("servingKey is required for inventory");
      const mode = String(item?.servingVariant?.mode || "").toUpperCase();
      if (mode === "BY_WEIGHT") {
        return {
          menuItemId: item.dishId,
          quantity: 1,
          weightGrams: assertPositiveInteger(item.weightGrams, "weightGrams"),
          servingKey,
          servingMode: "BY_WEIGHT",
          preparationMethodName: item?.servingVariant?.name || null,
        };
      }
      return {
        menuItemId: item.dishId,
        quantity: assertPositiveNumber(item.quantity || 1, "quantity"),
        weightGrams:
          item.weightGrams == null
            ? null
            : assertPositiveInteger(item.weightGrams, "weightGrams"),
        servingKey,
        servingMode: item?.servingVariant?.mode || null,
        preparationMethodName: item?.servingVariant?.name || null,
      };
    });
}

async function resolveWarehouseId(restaurantId, warehouseIdInput, session) {
  if (warehouseIdInput) {
    const warehouseId = toId(warehouseIdInput);
    if (!warehouseId) throw new Error("Invalid warehouseId");
    const selected = await Warehouse.findOne({
      _id: warehouseId,
      restaurantId,
      isActive: { $ne: false },
    })
      .session(session)
      .lean();
    if (!selected) throw new Error("Warehouse not found");
    return selected._id;
  }

  const warehouse = await Warehouse.findOne({
    restaurantId,
    isActive: { $ne: false },
  })
    .sort({ createdAt: 1, _id: 1 })
    .session(session)
    .lean();
  if (!warehouse?._id) throw new Error("No warehouse found for this restaurant");
  return warehouse._id;
}

function buildTicketLine(item) {
  const itemType = String(item?.itemType || "MENU_ITEM").toUpperCase();
  const comboSnapshot = item?.comboSnapshot || null;
  const quantity = Number(item?.quantity || 0);
  const comboItems =
    itemType === "COMBO" && Array.isArray(comboSnapshot?.items)
      ? comboSnapshot.items.map((child, index) => ({
          menuItemId: String(child?.menuItemId || child?.id || ""),
          name: child?.name || "Món trong combo",
          quantity:
            Math.max(1, Number(child?.qty || child?.quantity || 1)) *
            Math.max(1, quantity || 1),
          note: child?.note || child?.options || "",
          index,
        }))
      : [];

  return {
    orderItemId: String(item?._id || ""),
    dishId: String(item?.dishId || ""),
    name: comboSnapshot?.name || item?.name || "",
    quantity,
    note: item?.note || "",
    itemType,
    comboId: item?.comboId ? String(item.comboId) : "",
    comboSnapshot: itemType === "COMBO" ? comboSnapshot : null,
    comboItems,
  };
}

async function enqueueStationTickets(order) {
  if (
    !order?._id ||
    !order?.restaurantId ||
    !Array.isArray(order?.items) ||
    order.currentStatus !== "confirmed"
  ) {
    return [];
  }

  const printSetting = await PrintSetting.findOne({
    restaurantId: order.restaurantId,
  }).lean();
  if (!printSetting) return [];

  const activeItems = order.items.filter(
    (item) =>
      item?._id &&
      !SKIPPED_STATUSES.has(String(item?.status || "").toLowerCase()),
  );
  if (!activeItems.length) return [];

  const workItems = await KitchenOrderWorkItem.find({
    restaurantId: order.restaurantId,
    orderId: order._id,
    orderItemId: { $in: activeItems.map((item) => item._id) },
  })
    .select({ orderItemId: 1, station: 1 })
    .lean();

  const stationByItemId = new Map(
    workItems.map((workItem) => [
      String(workItem.orderItemId),
      String(workItem.station || "").toLowerCase(),
    ]),
  );
  const itemsByStation = {};

  for (const item of activeItems) {
    const itemId = String(item._id);
    const station = stationByItemId.get(itemId);
    if (!VALID_STATIONS.has(station)) {
      throw new Error(
        `Order item ${itemId} is missing a valid preparation-station snapshot`,
      );
    }
    if (!itemsByStation[station]) itemsByStation[station] = [];
    itemsByStation[station].push(item);
  }

  const stationPrinters = printSetting?.stations || {};
  const printerById = new Map(
    (Array.isArray(printSetting?.printers) ? printSetting.printers : [])
      .filter((printer) => printer?.id)
      .map((printer) => [String(printer.id), printer]),
  );
  const templateEnabledByKey = new Map(
    (Array.isArray(printSetting?.templates) ? printSetting.templates : [])
      .filter((template) => template?.key)
      .map((template) => [String(template.key), template.enabled !== false]),
  );

  const jobs = Object.entries(itemsByStation).flatMap(([station, items]) => {
    if (templateEnabledByKey.get(station) === false) return [];
    const assignedPrinterIds = Array.from(
      new Set(
        (Array.isArray(stationPrinters?.[station]) ? stationPrinters[station] : [])
          .map(String)
          .filter((printerId) => printerById.has(printerId)),
      ),
    );

    return assignedPrinterIds.map((printerId) => {
      const printer = printerById.get(printerId);
      const createdAt = new Date().toISOString();
      const unavailable = String(printer?.status || "offline").toLowerCase() === "offline";
      return {
        id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        orderId: String(order._id),
        stationId: station,
        stationType: station,
        printerId,
        printerName: printer?.name || null,
        printType: "order_confirmed",
        templateKey: station,
        items: items.map(buildTicketLine),
        status: unavailable ? "failed" : "pending",
        error: unavailable ? "Printer is not configured or available" : null,
        retryCount: 0,
        payload: {
          orderCode: order.orderCode,
          tableCode: order.tableCode,
        },
        createdAt,
        printedAt: null,
        updatedAt: createdAt,
      };
    });
  });

  if (!jobs.length) return [];

  await PrintSetting.updateOne(
    { _id: printSetting._id },
    {
      $push: { jobs: { $each: jobs, $position: 0, $slice: 300 } },
      $set: { updatedAt: new Date() },
    },
  );

  return jobs;
}

async function loadScopedPendingOrder({ id, restaurantId }) {
  const orderId = toId(id);
  if (!orderId) throw new Error("Invalid order id");
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (
    restaurantId &&
    String(order.restaurantId) !== String(toId(restaurantId))
  ) {
    throw new Error("Order not found");
  }
  if (order.currentStatus !== "pending") {
    throw new Error("Only pending orders can be reviewed");
  }
  return order;
}

export const ConfirmedOrderPrintMutation = {
  async confirmIncomingOrder(_parent, { input }, ctx) {
    const { id, restaurantId, note } = input || {};
    const initialOrder = await loadScopedPendingOrder({ id, restaurantId });
    await requireIncomingReviewPermission(
      ctx,
      initialOrder.restaurantId,
      PERMISSIONS.ORDER_UPDATE,
    );

    const acceptedAt = new Date();
    const acceptedBy = toId(ctx?.user?.id || ctx?.user?._id);
    const session = await mongoose.startSession();
    let confirmedOrder = null;

    try {
      await session.withTransaction(async () => {
        const claimed = await Order.findOneAndUpdate(
          {
            _id: initialOrder._id,
            currentStatus: "pending",
            $or: [
              { "clientMeta.acceptedAt": { $exists: false } },
              { "clientMeta.acceptedAt": null },
            ],
          },
          {
            $set: {
              currentStatus: CLAIMED_STATUS,
              "clientMeta.acceptedAt": acceptedAt,
              "clientMeta.acceptedBy": acceptedBy || null,
            },
          },
          { new: true, session },
        );
        if (!claimed) {
          throw new Error("Đơn đã được nhân viên/POS khác tiếp nhận.");
        }

        const previousPublicStatus = claimed.publicStatus;
        claimed.currentStatus = "confirmed";
        claimed.kitchenStatus = KITCHEN_STATUS.CONFIRMED;
        claimed.statusTimeline = claimed.statusTimeline || [];
        claimed.statusTimeline.push({
          status: "confirmed",
          at: acceptedAt,
          note: note || "Incoming order confirmed by staff/POS",
          byUserId: acceptedBy || undefined,
        });
        updatePublicStatusHistory(claimed, "STAFF");
        await claimed.save({ session });

        if (
          String(claimed?.clientMeta?.source || "").toLowerCase() ===
            "customer_table_qr" &&
          claimed.tableId
        ) {
          await Table.updateOne(
            {
              _id: claimed.tableId,
              restaurantId: claimed.restaurantId,
              status: { $in: ["available", "reserved", "occupied"] },
            },
            { $set: { status: "occupied" } },
            { session },
          );
        }
        claimed.$locals = claimed.$locals || {};
        claimed.$locals.prevPublicStatus = previousPublicStatus;

        await syncKitchenOrderWorkItemsForKitchenEntry({
          order: claimed,
          actorUserId: acceptedBy,
          now: acceptedAt,
          session,
        });
        confirmedOrder = claimed;
      });
    } finally {
      await session.endSession();
    }

    emitCustomerTrackingUpdateIfChanged({
      ctx,
      orderDoc: confirmedOrder,
      previousPublicStatus: confirmedOrder?.$locals?.prevPublicStatus || null,
      force: true,
    });
    await emitOrderEvent(ctx, confirmedOrder.restaurantId, "ORDER_STATUS_CHANGED", {
      order: confirmedOrder,
      meta: {
        statusFrom: "pending",
        statusTo: "confirmed",
        note: note || "Incoming order confirmed by staff/POS",
      },
    });

    try {
      const printJobs = await enqueueStationTickets(confirmedOrder);
      if (printJobs.length) {
        await emitOrderEvent(
          ctx,
          String(confirmedOrder.restaurantId),
          "ORDER_PRINT_JOBS_CREATED",
          {
            orderId: String(confirmedOrder._id),
            orderCode: confirmedOrder.orderCode,
            printJobs,
          },
        );
      }
    } catch (error) {
      console.warn(
        "[ORDER_PRINT] Confirmed order accepted but station print job creation failed",
        error?.message || error,
      );
    }

    return { order: confirmedOrder.toJSON() };
  },

  async rejectIncomingOrder(_parent, { input }, ctx) {
    const { id, restaurantId, reason, warehouseId } = input || {};
    const rejectionReason = String(reason || "").trim();
    if (rejectionReason.length < 3) {
      throw new Error("Vui lòng nhập lý do từ chối rõ ràng.");
    }

    const initialOrder = await loadScopedPendingOrder({ id, restaurantId });
    await requireIncomingReviewPermission(
      ctx,
      initialOrder.restaurantId,
      PERMISSIONS.ORDER_CANCEL,
    );

    const rejectedAt = new Date();
    const rejectedBy = toId(ctx?.user?.id || ctx?.user?._id);
    const session = await mongoose.startSession();
    let rejectedOrder = null;

    try {
      await session.withTransaction(async () => {
        const claimed = await Order.findOneAndUpdate(
          { _id: initialOrder._id, currentStatus: "pending" },
          {
            $set: {
              currentStatus: CLAIMED_STATUS,
              "clientMeta.rejectedAt": rejectedAt,
              "clientMeta.rejectedBy": rejectedBy || null,
              "clientMeta.rejectionReason": rejectionReason,
            },
          },
          { new: true, session },
        );
        if (!claimed) {
          throw new Error("Đơn đã được nhân viên/POS khác xử lý.");
        }

        const inventoryLines = buildInventoryLines(claimed.items || []);
        if (inventoryLines.length) {
          const warehouseIdResolved = await resolveWarehouseId(
            claimed.restaurantId,
            warehouseId,
            session,
          );
          await cancelReservationForOrderTx({
            restaurantId: claimed.restaurantId,
            warehouseId: warehouseIdResolved,
            orderCode: claimed.orderCode,
            lines: inventoryLines,
            session,
          });
        }

        const previousPublicStatus = claimed.publicStatus;
        claimed.currentStatus = "cancelled";
        claimed.kitchenStatus = KITCHEN_STATUS.CANCELLED;
        claimed.sessionStatus = SESSION_STATUS.CANCELLED;
        claimed.statusTimeline = claimed.statusTimeline || [];
        claimed.statusTimeline.push({
          status: "cancelled",
          at: rejectedAt,
          note: rejectionReason,
          byUserId: rejectedBy || undefined,
        });
        updatePublicStatusHistory(claimed, "STAFF");
        await claimed.save({ session });
        claimed.$locals = claimed.$locals || {};
        claimed.$locals.prevPublicStatus = previousPublicStatus;
        rejectedOrder = claimed;
      });
    } finally {
      await session.endSession();
    }

    emitCustomerTrackingUpdateIfChanged({
      ctx,
      orderDoc: rejectedOrder,
      previousPublicStatus: rejectedOrder?.$locals?.prevPublicStatus || null,
      force: true,
    });
    await emitOrderEvent(
      ctx,
      rejectedOrder.restaurantId,
      "ORDER_CANCELLED",
      rejectedOrder,
    );

    return { order: rejectedOrder.toJSON() };
  },
};

export default ConfirmedOrderPrintMutation;
