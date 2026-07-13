import { estimateTableVrDataUrlBytes } from "@/utils/tableVrImageProcessing";

const VR_TABLE_IMAGE_PREFIX = "vr-image-table:";
const VR_TABLE_IMAGE_META_PREFIX = "vr-image-table-meta:";

export const getTableVrImageKey = (tableId) =>
  `${VR_TABLE_IMAGE_PREFIX}${tableId}`;

export const getTableVrImageMetadataKey = (tableId) =>
  `${VR_TABLE_IMAGE_META_PREFIX}${tableId}`;

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage || null;
};

const normalizeMetadata = (metadata, dataUrl = "") => {
  if (!metadata || typeof metadata !== "object") {
    const estimatedBytes = estimateTableVrDataUrlBytes(dataUrl);
    return estimatedBytes ? { processedBytes: estimatedBytes } : null;
  }

  return {
    name: String(metadata.name || "Ảnh 360° của bàn"),
    mimeType: String(metadata.mimeType || "image/jpeg"),
    originalBytes: Number(metadata.originalBytes || 0),
    processedBytes: Number(
      metadata.processedBytes || estimateTableVrDataUrlBytes(dataUrl),
    ),
    width: Number(metadata.width || 0),
    height: Number(metadata.height || 0),
    quality: Number.isFinite(Number(metadata.quality))
      ? Number(metadata.quality)
      : null,
    savingsPercent: Number(metadata.savingsPercent || 0),
    createdAt: metadata.createdAt || new Date().toISOString(),
  };
};

export const loadTableVrImage = (tableId) => {
  const storage = getStorage();
  if (!storage || !tableId) return null;
  return storage.getItem(getTableVrImageKey(tableId));
};

export const loadTableVrImageMetadata = (tableId) => {
  const storage = getStorage();
  if (!storage || !tableId) return null;
  const dataUrl = loadTableVrImage(tableId) || "";
  try {
    const raw = storage.getItem(getTableVrImageMetadataKey(tableId));
    return raw ? normalizeMetadata(JSON.parse(raw), dataUrl) : normalizeMetadata(null, dataUrl);
  } catch (error) {
    console.warn("Không thể đọc metadata ảnh 360 của bàn.", error);
    return normalizeMetadata(null, dataUrl);
  }
};

export const storeTableVrImage = (tableId, dataUrl, metadata = null) => {
  const storage = getStorage();
  if (!storage || !tableId || !dataUrl) return false;

  const imageKey = getTableVrImageKey(tableId);
  const metadataKey = getTableVrImageMetadataKey(tableId);
  const previousImage = storage.getItem(imageKey);
  const previousMetadata = storage.getItem(metadataKey);

  try {
    storage.setItem(imageKey, dataUrl);
    storage.setItem(
      metadataKey,
      JSON.stringify(normalizeMetadata(metadata, dataUrl)),
    );
    return true;
  } catch (error) {
    try {
      if (previousImage == null) storage.removeItem(imageKey);
      else storage.setItem(imageKey, previousImage);
      if (previousMetadata == null) storage.removeItem(metadataKey);
      else storage.setItem(metadataKey, previousMetadata);
    } catch {
      // Best-effort rollback only.
    }
    console.error("Không thể lưu ảnh 360 vào Local Storage.", error);
    return false;
  }
};

export const removeTableVrImage = (tableId) => {
  const storage = getStorage();
  if (!storage || !tableId) return;
  storage.removeItem(getTableVrImageKey(tableId));
  storage.removeItem(getTableVrImageMetadataKey(tableId));
};
