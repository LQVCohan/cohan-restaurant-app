import { TABLE_AREA_OPTIONS } from "@/utils/tableManagementOptions";

export const CUSTOM_TABLE_SHAPES = [
  { value: "round", label: "Bàn tròn" },
  { value: "rect", label: "Bàn chữ nhật" },
  { value: "square", label: "Bàn vuông" },
  { value: "booth", label: "Booth/Sofa" },
  { value: "bar", label: "Bàn bar" },
];

export const DEFAULT_CUSTOM_TABLE_SPEC = {
  name: "",
  shape: "rect",
  area: "standard",
  capacity: 4,
  widthCm: 120,
  depthCm: 80,
  heightCm: 75,
  diameterCm: 90,
  material: "wood",
  color: "#b98962",
  notes: "",
  referenceImageName: "",
};

const AREA_VALUES = new Set(TABLE_AREA_OPTIONS.map((item) => item.value));
const SHAPE_VALUES = new Set(CUSTOM_TABLE_SHAPES.map((item) => item.value));

const asPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.round(parsed));
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const normalizeCustomTableSpec = (input = {}) => {
  const merged = { ...DEFAULT_CUSTOM_TABLE_SPEC, ...input };
  return {
    ...merged,
    name: String(merged.name || "").trim(),
    shape: SHAPE_VALUES.has(merged.shape) ? merged.shape : DEFAULT_CUSTOM_TABLE_SPEC.shape,
    area: AREA_VALUES.has(merged.area) ? merged.area : DEFAULT_CUSTOM_TABLE_SPEC.area,
    capacity: asPositiveNumber(merged.capacity, DEFAULT_CUSTOM_TABLE_SPEC.capacity),
    widthCm: asPositiveNumber(merged.widthCm, DEFAULT_CUSTOM_TABLE_SPEC.widthCm),
    depthCm: asPositiveNumber(merged.depthCm, DEFAULT_CUSTOM_TABLE_SPEC.depthCm),
    heightCm: asPositiveNumber(merged.heightCm, DEFAULT_CUSTOM_TABLE_SPEC.heightCm),
    diameterCm: asPositiveNumber(merged.diameterCm, DEFAULT_CUSTOM_TABLE_SPEC.diameterCm),
    material: String(merged.material || "").trim() || DEFAULT_CUSTOM_TABLE_SPEC.material,
    color: String(merged.color || "").trim() || DEFAULT_CUSTOM_TABLE_SPEC.color,
    notes: String(merged.notes || "").trim(),
    referenceImageName: String(merged.referenceImageName || "").trim(),
  };
};

export const buildCustomTableCatalogItem = (spec) => {
  const normalizedSpec = normalizeCustomTableSpec(spec);
  const slug = slugify(normalizedSpec.name);
  const suffix = slug || Date.now();

  return {
    key: `custom-${suffix}`,
    label: normalizedSpec.name || "Mẫu bàn tùy chỉnh",
    tableType: "custom-parametric",
    capacity: normalizedSpec.capacity,
    defaultScale: 1,
    modelUrl: "",
    thumbnailUrl: "",
    source: "user-generated",
    fallbackKind: "parametric",
    customModelSpec: normalizedSpec,
  };
};

export const mapCustomTableSpecToTableForm = (spec) => {
  const normalizedSpec = normalizeCustomTableSpec(spec);
  return {
    area: normalizedSpec.area,
    seats: normalizedSpec.capacity,
    visualTemplate: normalizedSpec.name || "custom-parametric",
  };
};
