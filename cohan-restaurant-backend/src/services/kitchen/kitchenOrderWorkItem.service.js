import { KitchenOrderWorkItem, KitchenShiftRosterSnapshot } from "../../../models/index.js";

const BAR_KEYWORDS = [
  "drink",
  "beverage",
  "đồ uống",
  "nuoc",
  "nước",
  "trà",
  "tra",
  "cà phê",
  "ca phe",
  "coffee",
  "juice",
  "beer",
  "cocktail",
  "bar",
];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function toUniqueIds(values = []) {
  return [...new Set(values.map((v) => String(v || "")).filter(Boolean))];
}

export function resolveOrderItemStation(item = {}) {
  const signals = [item?.name, item?.categoryName, item?.category?.name]
    .map(normalizeText)
    .join(" ");

  const isBar = BAR_KEYWORDS.some((keyword) => signals.includes(keyword));
  return isBar ? "bar" : "kitchen";
}

export async function findKitchenRosterForOrderItem({ restaurantId, station, at }) {
  if (!restaurantId || !station) return null;
  const pointInTime = at || new Date();

  const rows = await KitchenShiftRosterSnapshot.find({
    restaurantId,
    station,
    status: "active",
    startTime: { $lte: pointInTime },
    endTime: { $gte: pointInTime },
  })
    .sort({ startTime: -1 })
    .lean();

  if (!rows?.length) return null;

  const groupedByShift = rows.reduce((acc, row) => {
    const key = String(row?.shiftId || "no-shift");
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(row);
    return acc;
  }, new Map());

  const groups = [...groupedByShift.values()];
  groups.sort((a, b) => new Date(b[0]?.startTime || 0) - new Date(a[0]?.startTime || 0));
  const selectedGroup = groups[0] || [];
  if (!selectedGroup.length) return null;

  const firstRow = selectedGroup[0];
  const headRow =
    selectedGroup.find((row) => row?.kitchenDutyRole === "head_chef") ||
    selectedGroup.find((row) => row?.kitchenDutyRole === "cook") ||
    selectedGroup.find((row) => row?.employeeId);

  const assistantChefIds = toUniqueIds(
    selectedGroup
      .filter((row) => ["assistant_chef", "helper"].includes(row?.kitchenDutyRole))
      .map((row) => row?.employeeId),
  );
  const teamEmployeeIds = toUniqueIds(selectedGroup.map((row) => row?.employeeId));
  const barLeadRow = selectedGroup.find((row) => row?.kitchenDutyRole === "bar_lead");

  return {
    rosterSnapshotId: headRow?._id || firstRow?._id || null,
    schedulePublicationId: firstRow?.schedulePublicationId || null,
    shiftId: firstRow?.shiftId || null,
    shiftType: firstRow?.shiftType || null,
    headChefId: station === "kitchen" ? headRow?.employeeId || null : null,
    assistantChefIds,
    teamEmployeeIds,
    barLeadId: station === "bar" ? barLeadRow?.employeeId || null : null,
    barStaffIds: station === "bar" ? teamEmployeeIds : [],
  };
}

export async function upsertKitchenOrderWorkItemForStatusChange({
  order,
  item,
  previousStatus,
  nextStatus,
  actorUserId,
  now,
  session,
}) {
  if (!order?._id || !item?._id || !nextStatus) return null;

  const atNow = now || new Date();
  const existingWorkItem = await KitchenOrderWorkItem.findOne({
    orderId: order._id,
    orderItemId: item._id,
  })
    .lean()
    .session(session);

  const station = resolveOrderItemStation(item);
  const set = {
    restaurantId: order?.restaurantId,
    orderId: order?._id,
    orderCode: order?.orderCode || null,
    orderItemId: item?._id,
    dishId: item?.dishId || null,
    menuId: item?.menuId || null,
    categoryId: item?.categoryId || null,
    dishName: item?.name || null,
    quantity: Number(item?.quantity || 0),
    station,
    status: nextStatus,
    lastStatusChangedAt: atNow,
    updatedBy: actorUserId || null,
  };

  if (!existingWorkItem?.createdBy && actorUserId) set.createdBy = actorUserId;

  if (nextStatus === "preparing") {
    set.kitchenEnteredAt = existingWorkItem?.kitchenEnteredAt || atNow;
    set.preparingAt = existingWorkItem?.preparingAt || atNow;
  }
  if (nextStatus === "ready") {
    set.readyAt = existingWorkItem?.readyAt || atNow;
    const baseStart = existingWorkItem?.preparingAt || existingWorkItem?.kitchenEnteredAt;
    if (baseStart) {
      set.actualPrepMinutes = Math.max(0, Math.round((new Date(set.readyAt) - new Date(baseStart)) / 60000));
    }
  }
  if (nextStatus === "served") set.servedAt = existingWorkItem?.servedAt || atNow;
  if (nextStatus === "cancelled") set.cancelledAt = existingWorkItem?.cancelledAt || atNow;
  if (nextStatus === "returned") set.returnedAt = existingWorkItem?.returnedAt || atNow;

  const rosterAt = set.kitchenEnteredAt || existingWorkItem?.kitchenEnteredAt || atNow || order?.createdAt || new Date();
  const roster = await findKitchenRosterForOrderItem({
    restaurantId: order?.restaurantId,
    station,
    at: rosterAt,
  });

  if (roster) {
    set.noRoster = false;
    set.noRosterReason = null;
    Object.assign(set, roster);
  } else {
    set.noRoster = true;
    set.noRosterReason = "Không tìm thấy roster bếp/bar active theo thời điểm món vào bếp.";
  }

  return KitchenOrderWorkItem.findOneAndUpdate(
    { orderId: order._id, orderItemId: item._id },
    {
      $set: set,
      $setOnInsert: {
        createdBy: actorUserId || null,
        status: previousStatus || "pending",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).session(session);
}
