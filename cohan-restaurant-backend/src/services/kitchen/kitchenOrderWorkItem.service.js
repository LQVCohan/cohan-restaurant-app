import {
  KitchenOrderWorkItem,
  KitchenShiftRosterSnapshot,
  MenuItem,
} from "../../../models/index.js";
import { classifyKitchenOrderIssueReason } from "./kitchenOrderIssueReason.service.js";

export const DEFAULT_KITCHEN_TARGET_PREP_MINUTES = 20;
export const DEFAULT_BAR_TARGET_PREP_MINUTES = 10;
export const DEFAULT_LATE_GRACE_MINUTES = 5;
export const DEFAULT_VERY_LATE_GRACE_MINUTES = 15;
export const DEFAULT_UNACCEPTED_GRACE_MINUTES = 5;
export const DEFAULT_BAR_UNACCEPTED_GRACE_MINUTES = 3;

const PREP_STATIONS = new Set(["kitchen", "bar"]);

function toUniqueIds(values = []) {
  return [...new Set(values.map((v) => String(v || "")).filter(Boolean))];
}

function toPositiveNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizePrepStation(value) {
  const station = String(value || "").trim().toLowerCase();
  return PREP_STATIONS.has(station) ? station : null;
}

export function resolveUnacceptedGraceMinutes(workItem = {}) {
  return workItem?.station === "bar"
    ? DEFAULT_BAR_UNACCEPTED_GRACE_MINUTES
    : DEFAULT_UNACCEPTED_GRACE_MINUTES;
}

export function resolveUnacceptedResponsibleEmployeeIds(workItem = {}) {
  if (workItem?.station === "bar") {
    return toUniqueIds(
      workItem?.barStaffIds?.length
        ? workItem.barStaffIds
        : workItem?.barLeadId
          ? [workItem.barLeadId]
          : workItem?.teamEmployeeIds || [],
    );
  }

  return toUniqueIds(
    workItem?.assistantChefIds?.length
      ? workItem.assistantChefIds
      : workItem?.teamEmployeeIds?.length
        ? workItem.teamEmployeeIds
        : workItem?.headChefId
          ? [workItem.headChefId]
          : [],
  );
}

export async function resolveOrderItemStation({
  order,
  item,
  existingWorkItem,
  session,
}) {
  if (existingWorkItem) {
    const existingStation = normalizePrepStation(existingWorkItem.station);
    if (!existingStation) {
      throw new Error("Kitchen work item has an invalid preparation station");
    }
    return existingStation;
  }

  const snapshotStation = normalizePrepStation(item?.prepStation);
  if (snapshotStation) return snapshotStation;

  const isCombo = String(item?.itemType || "").toUpperCase() === "COMBO";
  if (!isCombo) {
    throw new Error(
      `Order item ${String(item?._id || "")} is missing a valid prepStation snapshot`,
    );
  }

  if (!order?.restaurantId || !item?.dishId) {
    throw new Error(
      "Cannot resolve combo preparation station without restaurantId and dishId",
    );
  }

  // ponytail: combos are still one parent work item; use its current anchor dish
  // until combo children become independent order lines.
  let query = MenuItem.findOne({
    _id: item.dishId,
    restaurantId: order.restaurantId,
  })
    .select({ prepStation: 1 })
    .lean();
  if (session) query = query.session(session);

  const menuItem = await query;
  const station = normalizePrepStation(menuItem?.prepStation);
  if (!station) {
    throw new Error(
      `Combo anchor menu item ${String(item.dishId)} is missing a valid prepStation`,
    );
  }
  return station;
}

export function resolveTargetPrepMinutes(item, station) {
  const resolved =
    toPositiveNumber(item?.targetPrepMinutes) ||
    toPositiveNumber(item?.prepTimeMinutes) ||
    toPositiveNumber(item?.estimatedPrepMinutes) ||
    toPositiveNumber(item?.servingVariant?.targetPrepMinutes);

  if (resolved) return resolved;
  return station === "bar"
    ? DEFAULT_BAR_TARGET_PREP_MINUTES
    : DEFAULT_KITCHEN_TARGET_PREP_MINUTES;
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

  const station = await resolveOrderItemStation({
    order,
    item,
    existingWorkItem,
    session,
  });
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

  if (nextStatus === "preparing") {
    set.kitchenEnteredAt = existingWorkItem?.kitchenEnteredAt || atNow;
    set.preparingAt = existingWorkItem?.preparingAt || atNow;
  }
  if (nextStatus === "ready") {
    set.readyAt = existingWorkItem?.readyAt || atNow;
    const baseStart = existingWorkItem?.preparingAt || existingWorkItem?.kitchenEnteredAt;
    if (baseStart) {
      set.actualPrepMinutes = Math.max(
        0,
        Math.round((new Date(set.readyAt) - new Date(baseStart)) / 60000),
      );
    }

    const hasExistingTarget =
      Number.isFinite(existingWorkItem?.targetPrepMinutes) &&
      existingWorkItem.targetPrepMinutes > 0;
    const targetPrepMinutes = hasExistingTarget
      ? existingWorkItem.targetPrepMinutes
      : resolveTargetPrepMinutes(item, station);
    set.targetPrepMinutes = targetPrepMinutes;
    set.timeLevel = resolvePrepTimeLevel(set.actualPrepMinutes, targetPrepMinutes);
  }
  if (nextStatus === "served") set.servedAt = existingWorkItem?.servedAt || atNow;
  if (nextStatus === "cancelled") set.cancelledAt = existingWorkItem?.cancelledAt || atNow;
  if (nextStatus === "returned") set.returnedAt = existingWorkItem?.returnedAt || atNow;

  const rosterAt =
    set.kitchenEnteredAt ||
    existingWorkItem?.kitchenEnteredAt ||
    atNow ||
    order?.createdAt ||
    new Date();
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

  const update = { $set: set };
  if (existingWorkItem) {
    if (!existingWorkItem.createdBy && actorUserId) {
      set.createdBy = actorUserId;
    }
  } else {
    update.$setOnInsert = {
      createdBy: actorUserId || null,
    };
  }

  return KitchenOrderWorkItem.findOneAndUpdate(
    { orderId: order._id, orderItemId: item._id },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).session(session);
}

export async function upsertKitchenOrderWorkItemForKitchenEntry({
  order,
  item,
  actorUserId,
  now,
  session,
}) {
  if (!order?._id || !order?.restaurantId || !item?._id) return null;

  const existingWorkItem = await KitchenOrderWorkItem.findOne({
    orderId: order._id,
    orderItemId: item._id,
  })
    .lean()
    .session(session);
  const station = await resolveOrderItemStation({
    order,
    item,
    existingWorkItem,
    session,
  });

  const at = existingWorkItem?.kitchenEnteredAt || now || order?.createdAt || new Date();
  const roster = await findKitchenRosterForOrderItem({
    restaurantId: order.restaurantId,
    station,
    at,
  });

  const set = {
    status: item?.status || "pending",
    kitchenEnteredAt: existingWorkItem?.kitchenEnteredAt || at,
    lastStatusChangedAt: existingWorkItem?.lastStatusChangedAt || at,
    updatedBy: actorUserId || null,
  };

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
      $setOnInsert: {
        restaurantId: order?.restaurantId || null,
        orderId: order?._id || null,
        orderCode: order?.orderCode || null,
        orderItemId: item?._id || null,
        dishId: item?.dishId || null,
        menuId: item?.menuId || null,
        categoryId: item?.categoryId || null,
        dishName: item?.name || null,
        quantity: Number(item?.quantity || 0),
        station,
        createdBy: actorUserId || null,
      },
      $set: set,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).session(session);
}

export async function syncKitchenOrderWorkItemsForKitchenEntry({
  order,
  actorUserId,
  now,
  session,
}) {
  if (!order || !Array.isArray(order.items)) return { syncedCount: 0 };

  let syncedCount = 0;
  for (const item of order.items) {
    const normalizedStatus = String(item?.status || "").toLowerCase();
    if (!item?._id || ["cancelled", "returned"].includes(normalizedStatus)) continue;
    await upsertKitchenOrderWorkItemForKitchenEntry({
      order,
      item,
      actorUserId,
      now,
      session,
    });
    syncedCount += 1;
  }

  return { syncedCount };
}

export async function markUnacceptedKitchenOrderWorkItems({
  restaurantId,
  now,
  graceMinutes,
  session,
}) {
  if (!restaurantId) return { matchedCount: 0, modifiedCount: 0 };

  const atNow = now || new Date();
  const sharedGraceMinutes = toPositiveNumber(graceMinutes);
  const query = {
    restaurantId,
    status: "pending",
    unaccepted: { $ne: true },
    kitchenEnteredAt: { $exists: true },
  };

  if (sharedGraceMinutes) {
    query.kitchenEnteredAt.$lte = new Date(atNow.getTime() - sharedGraceMinutes * 60000);
  }

  const candidates = await KitchenOrderWorkItem.find(query).session(session);
  let matchedCount = 0;
  let modifiedCount = 0;

  for (const workItem of candidates || []) {
    const grace = sharedGraceMinutes || resolveUnacceptedGraceMinutes(workItem);
    const enteredAt = workItem?.kitchenEnteredAt ? new Date(workItem.kitchenEnteredAt) : null;
    if (!enteredAt) continue;

    const overdue = atNow.getTime() - enteredAt.getTime() >= grace * 60000;
    if (!overdue) continue;

    matchedCount += 1;
    const updateResult = await KitchenOrderWorkItem.updateOne(
      { _id: workItem._id, unaccepted: { $ne: true } },
      {
        $set: {
          unaccepted: true,
          unacceptedAt: atNow,
          unacceptedAfterMinutes: grace,
          unacceptedResponsibleEmployeeIds: resolveUnacceptedResponsibleEmployeeIds(workItem),
          unacceptedReason: "Món chưa được nhận sau ngưỡng thời gian cho phép.",
          updatedAt: atNow,
        },
      },
      { session },
    );

    if (updateResult?.modifiedCount > 0) modifiedCount += updateResult.modifiedCount;
  }

  return { matchedCount, modifiedCount };
}

export async function syncKitchenOrderWorkItemForVoidOrReturn({
  order,
  item,
  previousStatus,
  nextStatus,
  actorUserId,
  now,
  session,
  issueType,
  issueReason,
  issueReviewNote,
  issueRefundMode,
}) {
  if (!order?._id || !item?._id || !nextStatus) return null;
  if (!["cancelled", "returned"].includes(nextStatus)) return null;

  const workItem = await upsertKitchenOrderWorkItemForStatusChange({
    order,
    item,
    previousStatus,
    nextStatus,
    actorUserId,
    now,
    session,
  });

  const reasonMeta = classifyKitchenOrderIssueReason(issueReason);
  await KitchenOrderWorkItem.findOneAndUpdate(
    { orderId: order._id, orderItemId: item._id },
    {
      $set: {
        issueType: issueType || null,
        issueReason: issueReason || null,
        issueReasonCategory: reasonMeta.category || "unknown",
        issueReasonKitchenRelated: Boolean(reasonMeta.isKitchenRelated),
        issueReasonMatchedKeyword: reasonMeta.matchedKeyword || null,
        issueReviewNote: issueReviewNote || null,
        issueRefundMode: issueRefundMode || null,
      },
    },
    { new: true },
  ).session(session);

  return workItem;
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
