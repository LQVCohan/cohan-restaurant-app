import { mapCustomTableSpecToTableForm } from "./table3dCustomModelBuilder";

export const TABLE_3D_TYPES = {
  ROUND: "round-table",
  RECT_2: "rect-2-seat",
  RECT_4: "rect-4-seat",
  VIP: "vip-table",
  BOOTH: "booth-sofa",
  BAR: "bar-table",
  OUTDOOR: "outdoor-table",
};

export const TABLE_3D_PUBLIC_CATALOG_URL =
  import.meta.env.VITE_TABLE_3D_PUBLIC_CATALOG_URL || "";

const KAYKIT_RESTAURANT_GLTF_BASE =
  "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0/main/addons/kaykit_restaurant_bits/Assets/gltf";
const KAYKIT_RESTAURANT_ASSET_BASE =
  "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0/main/addons/kaykit_restaurant_bits";
const KHRONOS_SAMPLE_ASSET_BASE =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models";
export const TABLE_3D_PLACEHOLDER_THUMB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
      <rect width="320" height="220" fill="#f5f7fb"/>
      <rect x="36" y="150" width="248" height="12" rx="6" fill="#8b5e3c"/>
      <rect x="64" y="92" width="192" height="64" rx="12" fill="#b98962"/>
      <rect x="92" y="156" width="12" height="34" rx="6" fill="#6f4b2f"/>
      <rect x="216" y="156" width="12" height="34" rx="6" fill="#6f4b2f"/>
      <text x="160" y="44" text-anchor="middle" font-size="20" fill="#1f2937" font-family="Arial, sans-serif">Table Preview</text>
    </svg>`,
  );

const KAYKIT_SOURCE =
  "https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0";
const KHRONOS_SOURCE = "https://github.com/KhronosGroup/glTF-Sample-Assets";
const KAYKIT_THUMB = `${KAYKIT_RESTAURANT_ASSET_BASE}/sample.png`;

export const LOCAL_TABLE_3D_CATALOG = [
  {
    key: "round-kaykit-classic-4",
    label: "Bàn tròn nhà hàng 4 chỗ",
    tableType: TABLE_3D_TYPES.ROUND,
    capacity: 4,
    defaultScale: 1,
    modelUrl: `${KAYKIT_RESTAURANT_GLTF_BASE}/table_round_A.gltf`,
    thumbnailUrl: KAYKIT_THUMB,
    source: KAYKIT_SOURCE,
    sourceLabel: "KayKit Restaurant Bits",
    licenseLabel: "CC0",
    dimensionsCm: { diameter: 110, height: 76 },
    tags: ["round", "wood", "classic", "restaurant", "cc0"],
    fallbackKind: "model",
  },
  {
    key: "rect-2-kaykit-compact",
    label: "Bàn chữ nhật 2 chỗ nhỏ gọn",
    tableType: TABLE_3D_TYPES.RECT_2,
    capacity: 2,
    defaultScale: 0.9,
    modelUrl: `${KAYKIT_RESTAURANT_GLTF_BASE}/kitchentable_A.gltf`,
    thumbnailUrl: KAYKIT_THUMB,
    source: KAYKIT_SOURCE,
    sourceLabel: "KayKit Restaurant Bits",
    licenseLabel: "CC0",
    dimensionsCm: { width: 80, depth: 70, height: 76 },
    tags: ["rectangular", "compact", "wood", "2-seat", "cc0"],
    fallbackKind: "model",
  },
  {
    key: "rect-4-kaykit-family",
    label: "Bàn chữ nhật 4 chỗ tiêu chuẩn",
    tableType: TABLE_3D_TYPES.RECT_4,
    capacity: 4,
    defaultScale: 1,
    modelUrl: `${KAYKIT_RESTAURANT_GLTF_BASE}/kitchentable_B_large.gltf`,
    thumbnailUrl: KAYKIT_THUMB,
    source: KAYKIT_SOURCE,
    sourceLabel: "KayKit Restaurant Bits",
    licenseLabel: "CC0",
    dimensionsCm: { width: 140, depth: 80, height: 76 },
    tags: ["rectangular", "family", "wood", "4-seat", "cc0"],
    fallbackKind: "model",
  },
  {
    key: "vip-lounge-placeholder-6",
    label: "Bàn VIP lounge 6 chỗ",
    tableType: TABLE_3D_TYPES.VIP,
    capacity: 6,
    defaultScale: 1.15,
    modelUrl: "",
    thumbnailUrl: TABLE_3D_PLACEHOLDER_THUMB,
    source: "placeholder-local",
    sourceLabel: "Cohan placeholder",
    licenseLabel: "N/A - no external model",
    dimensionsCm: { width: 180, depth: 110, height: 76 },
    tags: ["vip", "lounge", "premium", "placeholder"],
    fallbackKind: "placeholder",
  },
  {
    key: "booth-sofa-khronos-4",
    label: "Booth/Sofa 4 chỗ",
    tableType: TABLE_3D_TYPES.BOOTH,
    capacity: 4,
    defaultScale: 1.05,
    modelUrl: `${KHRONOS_SAMPLE_ASSET_BASE}/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb`,
    thumbnailUrl: `${KHRONOS_SAMPLE_ASSET_BASE}/GlamVelvetSofa/screenshot/screenshot.jpg`,
    source: `${KHRONOS_SOURCE}/tree/main/Models/GlamVelvetSofa`,
    sourceLabel: "Khronos glTF Sample Assets / GlamVelvetSofa",
    licenseLabel: "CC BY 4.0",
    dimensionsCm: { width: 210, depth: 90, height: 85 },
    tags: ["booth", "sofa", "velvet", "lounge", "cc-by"],
    fallbackKind: "model",
  },
  {
    key: "bar-high-placeholder-2",
    label: "Bàn bar cao 2 chỗ",
    tableType: TABLE_3D_TYPES.BAR,
    capacity: 2,
    defaultScale: 1,
    modelUrl: "",
    thumbnailUrl: TABLE_3D_PLACEHOLDER_THUMB,
    source: "placeholder-local",
    sourceLabel: "Cohan placeholder",
    licenseLabel: "N/A - no external model",
    dimensionsCm: { diameter: 70, height: 105 },
    tags: ["bar", "high", "modern", "placeholder"],
    fallbackKind: "placeholder",
  },
  {
    key: "outdoor-round-kaykit-4",
    label: "Bàn outdoor tròn 4 chỗ",
    tableType: TABLE_3D_TYPES.OUTDOOR,
    capacity: 4,
    defaultScale: 1,
    modelUrl: `${KAYKIT_RESTAURANT_GLTF_BASE}/table_round_B.gltf`,
    thumbnailUrl: KAYKIT_THUMB,
    source: KAYKIT_SOURCE,
    sourceLabel: "KayKit Restaurant Bits",
    licenseLabel: "CC0",
    dimensionsCm: { diameter: 100, height: 74 },
    tags: ["outdoor", "round", "wood", "patio", "cc0"],
    fallbackKind: "model",
  },
];

export const TABLE_3D_TYPE_OPTIONS = [
  { value: TABLE_3D_TYPES.ROUND, label: "Round table" },
  { value: TABLE_3D_TYPES.RECT_2, label: "Rectangular 2-seat" },
  { value: TABLE_3D_TYPES.RECT_4, label: "Rectangular 4-seat" },
  { value: TABLE_3D_TYPES.VIP, label: "VIP table" },
  { value: TABLE_3D_TYPES.BOOTH, label: "Booth/Sofa table" },
  { value: TABLE_3D_TYPES.BAR, label: "Bar table" },
  { value: TABLE_3D_TYPES.OUTDOOR, label: "Outdoor table" },
];

export const TABLE_3D_TYPE_TO_AREA = {
  [TABLE_3D_TYPES.ROUND]: "standard",
  [TABLE_3D_TYPES.RECT_2]: "standard",
  [TABLE_3D_TYPES.RECT_4]: "standard",
  [TABLE_3D_TYPES.VIP]: "vip",
  [TABLE_3D_TYPES.BOOTH]: "booth",
  [TABLE_3D_TYPES.BAR]: "bar",
  [TABLE_3D_TYPES.OUTDOOR]: "outdoor",
};

export const mapTable3DTypeToArea = (tableType) =>
  TABLE_3D_TYPE_TO_AREA[tableType] || "standard";

export const mapModelToTableForm = (model) => {
  if (model?.customModelSpec) {
    const customMapped = mapCustomTableSpecToTableForm(model.customModelSpec);
    return {
      area: customMapped.area,
      seats: customMapped.seats,
      visualTemplate: model?.key || model?.customModelSpec?.name || "",
    };
  }

  const area = mapTable3DTypeToArea(model?.tableType);
  return {
    area,
    seats: Number(model?.capacity || 4),
    visualTemplate: model?.key || "",
  };
};

const normalizeDimensionsCm = (dimensionsCm) => {
  if (!dimensionsCm || typeof dimensionsCm !== "object") return null;

  return Object.entries(dimensionsCm).reduce((acc, [key, value]) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) acc[key] = parsed;
    return acc;
  }, {});
};

export const formatDimensionsCm = (dimensionsCm) => {
  const normalized = normalizeDimensionsCm(dimensionsCm);
  if (!normalized || !Object.keys(normalized).length) return "";

  if (normalized.diameter) {
    return `Ø ${normalized.diameter}cm${normalized.height ? ` × cao ${normalized.height}cm` : ""}`;
  }

  const parts = [normalized.width, normalized.depth, normalized.height].filter(
    Boolean,
  );
  return parts.length ? `${parts.join(" × ")}cm` : "";
};

export const normalizeCatalogItem = (item) => {
  const normalizedType = Object.values(TABLE_3D_TYPES).includes(item?.tableType)
    ? item.tableType
    : TABLE_3D_TYPES.RECT_4;
  const modelUrl = item?.modelUrl || "";
  const fallbackKind =
    item?.fallbackKind === "placeholder" || !modelUrl ? "placeholder" : "model";

  return {
    key: item?.key || "",
    label: item?.label || "Mẫu bàn 3D",
    tableType: normalizedType,
    capacity: Number(item?.capacity || 4),
    defaultScale: Number(item?.defaultScale || 1),
    modelUrl,
    thumbnailUrl: item?.thumbnailUrl || TABLE_3D_PLACEHOLDER_THUMB,
    source: item?.source || "public",
    sourceLabel: item?.sourceLabel || item?.source || "public",
    licenseLabel: item?.licenseLabel || "Chưa rõ license",
    dimensionsCm: normalizeDimensionsCm(item?.dimensionsCm),
    tags: Array.isArray(item?.tags)
      ? item.tags.map(String).filter(Boolean)
      : [],
    fallbackKind,
    customModelKind: item?.customModelKind || "",
    sourceType: item?.sourceType || "",
    aiJobId: item?.aiJobId || "",
    aiProvider: item?.aiProvider || "",
    generationStatus: item?.generationStatus || "",
  };
};

export const canOpenModelViewerAr = (model) =>
  Boolean(model?.modelUrl && String(model.modelUrl).trim());

export const getArUnavailableReason = (model) => {
  if (!model) return "Chọn mẫu để kiểm tra hỗ trợ AR.";
  if (!canOpenModelViewerAr(model)) {
    return "Mẫu này chưa có model 3D công khai nên chưa thể mở AR. Vui lòng chọn mẫu có badge 3D/AR hoặc nhập model .glb/.gltf hợp lệ.";
  }
  return "";
};

export const getModelAssetSummary = (model) => {
  if (!model) {
    return {
      has3DModel: false,
      arReady: false,
      source: "Chưa chọn mẫu",
      sourceUrl: "",
      license: "—",
      dimensions: "",
      modelKey: "—",
      badges: [],
      dimensionsLabel: "",
    };
  }

  const dimensionsLabel = formatDimensionsCm(model.dimensionsCm);

  return {
    has3DModel: Boolean(model.modelUrl && String(model.modelUrl).trim()),
    arReady: canOpenModelViewerAr(model),
    source: model.sourceLabel || model.source || "Không rõ nguồn",
    sourceUrl: model.source || "",
    license: model.licenseLabel || "Chưa rõ license",
    dimensions: dimensionsLabel,
    dimensionsLabel,
    modelKey: model.key || "—",
    badges: getModelAssetBadges(model),
  };
};

export const getModelAssetBadges = (model) => {
  if (!model) return [];
  const badges = [];
  const hasModel = canOpenModelViewerAr(model);
  const customKind = String(model.customModelKind || "").toLowerCase();
  const source = String(model.source || model.sourceType || "").toLowerCase();
  const isCustom = Boolean(
    model.customModelSpec ||
      customKind ||
      ["user-upload", "ai-generated"].includes(source),
  );

  if (isCustom) badges.push("Custom");
  if (customKind.includes("ai") || source.includes("ai")) badges.push("AI");
  if (customKind === "upload" || source.includes("upload")) badges.push("Upload");

  if (hasModel) {
    badges.push("3D", "AR", "Online");
  } else {
    badges.push("Placeholder");
  }

  if (model.licenseLabel) badges.push(model.licenseLabel);
  return [...new Set(badges)];
};
