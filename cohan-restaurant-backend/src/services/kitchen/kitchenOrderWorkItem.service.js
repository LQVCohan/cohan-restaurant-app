import { KitchenOrderWorkItem, KitchenShiftRosterSnapshot } from "../../../models/index.js";

export const DEFAULT_KITCHEN_TARGET_PREP_MINUTES = 20;
export const DEFAULT_BAR_TARGET_PREP_MINUTES = 10;
export const DEFAULT_LATE_GRACE_MINUTES = 5;
export const DEFAULT_VERY_LATE_GRACE_MINUTES = 15;

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

function toPositiveNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveOrderItemStation(item = {}) {
  const signals = [item?.name, item?.categoryName, item?.category?.name]
    .map(normalizeText)
    .join(" ");

  const isBar = BAR_KEYWORDS.some((keyword) => signals.includes(keyword));
  return isBar ? "bar" : "kitchen";
}

export function resolveTargetPrepMinutes(item, station) {
  const resolved =
    toPositiveNumber(item?.targetPrepMinutes) ||
    toPositiveNumber(item?.prepTimeMinutes) ||
    toPositiveNumber(item?.estimatedPrepMinutes) ||
    toPositiveNumber(item?.servingVariant?.targetPrepMinutes);

  if (resolved) return resolved;
  return station === "bar" ? DEFAULT_BAR_TARGET_PREP_MINUTES : DEFAULT_KITCHEN_TARGET_PREP_MINUTES;
}

export function resolvePrepTimeLevel(actualPrepMinutes, targetPrepMinutes) {
  if (!Number.isFinite(actualPrepMinutes) || actualPrepMinutes < 0) return null;
  if (!Number.isFinite(targetPrepMinutes) || targetPrepMinutes <= 0) return null;

  const lateThreshold = targetPrepMinutes + DEFAULT_LATE_GRACE_MINUTES;

  if (actualPrepMinutes <= targetPrepMinutes) return "on_time";
  // "late": target < actual <= target + DEFAULT_LATE_GRACE_MINUTES
  if (actualPrepMinutes <= lateThreshold) return "late";
  // "very_late": actual > target + DEFAULT_LATE_GRACE_MINUTES
  // DEFAULT_VERY_LATE_GRACE_MINUTES is reserved for future threshold tuning.
  return "very_late";
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

    const hasExistingTarget = Number.isFinite(existingWorkItem?.targetPrepMinutes) && existingWorkItem.targetPrepMinutes > 0;
    const targetPrepMinutes = hasExistingTarget
      ? existingWorkItem.targetPrepMinutes
      : resolveTargetPrepMinutes(item, station);
    set.targetPrepMinutes = targetPrepMinutes;
    set.timeLevel = resolvePrepTimeLevel(set.actualPrepMinutes, targetPrepMinutes);
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


export async function syncKitchenOrderWorkItemForVoidOrReturn({
  order,
  item,
  previousStatus,
  nextStatus,
  actorUserId,
  now,
  session,
}) {
  if (!order?._id || !item?._id || !nextStatus) return null;
  if (!['cancelled', 'returned'].includes(nextStatus)) return null;

  return upsertKitchenOrderWorkItemForStatusChange({
    order,
    item,
    previousStatus,
    nextStatus,
    actorUserId,
    now,
    session,
  });
}

export async function syncKitchenOrderWorkItemsForOrderStatusChange({
  order,
  itemTransitions,
  actorUserId,
  now,
  session,
}) {
  if (!order?._id || !Array.isArray(itemTransitions) || !itemTransitions.length) {
    return { syncedCount: 0 };
  }

  let syncedCount = 0;
  for (const transition of itemTransitions) {
    const item = transition?.item;
    const nextStatus = transition?.nextStatus;
    if (!item?._id || !nextStatus) continue;

    await upsertKitchenOrderWorkItemForStatusChange({
      order,
      item,
      previousStatus: transition?.previousStatus,
      nextStatus,
      actorUserId,
      now,
      session,
    });
    syncedCount += 1;
  }

  return { syncedCount };
}
