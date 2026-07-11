import { MenuAvailabilityWatch } from "../../models/index.js";
import { notifyAvailabilityWatchersForMenuItem } from "./menuAvailabilityWatch.service.js";

export async function notifyAvailableMenuWatchers({
  io = null,
  maxGroups = 100,
  maxWatchersPerGroup = 50,
  source = "availability_sweep",
} = {}) {
  const groupLimit = Math.max(1, Number(maxGroups || 100));
  const watcherLimit = Math.max(1, Number(maxWatchersPerGroup || 50));
  const candidates = await MenuAvailabilityWatch.find({
    status: "watching",
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(groupLimit * watcherLimit)
    .lean({ virtuals: true });

  const groups = new Map();
  for (const watch of candidates) {
    const restaurantId = String(watch?.restaurantId || "");
    const menuItemId = String(watch?.menuItemId || "");
    const servingKey = String(watch?.servingKey || "portion");
    if (!restaurantId || !menuItemId) continue;
    const key = `${restaurantId}:${menuItemId}:${servingKey}`;
    if (!groups.has(key) && groups.size < groupLimit) {
      groups.set(key, { restaurantId, menuItemId, servingKey });
    }
  }

  let notified = 0;
  let skipped = 0;
  for (const group of groups.values()) {
    const result = await notifyAvailabilityWatchersForMenuItem({
      io,
      ...group,
      source,
      maxWatchers: watcherLimit,
    });
    notified += Number(result?.notified || 0);
    skipped += Number(result?.skipped || 0);
  }

  return { groupsScanned: groups.size, notified, skipped };
}
