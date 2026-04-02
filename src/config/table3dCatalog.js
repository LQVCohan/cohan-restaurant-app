export const TABLE_3D_TYPES = {
  ROUND: "round-table",
  RECT_2: "rect-2-seat",
  RECT_4: "rect-4-seat",
  VIP: "vip-table",
  BOOTH: "booth-sofa",
};

export const TABLE_3D_PUBLIC_CATALOG_URL =
  "https://raw.githubusercontent.com/Cohan-restaurant/public-assets/main/table-3d-catalog.v1.json";

const SAMPLE_GLB_BASE =
  "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0";
const PLACEHOLDER_THUMB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
      <rect width="320" height="220" fill="#f5f7fb"/>
      <rect x="36" y="150" width="248" height="12" rx="6" fill="#8b5e3c"/>
      <rect x="64" y="92" width="192" height="64" rx="12" fill="#b98962"/>
      <rect x="92" y="156" width="12" height="34" rx="6" fill="#6f4b2f"/>
      <rect x="216" y="156" width="12" height="34" rx="6" fill="#6f4b2f"/>
      <text x="160" y="44" text-anchor="middle" font-size="20" fill="#1f2937" font-family="Arial, sans-serif">Table Preview</text>
    </svg>`
  );

export const LOCAL_TABLE_3D_CATALOG = [
  {
    key: "round-oak-4",
    label: "Bàn tròn gỗ 4 chỗ",
    tableType: TABLE_3D_TYPES.ROUND,
    capacity: 4,
    defaultScale: 1,
    modelUrl: `${SAMPLE_GLB_BASE}/DiningTable/glTF-Binary/DiningTable.glb`,
    thumbnailUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DiningTable/screenshot/screenshot.jpg",
    source: "public-fallback",
  },
  {
    key: "rect-2-walnut",
    label: "Bàn chữ nhật 2 chỗ",
    tableType: TABLE_3D_TYPES.RECT_2,
    capacity: 2,
    defaultScale: 0.9,
    modelUrl: "",
    thumbnailUrl: PLACEHOLDER_THUMB,
    source: "public-fallback",
    fallbackKind: "placeholder",
  },
  {
    key: "rect-4-modern",
    label: "Bàn chữ nhật 4 chỗ",
    tableType: TABLE_3D_TYPES.RECT_4,
    capacity: 4,
    defaultScale: 1,
    modelUrl: `${SAMPLE_GLB_BASE}/DiningTable/glTF-Binary/DiningTable.glb`,
    thumbnailUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DiningTable/screenshot/screenshot.jpg",
    source: "public-fallback",
  },
  {
    key: "vip-sofa-6",
    label: "Bàn VIP 6 chỗ",
    tableType: TABLE_3D_TYPES.VIP,
    capacity: 6,
    defaultScale: 1.15,
    modelUrl: "",
    thumbnailUrl: PLACEHOLDER_THUMB,
    source: "public-fallback",
    fallbackKind: "placeholder",
  },
  {
    key: "booth-sofa-4",
    label: "Booth/Sofa 4 chỗ",
    tableType: TABLE_3D_TYPES.BOOTH,
    capacity: 4,
    defaultScale: 1.05,
    modelUrl: "",
    thumbnailUrl: PLACEHOLDER_THUMB,
    source: "public-fallback",
    fallbackKind: "placeholder",
  },
];

export const TABLE_3D_TYPE_OPTIONS = [
  { value: TABLE_3D_TYPES.ROUND, label: "Round table" },
  { value: TABLE_3D_TYPES.RECT_2, label: "Rectangular 2-seat" },
  { value: TABLE_3D_TYPES.RECT_4, label: "Rectangular 4-seat" },
  { value: TABLE_3D_TYPES.VIP, label: "VIP table" },
  { value: TABLE_3D_TYPES.BOOTH, label: "Booth/Sofa table" },
];

export const mapModelToTableForm = (model) => {
  const area = model?.tableType === TABLE_3D_TYPES.VIP ? "vip" : "standard";
  return {
    area,
    seats: Number(model?.capacity || 4),
    visualTemplate: model?.key || "",
  };
};

export const normalizeCatalogItem = (item) => {
  const normalizedType = Object.values(TABLE_3D_TYPES).includes(item?.tableType)
    ? item.tableType
    : TABLE_3D_TYPES.RECT_4;
  const modelUrl = item?.modelUrl || "";

  return {
    key: item?.key || "",
    label: item?.label || "Mẫu bàn 3D",
    tableType: normalizedType,
    capacity: Number(item?.capacity || 4),
    defaultScale: Number(item?.defaultScale || 1),
    modelUrl,
    thumbnailUrl: item?.thumbnailUrl || PLACEHOLDER_THUMB,
    source: item?.source || "public",
    fallbackKind: item?.fallbackKind || (modelUrl ? "model" : "placeholder"),
  };
};
