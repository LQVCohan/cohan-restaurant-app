export const CAMERA_PLACEMENT_STORAGE_KEY = "cohan.table3d.cameraPlacement.v1";

export const DEFAULT_CAMERA_PLACEMENT = {
  x: 50,
  y: 55,
  scale: 1,
  rotation: 0,
};

export const getCameraPlacementStorageKey = (scope = "default") =>
  `${CAMERA_PLACEMENT_STORAGE_KEY}:${scope || "default"}`;

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeCameraPlacement = (input) => {
  const source = input || {};
  const x = clamp(asNumber(source.x, DEFAULT_CAMERA_PLACEMENT.x), 0, 100);
  const y = clamp(asNumber(source.y, DEFAULT_CAMERA_PLACEMENT.y), 0, 100);
  const scale = clamp(asNumber(source.scale, DEFAULT_CAMERA_PLACEMENT.scale), 0.35, 2.5);
  const rawRotation = asNumber(source.rotation, DEFAULT_CAMERA_PLACEMENT.rotation);
  const rotation = ((rawRotation % 360) + 360) % 360;

  return { x, y, scale, rotation };
};

export const loadCameraPlacements = (scope = "default") => {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(getCameraPlacementStorageKey(scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce((acc, [key, placement]) => {
      if (!key) return acc;
      acc[key] = normalizeCameraPlacement(placement);
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const loadCameraPlacement = (modelKey, scope = "default") => {
  if (!modelKey) return { ...DEFAULT_CAMERA_PLACEMENT };
  const map = loadCameraPlacements(scope);
  return map[modelKey] || { ...DEFAULT_CAMERA_PLACEMENT };
};

export const saveCameraPlacement = (modelKey, placement, scope = "default") => {
  const map = loadCameraPlacements(scope);
  if (!modelKey) return map;

  const next = {
    ...map,
    [modelKey]: normalizeCameraPlacement(placement),
  };

  if (!canUseStorage()) return next;

  try {
    window.localStorage.setItem(getCameraPlacementStorageKey(scope), JSON.stringify(next));
    return next;
  } catch {
    return next;
  }
};

export const deleteCameraPlacement = (modelKey, scope = "default") => {
  const map = loadCameraPlacements(scope);
  if (!modelKey) return map;

  const next = { ...map };
  delete next[modelKey];

  if (!canUseStorage()) return next;

  try {
    window.localStorage.setItem(getCameraPlacementStorageKey(scope), JSON.stringify(next));
    return next;
  } catch {
    return next;
  }
};

export const hasCameraPlacement = (modelKey, scope = "default") => {
  if (!modelKey) return false;
  const map = loadCameraPlacements(scope);
  return !!map[modelKey];
};
