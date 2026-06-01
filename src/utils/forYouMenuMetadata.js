export const getForYouMetadataStatus = (item) => {
  const dietTags = Array.isArray(item?.dietTags) ? item.dietTags : [];
  const allergenTags = Array.isArray(item?.allergenTags) ? item.allergenTags : [];
  const tasteProfile = item?.tasteProfile || {};

  const hasDietTags = dietTags.length > 0;
  const hasAllergenTags = allergenTags.length > 0;
  const hasTasteProfile =
    !!tasteProfile.containsOnion ||
    !!tasteProfile.containsCilantro ||
    Number(tasteProfile.sugar ?? 100) !== 100 ||
    String(tasteProfile.spice || "Vừa") !== "Vừa";

  const hasAnyMetadata = hasDietTags || hasAllergenTags || hasTasteProfile;
  const hasCompleteMetadata = hasDietTags && hasAllergenTags && hasTasteProfile;

  return {
    hasDietTags,
    hasAllergenTags,
    hasTasteProfile,
    hasAnyMetadata,
    hasCompleteMetadata,
    status: hasAnyMetadata ? "ready" : "missing",
    label: hasAnyMetadata ? "Đã khai báo khẩu vị" : "Chưa khai báo khẩu vị",
  };
};

export const getForYouMetadataSummary = (items = []) => {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.length;

  const summary = safeItems.reduce(
    (acc, item) => {
      const status = item?.forYouMetadata || getForYouMetadataStatus(item);

      if (status.status === "ready") acc.ready += 1;
      if (status.status === "missing") acc.missing += 1;
      if (status.hasCompleteMetadata) acc.complete += 1;
      if (status.hasDietTags) acc.withDiet += 1;
      if (status.hasAllergenTags) acc.withAllergen += 1;
      if (status.hasTasteProfile) acc.withTaste += 1;
      if (!status.hasDietTags) acc.missingDiet += 1;
      if (!status.hasAllergenTags) acc.missingAllergen += 1;
      if (!status.hasTasteProfile) acc.missingTaste += 1;

      return acc;
    },
    {
      total,
      ready: 0,
      missing: 0,
      complete: 0,
      withDiet: 0,
      withAllergen: 0,
      withTaste: 0,
      missingDiet: 0,
      missingAllergen: 0,
      missingTaste: 0,
    },
  );

  return {
    ...summary,
    readyPercent: total > 0 ? Math.round((summary.ready / total) * 100) : 0,
  };
};


export const getForYouMetadataSummaryByRestaurant = (items = []) => {
  const groups = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const restaurantId = String(item?.restaurantId || "unknown");
    const restaurantName = item?.restaurantName || item?.restaurant?.name || "Nhà hàng hiện tại";
    if (!groups.has(restaurantId)) groups.set(restaurantId, { restaurantId, restaurantName, items: [] });
    groups.get(restaurantId).items.push(item);
  });

  return Array.from(groups.values()).map((group) => ({
    restaurantId: group.restaurantId,
    restaurantName: group.restaurantName,
    ...getForYouMetadataSummary(group.items),
  }));
};
