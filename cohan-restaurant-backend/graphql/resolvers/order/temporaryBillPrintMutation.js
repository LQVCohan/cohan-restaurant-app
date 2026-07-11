import { Order, PrintSetting } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireAnyRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";
import { toId } from "./helper/orderUtils.js";

const CASHIER_STATION = "cashier";
const RECEIPT_TEMPLATE = "receipt";
const PRINT_JOB_LIMIT = 300;
const TEMPORARY_BILL_PERMISSIONS = [
  PERMISSIONS.ORDER_UPDATE,
  PERMISSIONS.PAYMENT_WRITE,
  PERMISSIONS.PRINT_WRITE,
];

function uniqueConfiguredPrinterIds(printSetting = {}) {
  const printerById = new Map(
    (Array.isArray(printSetting.printers) ? printSetting.printers : [])
      .filter((printer) => printer?.id)
      .map((printer) => [String(printer.id), printer]),
  );
  const assignedIds = Array.isArray(printSetting?.stations?.[CASHIER_STATION])
    ? printSetting.stations[CASHIER_STATION]
    : [];

  return {
    printerById,
    printerIds: Array.from(
      new Set(
        assignedIds
          .map(String)
          .filter((printerId) => printerById.has(printerId)),
      ),
    ),
  };
}

function isReceiptTemplateEnabled(printSetting = {}) {
  const templates = Array.isArray(printSetting.templates) ? printSetting.templates : [];
  const receipt = templates.find((template) => String(template?.key) === RECEIPT_TEMPLATE);
  return receipt?.enabled !== false;
}

function buildTemporaryBillJob({ order, printer }) {
  const createdAt = new Date().toISOString();
  const unavailable = String(printer?.status || "").toLowerCase() === "offline";
  return {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    orderId: String(order._id),
    stationId: CASHIER_STATION,
    stationType: CASHIER_STATION,
    printerId: String(printer.id),
    printerName: printer.name || null,
    printType: "temporary_bill",
    templateKey: RECEIPT_TEMPLATE,
    items: [],
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
}

export async function createTemporaryBillPrintJob(_parent, { input }, ctx) {
  const { orderId, restaurantId } = input || {};
  const oid = toId(orderId);
  const rid = toId(restaurantId);
  if (!oid || !rid) throw new Error("orderId and restaurantId are required");

  const order = await Order.findById(oid).lean();
  if (!order || String(order.restaurantId) !== String(rid)) {
    throw new Error("Order not found");
  }
  await requireAnyRestaurantPermission(
    ctx,
    order.restaurantId,
    TEMPORARY_BILL_PERMISSIONS,
  );
  if (order.currentStatus !== "confirmed") {
    throw new Error("Only confirmed orders can be printed");
  }

  const printSetting = await PrintSetting.findOne({ restaurantId: order.restaurantId }).lean();
  if (!printSetting) {
    return { ok: false, message: "Chưa cấu hình in cho nhà hàng." };
  }
  if (!isReceiptTemplateEnabled(printSetting)) {
    return { ok: false, message: "Mẫu hóa đơn đang tắt." };
  }

  const { printerById, printerIds } = uniqueConfiguredPrinterIds(printSetting);
  if (!printerIds.length) {
    return { ok: false, message: "Chưa cấu hình máy in thu ngân." };
  }

  const jobs = printerIds.map((printerId) => buildTemporaryBillJob({
    order,
    printer: printerById.get(printerId),
  }));

  await PrintSetting.updateOne(
    { _id: printSetting._id },
    {
      $push: {
        jobs: {
          $each: jobs,
          $position: 0,
          $slice: PRINT_JOB_LIMIT,
        },
      },
      $set: { updatedAt: new Date() },
    },
  );

  await emitOrderEvent(
    ctx,
    String(order.restaurantId),
    "ORDER_PRINT_JOBS_CREATED",
    {
      orderId: String(order._id),
      orderCode: order.orderCode,
      printJobs: jobs,
    },
  );

  return {
    ok: true,
    message: `Đã tạo ${jobs.length} lệnh in tạm tính.`,
  };
}

export const TemporaryBillPrintMutation = { createTemporaryBillPrintJob };
export default TemporaryBillPrintMutation;
