const normalizeText = (value) => String(value || "").trim().toLowerCase();

export const normalizeProofImages = (proofImages) =>
  Array.isArray(proofImages)
    ? [...new Set(proofImages.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];

const proofItemKey = (item = {}) => String(item?._id || item?.id || "");

export const getProofImageWaiver = (item = {}, proofWaivers = {}) => {
  const key = proofItemKey(item);
  if (!key || !proofWaivers || typeof proofWaivers !== "object") return null;
  const waiver = proofWaivers[key];
  return waiver?.waived === true ? waiver : null;
};

export const isProofImageWaived = (item = {}, proofWaivers = {}) =>
  Boolean(getProofImageWaiver(item, proofWaivers));

/**
 * Canonical V1 rule: evidence is required only for structured by-weight items.
 * Avoid name/note keyword matching because it can disagree with backend snapshots.
 */
export const requiresProofImage = (item = {}) => {
  const unit = normalizeText(item.unit);
  const servingMode = normalizeText(
    item.servingVariant?.mode || item.variant?.mode,
  );
  const servingUnit = normalizeText(
    item.servingVariant?.sellUnit || item.variant?.sellUnit,
  );

  return (
    servingMode === "by_weight" ||
    unit === "kg" ||
    servingUnit === "kg" ||
    Number(item.weightGrams || 0) > 0
  );
};

export const buildProofState = (item = {}, proofWaivers = {}) => {
  const proofImages = normalizeProofImages(item.proofImages);
  const requiresProof = requiresProofImage({ ...item, proofImages });
  const waived = isProofImageWaived(item, proofWaivers);
  return {
    proofImages,
    hasPhoto: proofImages.length > 0,
    requiresProof,
    waived,
    ready: !requiresProof || proofImages.length > 0 || waived,
  };
};
