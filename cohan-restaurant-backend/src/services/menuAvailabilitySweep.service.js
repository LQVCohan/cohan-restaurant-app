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
  const groups = await MenuAvailabilityWatch.aggregate([
    {
      $match: {
        status: "watching",
        expiresAt: { $gt: new Date() },
      },
    },
    {
      $group: {
        _id: {
          restaurantId: "$restaurantId",
          menuItemId: "$menuItemId",
          servingKey: { $ifNull: ["$servingKey", "portion"] },
        },
        firstCreatedAt: { $min: "$createdAt" },
      },
    },
    { $sort: { firstCreatedAt: 1, "_id.menuItemId": 1 } },
    { $limit: groupLimit },
  ]);

  let notified = 0;
  let skipped = 0;
  for (const group of groups) {
    const restaurantId = String(group?._id?.restaurantId || "");
    const menuItemId = String(group?._id?.menuItemId || "");
    const servingKey = String(group?._id?.servingKey || "portion");
    if (!restaurantId || !menuItemId) continue;

    const result = await notifyAvailabilityWatchersForMenuItem({
      io,
      restaurantId,
      menuItemId,
      servingKey,
      source,
      maxWatchers: watcherLimit,
    });
    notified += Number(result?.notified || 0);
    skipped += Number(result?.skipped || 0);
  }

  return { groupsScanned: groups.length, notified, skipped };
}
