import {
  KitchenOrderWorkItem,
  Order,
  PrintSetting,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { syncKitchenOrderWorkItemsForKitchenEntry } from "../../../src/services/kitchen/kitchenOrderWorkItem.service.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";
import { toId } from "./helper/orderUtils.js";

const VALID_STATIONS = new Set(["kitchen", "bar"]);
const SKIPPED_STATUSES = new Set(["cancelled", "returned"]);
const CLAIMED_STATUS = "customer_attached";

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
  const jobs = Object.entries(itemsByStation)
    .filter(
      ([station]) =>
        Array.isArray(stationPrinters?.[station]) &&
        Boolean(stationPrinters[station][0]),
    )
    .map(([station, items]) => {
      const createdAt = new Date().toISOString();
      return {
        id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        orderId: String(order._id),
        stationId: station,
        stationType: station,
        printerId: stationPrinters[station][0],
        printType: "order_confirmed",
        items: items.map(buildTicketLine),
        status: "pending",
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

export const ConfirmedOrderPrintMutation = {
  async confirmIncomingOrder(parent, { input }, ctx) {
    const { id, restaurantId, note, warehouseId } = input || {};
    const order = await Order.findById(id);
    if (!order) throw new Error("Order not found");

    await requireRestaurantPermission(
      ctx,
      order.restaurantId,
      PERMISSIONS.ORDER_UPDATE,
    );

    if (
      restaurantId &&
      String(order.restaurantId) !== String(toId(restaurantId))
    ) {
      throw new Error("Order not found");
    }
    if (order.currentStatus !== "pending") {
      throw new Error("Only pending orders can be confirmed");
    }
    if (typeof this?.updateOrderStatus !== "function") {
      throw new Error("updateOrderStatus resolver is unavailable");
    }

    const acceptedAt = new Date();
    const acceptedBy = toId(ctx?.user?.id || ctx?.user?._id);
    const claimed = await Order.findOneAndUpdate(
      {
        _id: order._id,
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
      { new: true },
    );

    if (!claimed) {
      throw new Error("Đơn đã được nhân viên/POS khác tiếp nhận.");
    }

    let updated;
    try {
      updated = await this.updateOrderStatus(
        parent,
        {
          input: {
            id: String(order._id),
            restaurantId: restaurantId || String(order.restaurantId),
            status: "confirmed",
            note: note || "Incoming order confirmed by POS",
            warehouseId,
          },
        },
        ctx,
      );
    } catch (error) {
      await Order.updateOne(
        {
          _id: order._id,
          currentStatus: CLAIMED_STATUS,
          "clientMeta.acceptedAt": acceptedAt,
          "clientMeta.acceptedBy": acceptedBy || null,
        },
        {
          $set: { currentStatus: "pending" },
          $unset: {
            "clientMeta.acceptedAt": "",
            "clientMeta.acceptedBy": "",
          },
        },
      ).catch(() => {});
      throw error;
    }

    const confirmedOrder = await Order.findById(order._id);
    if (!confirmedOrder) throw new Error("Order not found after confirmation");

    await syncKitchenOrderWorkItemsForKitchenEntry({
      order: confirmedOrder,
      actorUserId: acceptedBy,
      now: acceptedAt,
      session: null,
    });

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

    return { order: updated };
  },
};

export default ConfirmedOrderPrintMutation;
