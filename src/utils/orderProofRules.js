const normalizeText = (value) => String(value || "").trim().toLowerCase();

export const normalizeProofImages = (proofImages) =>
  Array.isArray(proofImages)
    ? [...new Set(proofImages.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];

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

export const buildProofState = (item = {}) => {
  const proofImages = normalizeProofImages(item.proofImages);
  const requiresProof = requiresProofImage({ ...item, proofImages });
  return {
    proofImages,
    hasPhoto: proofImages.length > 0,
    requiresProof,
  };
};
