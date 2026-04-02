const PROOF_KEYWORDS = [
  "kg",
  "sống",
  "tươi",
  "hải sản sống",
  "cân ký",
  "theo kg",
];

const normalizeText = (value) => String(value || "").toLowerCase();

export const normalizeProofImages = (proofImages) =>
  Array.isArray(proofImages) ? proofImages.filter(Boolean) : [];

/**
 * V1 business rule: các món BY_WEIGHT / kg / sống / tươi bắt buộc có ảnh minh chứng.
 */
export const requiresProofImage = (item = {}) => {
  const unit = normalizeText(item.unit);
  const servingMode = normalizeText(item.servingVariant?.mode || item.variant?.mode);
  const servingUnit = normalizeText(
    item.servingVariant?.sellUnit || item.variant?.sellUnit
  );

  if (servingMode === "by_weight") return true;
  if (unit === "kg" || servingUnit === "kg") return true;
  if (Number(item.weightGrams || 0) > 0) return true;

  const haystack = [
    item.name,
    item.prep,
    item.serveOrder,
    item.note,
    item.variantName,
    item.servingVariant?.name,
  ]
    .map(normalizeText)
    .join(" ");

  return PROOF_KEYWORDS.some((keyword) => haystack.includes(keyword));
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
