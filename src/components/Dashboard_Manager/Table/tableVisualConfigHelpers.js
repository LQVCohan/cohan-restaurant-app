import { mapTable3DTypeToArea } from "@/config/table3dCatalog";
import { DEFAULT_CAMERA_PLACEMENT, normalizeCameraPlacement } from "@/config/table3dCameraPlacementStorage";

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 48;

const isPlainObject = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);

const trimString = (value, maxLength = 240) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const normalizeSafeHttpUrl = (value) => {
  const normalized = trimString(value, 2048);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const normalizePositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const normalizeDimensions = (input) => {
  const source = isPlainObject(input) ? input : null;
  if (!source) return null;

  const dimensions = {
    widthCm: normalizePositiveNumber(source.widthCm),
    depthCm: normalizePositiveNumber(source.depthCm),
    heightCm: normalizePositiveNumber(source.heightCm),
    diameterCm: normalizePositiveNumber(source.diameterCm ?? source.diameter),
  };

  return Object.values(dimensions).some((value) => value != null)
    ? dimensions
    : null;
};

const getModelDimensions = (model) =>
  normalizeDimensions(model?.dimensionsCm) ||
  normalizeDimensions(model?.dimensions) ||
  normalizeDimensions(model?.customModelSpec);

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();

  return tags
    .map((tag) => trimString(tag, MAX_TAG_LENGTH))
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_TAGS);
};

const inferSourceType = (model, placement) => {
  if (placement) return "camera-preview";
  if (model?.customModelKind === "url" || model?.source === "user-generated-url") {
    return "custom-url";
  }
  if (model?.customModelKind === "parametric" || model?.customModelSpec) {
    return "custom-parametric";
  }
  return "catalog";
};

export const normalizeVisualConfigForClient = (visualConfig) => {
  if (!isPlainObject(visualConfig)) return null;

  const dimensions =
    normalizeDimensions(visualConfig.dimensions) ||
    normalizeDimensions(visualConfig.dimensionsCm);
  const placement = isPlainObject(visualConfig.placement)
    ? normalizeCameraPlacement(visualConfig.placement)
    : null;

  return {
    modelKey: trimString(visualConfig.modelKey, 160),
    modelLabel: trimString(visualConfig.modelLabel || visualConfig.label, 240),
    tableType: trimString(visualConfig.tableType, 80),
    capacity: normalizePositiveNumber(visualConfig.capacity),
    defaultScale: normalizePositiveNumber(visualConfig.defaultScale),
    modelUrl: normalizeSafeHttpUrl(visualConfig.modelUrl),
    thumbnailUrl: normalizeSafeHttpUrl(visualConfig.thumbnailUrl),
    source: trimString(visualConfig.source, 240),
    sourceLabel: trimString(visualConfig.sourceLabel, 240),
    licenseLabel: trimString(visualConfig.licenseLabel, 240),
    dimensions,
    tags: normalizeTags(visualConfig.tags),
    fallbackKind: trimString(visualConfig.fallbackKind, 80),
    customModelKind: trimString(visualConfig.customModelKind, 80),
    placement,
    savedAt: trimString(visualConfig.savedAt, 80),
    sourceType: trimString(visualConfig.sourceType, 80),
  };
};

export const buildVisualConfigFromModel = (model, confirmedCameraPlacement = null) => {
  if (!isPlainObject(model)) return null;

  const matchingPlacement =
    confirmedCameraPlacement?.modelKey && confirmedCameraPlacement.modelKey === model.key
      ? normalizeCameraPlacement(confirmedCameraPlacement.placement || DEFAULT_CAMERA_PLACEMENT)
      : null;
  const dimensions = getModelDimensions(model);
  const fallbackKind = trimString(model.fallbackKind, 80) || (model.modelUrl ? "model" : "placeholder");

  return normalizeVisualConfigForClient({
    modelKey: model.key,
    modelLabel: model.label,
    tableType: model.tableType,
    capacity: model.capacity || model.customModelSpec?.capacity,
    defaultScale: model.defaultScale,
    modelUrl: model.modelUrl,
    thumbnailUrl: model.thumbnailUrl,
    source: model.source,
    sourceLabel: model.sourceLabel,
    licenseLabel: model.licenseLabel,
    dimensions,
    tags: model.tags,
    fallbackKind,
    customModelKind: model.customModelKind,
    placement: matchingPlacement,
    savedAt: new Date().toISOString(),
    sourceType: inferSourceType(model, matchingPlacement),
  });
};

export const getVisualConfigModelLabel = (visualConfig) => {
  const config = normalizeVisualConfigForClient(visualConfig);
  return config?.modelLabel || config?.modelKey || "Mẫu bàn đã lưu";
};

export const getVisualConfigSummary = (visualConfig) => {
  const config = normalizeVisualConfigForClient(visualConfig);
  if (!config) return null;

  const dimensions = (() => {
    if (!config.dimensions) return "";
    if (config.dimensions.diameterCm != null) {
      const height = config.dimensions.heightCm != null
        ? ` x cao ${config.dimensions.heightCm} cm`
        : "";
      return `Ø ${config.dimensions.diameterCm} cm${height}`;
    }

    const sizeParts = [
      config.dimensions.widthCm,
      config.dimensions.depthCm,
      config.dimensions.heightCm,
    ].filter((value) => value != null);

    return sizeParts.length ? `${sizeParts.join(" x ")} cm` : "";
  })();

  return {
    label: getVisualConfigModelLabel(config),
    modelKey: config.modelKey,
    tableType: config.tableType,
    capacity: config.capacity,
    source: config.sourceLabel || config.source,
    license: config.licenseLabel,
    dimensions,
    modelUrl: config.modelUrl,
    thumbnailUrl: config.thumbnailUrl,
    tags: config.tags,
    fallbackKind: config.fallbackKind,
    customModelKind: config.customModelKind,
    placement: config.placement,
    savedAt: config.savedAt,
    sourceType: config.sourceType,
  };
};

export const buildPreviewModelItemFromVisualConfig = (visualConfig) => {
  const config = normalizeVisualConfigForClient(visualConfig) || {};
  const modelKey = config.modelKey || "saved-model";
  const modelLabel = config.modelLabel || "Mẫu bàn đã lưu";
  const capacity = Number.isFinite(Number(config.capacity)) ? Number(config.capacity) : 4;
  const dimensions = config.dimensions;

  return {
    key: modelKey,
    label: modelLabel,
    tableType: config.tableType || null,
    capacity,
    defaultScale: config.defaultScale || 1,
    modelUrl: config.modelUrl || "",
    thumbnailUrl: config.thumbnailUrl || "",
    source: config.source || "",
    sourceLabel: config.sourceLabel || "",
    licenseLabel: config.licenseLabel || "",
    dimensionsCm: dimensions,
    dimensions,
    tags: config.tags || [],
    fallbackKind: config.fallbackKind || "placeholder",
    customModelKind: config.customModelKind || null,
    customModelSpec: dimensions
      ? {
          name: modelLabel,
          capacity,
          widthCm: Number(dimensions.widthCm) || 0,
          depthCm: Number(dimensions.depthCm) || 0,
          heightCm: Number(dimensions.heightCm) || 0,
          diameterCm: Number(dimensions.diameterCm) || 0,
          area: visualConfig?.tableArea || mapTable3DTypeToArea(config.tableType),
          shape: visualConfig?.shape || "rect",
        }
      : null,
  };
};

export const formatVisualConfigSavedAt = (savedAt) => {
  if (!savedAt) return "Không rõ thời gian lưu";
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian lưu";
  return date.toLocaleString("vi-VN");
};
