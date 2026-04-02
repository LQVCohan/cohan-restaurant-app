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

export const LOCAL_TABLE_3D_CATALOG = [
  {
    key: "round-oak-4",
    label: "Bàn tròn gỗ 4 chỗ",
    tableType: TABLE_3D_TYPES.ROUND,
    capacity: 4,
    defaultScale: 1,
    modelUrl: `${SAMPLE_GLB_BASE}/BoomBox/glTF-Binary/BoomBox.glb`,
    thumbnailUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/screenshot/screenshot.jpg",
    source: "public-fallback",
  },
  {
    key: "rect-2-walnut",
    label: "Bàn chữ nhật 2 chỗ",
    tableType: TABLE_3D_TYPES.RECT_2,
    capacity: 2,
    defaultScale: 0.9,
    modelUrl: `${SAMPLE_GLB_BASE}/DamagedHelmet/glTF-Binary/DamagedHelmet.glb`,
    thumbnailUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/screenshot/screenshot.jpg",
    source: "public-fallback",
  },
  {
    key: "rect-4-modern",
    label: "Bàn chữ nhật 4 chỗ",
    tableType: TABLE_3D_TYPES.RECT_4,
    capacity: 4,
    defaultScale: 1,
    modelUrl: `${SAMPLE_GLB_BASE}/Lantern/glTF-Binary/Lantern.glb`,
    thumbnailUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/screenshot/screenshot.jpg",
    source: "public-fallback",
  },
  {
    key: "vip-sofa-6",
    label: "Bàn VIP 6 chỗ",
    tableType: TABLE_3D_TYPES.VIP,
    capacity: 6,
    defaultScale: 1.15,
    modelUrl: `${SAMPLE_GLB_BASE}/FlightHelmet/glTF-Binary/FlightHelmet.glb`,
    thumbnailUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/FlightHelmet/screenshot/screenshot.jpg",
    source: "public-fallback",
  },
  {
    key: "booth-sofa-4",
    label: "Booth/Sofa 4 chỗ",
    tableType: TABLE_3D_TYPES.BOOTH,
    capacity: 4,
    defaultScale: 1.05,
    modelUrl: `${SAMPLE_GLB_BASE}/CesiumMan/glTF-Binary/CesiumMan.glb`,
    thumbnailUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/screenshot/screenshot.jpg",
    source: "public-fallback",
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

export const normalizeCatalogItem = (item) => ({
  key: item?.key || "",
  label: item?.label || "Mẫu bàn 3D",
  tableType: item?.tableType || TABLE_3D_TYPES.RECT_4,
  capacity: Number(item?.capacity || 4),
  defaultScale: Number(item?.defaultScale || 1),
  modelUrl: item?.modelUrl || "",
  thumbnailUrl: item?.thumbnailUrl || "",
  source: item?.source || "public",
});
