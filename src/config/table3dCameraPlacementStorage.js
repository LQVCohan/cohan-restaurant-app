export const CAMERA_PLACEMENT_STORAGE_KEY = "cohan.table3d.cameraPlacement.v1";

export const DEFAULT_CAMERA_PLACEMENT = {
  x: 50,
  y: 55,
  scale: 1,
  rotation: 0,
  opacity: 0.78,
};

export const buildCameraPlacementKey = (modelKey, scope = "default") =>
  `${scope || "default"}::${modelKey || "preview"}`;

const getCameraPlacementStorageKey = () => CAMERA_PLACEMENT_STORAGE_KEY;

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeCameraPlacement = (value) => {
  const source = value && typeof value === "object" ? value : {};

  return {
    x: clamp(asNumber(source.x, DEFAULT_CAMERA_PLACEMENT.x), 5, 95),
    y: clamp(asNumber(source.y, DEFAULT_CAMERA_PLACEMENT.y), 5, 95),
    scale: clamp(asNumber(source.scale, DEFAULT_CAMERA_PLACEMENT.scale), 0.5, 2),
    rotation: asNumber(source.rotation, DEFAULT_CAMERA_PLACEMENT.rotation),
    opacity: clamp(asNumber(source.opacity, DEFAULT_CAMERA_PLACEMENT.opacity), 0.35, 1),
  };
};

const loadAllCameraPlacements = () => {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(getCameraPlacementStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce((acc, [placementKey, placementValue]) => {
      if (!placementKey) return acc;
      acc[placementKey] = normalizeCameraPlacement(placementValue);
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const persistAllCameraPlacements = (nextMap) => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(getCameraPlacementStorageKey(), JSON.stringify(nextMap));
  } catch {
    // ignore storage write errors
  }
};

export const loadCameraPlacement = (modelKey, scope = "default") => {
  if (!modelKey) return { ...DEFAULT_CAMERA_PLACEMENT };
  const all = loadAllCameraPlacements();
  const placementKey = buildCameraPlacementKey(modelKey, scope);
  return all[placementKey] || { ...DEFAULT_CAMERA_PLACEMENT };
};

export const saveCameraPlacement = (modelKey, placement, scope = "default") => {
  if (!modelKey) return loadAllCameraPlacements();

  const all = loadAllCameraPlacements();
  const placementKey = buildCameraPlacementKey(modelKey, scope);
  const next = {
    ...all,
    [placementKey]: normalizeCameraPlacement(placement),
  };
  persistAllCameraPlacements(next);
  return next;
};

export const deleteCameraPlacement = (modelKey, scope = "default") => {
  if (!modelKey) return loadAllCameraPlacements();

  const all = loadAllCameraPlacements();
  const placementKey = buildCameraPlacementKey(modelKey, scope);
  const next = { ...all };
  delete next[placementKey];
  persistAllCameraPlacements(next);
  return next;
};

export const hasCameraPlacement = (modelKey, scope = "default") => {
  if (!modelKey) return false;
  const all = loadAllCameraPlacements();
  return !!all[buildCameraPlacementKey(modelKey, scope)];
};

export { getCameraPlacementStorageKey };
