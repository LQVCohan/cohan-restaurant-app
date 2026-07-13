const SKIPPED_ITEM_STATUSES = new Set(["cancelled", "returned"]);

export const normalizeOrderProofImages = (values = []) =>
  Array.isArray(values)
    ? [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];

const orderItemKey = (item = {}) => String(item?._id || item?.id || "");

export const getOrderItemProofWaiver = (item = {}, proofWaivers = {}) => {
  const key = orderItemKey(item);
  if (!key || !proofWaivers || typeof proofWaivers !== "object") return null;
  const waiver = proofWaivers[key];
  return waiver?.waived === true ? waiver : null;
};

export const isOrderItemProofWaived = (item = {}, proofWaivers = {}) =>
  Boolean(getOrderItemProofWaiver(item, proofWaivers));

export const requiresOrderItemProofImage = (item = {}) => {
  const mode = String(
    item?.servingVariant?.mode || item?.variant?.mode || "",
  ).toUpperCase();
  const unit = String(
    item?.unit ||
      item?.servingVariant?.sellUnit ||
      item?.variant?.sellUnit ||
      "",
  ).toLowerCase();

  return mode === "BY_WEIGHT" || unit === "kg" || Number(item?.weightGrams || 0) > 0;
};

export const requiresOrderItemWeight = (item = {}) =>
  String(item?.servingVariant?.mode || item?.variant?.mode || "").toUpperCase() ===
  "BY_WEIGHT";

export const hasValidOrderItemWeight = (item = {}) => {
  if (!requiresOrderItemWeight(item)) return true;
  const grams = Number(item?.weightGrams);
  return Number.isInteger(grams) && grams > 0;
};

export const getOrderProofReadinessIssues = (items = [], proofWaivers = {}) =>
  (Array.isArray(items) ? items : []).flatMap((item) => {
    const status = String(item?.status || "pending").toLowerCase();
    if (SKIPPED_ITEM_STATUSES.has(status)) return [];

    const requiresProof = requiresOrderItemProofImage(item);
    const proofWaived = isOrderItemProofWaived(item, proofWaivers);
    const missingProof =
      requiresProof &&
      !proofWaived &&
      normalizeOrderProofImages(item?.proofImages).length === 0;
    const missingWeight = !hasValidOrderItemWeight(item);

    if (!missingProof && !missingWeight) return [];

    return [
      {
        itemId: orderItemKey(item),
        itemName: String(item?.name || "Món chưa đặt tên"),
        missingProof,
        missingWeight,
        proofWaived,
      },
    ];
  });

export const formatOrderProofReadinessError = (issues = []) => {
  const details = issues
    .slice(0, 5)
    .map((issue) => {
      const missing = [
        issue?.missingWeight ? "thiếu cân nặng" : null,
        issue?.missingProof ? "thiếu ảnh minh chứng" : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `${issue?.itemName || "Món"} (${missing})`;
    })
    .join("; ");

  return `Chưa thể chuyển bếp. Vui lòng bổ sung thông tin cho: ${details}.`;
};
