import { TABLE_AREA_OPTIONS } from "@/utils/tableManagementOptions";

const CUSTOM_URL_TABLE_TYPES = {
  ROUND: "round-table",
  RECT_2: "rect-2-seat",
  RECT_4: "rect-4-seat",
  VIP: "vip-table",
  BOOTH: "booth-sofa",
  BAR: "bar-table",
  OUTDOOR: "outdoor-table",
};

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

export const DEFAULT_CUSTOM_URL_TABLE_SPEC = {
  name: "",
  tableType: CUSTOM_URL_TABLE_TYPES.RECT_4,
  capacity: 4,
  modelUrl: "",
  thumbnailUrl: "",
  source: "",
  licenseLabel: "",
  defaultScale: 1,
  widthCm: "",
  depthCm: "",
  heightCm: "",
  diameterCm: "",
  tags: "",
};

export const DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC = {
  ...DEFAULT_CUSTOM_URL_TABLE_SPEC,
  modelFile: null,
  thumbnailFile: null,
  uploadedFileName: "",
  uploadedSizeBytes: 0,
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const normalizeDimensionsCm = (input = {}) => {
  const dimensions = ["width", "depth", "height", "diameter"].reduce(
    (acc, key) => {
      const value = input[`${key}Cm`] ?? input[key];
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) acc[key] = parsed;
      return acc;
    },
    {},
  );

  return Object.keys(dimensions).length ? dimensions : null;
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

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

export const buildCustomTableCatalogItem = (spec, options = {}) => {
  const normalizedSpec = normalizeCustomTableSpec(spec);
  const slug = slugify(normalizedSpec.name) || "table";
  const timestamp = options.timestamp ?? Date.now();

  return {
    key: `custom-${slug}-${timestamp}`,
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

export const buildCustomUrlTableCatalogItem = (spec = {}, options = {}) => {
  const merged = { ...DEFAULT_CUSTOM_URL_TABLE_SPEC, ...spec };
  const slug = slugify(merged.name) || "url-table";
  const timestamp = options.timestamp ?? Date.now();
  const sourceInput = String(merged.source || "").trim();
  const sourceIsUrl = /^https?:\/\//i.test(sourceInput);

  return {
    key: `custom-url-${slug}-${timestamp}`,
    label: String(merged.name || "").trim() || "Mẫu bàn 3D URL tùy chỉnh",
    tableType: Object.values(CUSTOM_URL_TABLE_TYPES).includes(merged.tableType)
      ? merged.tableType
      : DEFAULT_CUSTOM_URL_TABLE_SPEC.tableType,
    capacity: asPositiveNumber(merged.capacity, DEFAULT_CUSTOM_URL_TABLE_SPEC.capacity),
    defaultScale: Number(merged.defaultScale || DEFAULT_CUSTOM_URL_TABLE_SPEC.defaultScale),
    modelUrl: String(merged.modelUrl || "").trim(),
    thumbnailUrl: String(merged.thumbnailUrl || "").trim(),
    source: sourceIsUrl ? sourceInput : "user-generated-url",
    sourceLabel: sourceIsUrl
      ? sourceInput
      : sourceInput || "Custom online model URL",
    licenseLabel: String(merged.licenseLabel || "").trim() || "Người dùng tự xác nhận quyền sử dụng",
    dimensionsCm: normalizeDimensionsCm(merged),
    tags: normalizeTags(merged.tags),
    fallbackKind: "model",
    customModelKind: "url",
  };
};

export const buildUploadedTableCatalogItem = (spec = {}, options = {}) => {
  const merged = { ...DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC, ...spec };
  const slug = slugify(merged.name) || "uploaded-table";
  const timestamp = options.timestamp ?? Date.now();
  const sourceInput = String(merged.source || "").trim();

  return {
    key: `custom-upload-${slug}-${timestamp}`,
    label: String(merged.name || "").trim() || "Mẫu bàn 3D upload tùy chỉnh",
    tableType: Object.values(CUSTOM_URL_TABLE_TYPES).includes(merged.tableType)
      ? merged.tableType
      : DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC.tableType,
    capacity: asPositiveNumber(merged.capacity, DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC.capacity),
    defaultScale: Number(merged.defaultScale || DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC.defaultScale),
    modelUrl: String(merged.modelUrl || "").trim(),
    thumbnailUrl: String(merged.thumbnailUrl || "").trim(),
    source: "user-upload",
    sourceLabel: sourceInput || "User uploaded GLB model",
    licenseLabel: String(merged.licenseLabel || "").trim() || "Người dùng tự xác nhận quyền sử dụng",
    dimensionsCm: normalizeDimensionsCm(merged),
    tags: normalizeTags(merged.tags),
    fallbackKind: "model",
    customModelKind: "upload",
    uploadedFileName: String(merged.uploadedFileName || merged.fileName || "").trim(),
    uploadedSizeBytes: Number(merged.uploadedSizeBytes || merged.sizeBytes || 0) || 0,
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


export const getCustomTableShapeLabel = (shape) =>
  CUSTOM_TABLE_SHAPES.find((item) => item.value === shape)?.label || "Bàn chữ nhật";
