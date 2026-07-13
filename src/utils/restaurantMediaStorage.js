const STORAGE_PREFIX = "cohan:restaurant-media:v1:";
const MEDIA_UPDATED_EVENT = "cohan:restaurant-media-updated";

export const MAX_RESTAURANT_GALLERY_IMAGES = 8;
export const MAX_RESTAURANT_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_RESTAURANT_SOURCE_FILE_BYTES = 30 * 1024 * 1024;
export const PANORAMA_TARGET_BYTES = 1600 * 1024;
export const GALLERY_TARGET_BYTES = 320 * 1024;

const emptyMedia = () => ({
  version: 1,
  panorama: null,
  gallery: [],
  updatedAt: null,
});

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage || null;
};

export const getRestaurantMediaStorageKey = (restaurantId) =>
  `${STORAGE_PREFIX}${String(restaurantId || "").trim()}`;

export const estimateDataUrlBytes = (dataUrl = "") => {
  const payload = String(dataUrl).split(",")[1] || "";
  return Math.ceil((payload.length * 3) / 4);
};

export const getCompressionSavingsPercent = (asset) => {
  const originalBytes = Number(asset?.originalBytes || 0);
  const processedBytes = Number(
    asset?.processedBytes || estimateDataUrlBytes(asset?.dataUrl || ""),
  );
  if (!originalBytes || processedBytes >= originalBytes) return 0;
  return Math.max(0, Math.round((1 - processedBytes / originalBytes) * 100));
};

const normalizeAsset = (asset) => {
  if (!asset || typeof asset !== "object" || !asset.dataUrl) return null;
  return {
    id: String(asset.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    dataUrl: String(asset.dataUrl),
    name: String(asset.name || "Ảnh nhà hàng"),
    mimeType: String(asset.mimeType || "image/jpeg"),
    originalBytes: Number(asset.originalBytes || 0),
    processedBytes: Number(
      asset.processedBytes || estimateDataUrlBytes(asset.dataUrl),
    ),
    quality: Number.isFinite(Number(asset.quality))
      ? Number(asset.quality)
      : null,
    width: Number(asset.width || 0),
    height: Number(asset.height || 0),
    createdAt: asset.createdAt || new Date().toISOString(),
  };
};

export const normalizeRestaurantMedia = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const gallery = (Array.isArray(source.gallery) ? source.gallery : [])
    .map(normalizeAsset)
    .filter(Boolean)
    .slice(0, MAX_RESTAURANT_GALLERY_IMAGES);

  return {
    version: 1,
    panorama: normalizeAsset(source.panorama),
    gallery,
    updatedAt: source.updatedAt || null,
  };
};

export const readRestaurantMedia = (restaurantId) => {
  const storage = getStorage();
  const normalizedId = String(restaurantId || "").trim();
  if (!storage || !normalizedId) return emptyMedia();

  try {
    const raw = storage.getItem(getRestaurantMediaStorageKey(normalizedId));
    return raw ? normalizeRestaurantMedia(JSON.parse(raw)) : emptyMedia();
  } catch (error) {
    console.warn("Không thể đọc ảnh nhà hàng trong Local Storage.", error);
    return emptyMedia();
  }
};

export const getRestaurantMediaUsageBytes = (media) => {
  const normalized = normalizeRestaurantMedia(media);
  return [normalized.panorama, ...normalized.gallery]
    .filter(Boolean)
    .reduce((total, asset) => total + estimateDataUrlBytes(asset.dataUrl), 0);
};

export const saveRestaurantMedia = (restaurantId, media) => {
  const storage = getStorage();
  const normalizedId = String(restaurantId || "").trim();
  if (!storage || !normalizedId) {
    throw new Error("Chưa chọn nhà hàng để lưu hình ảnh.");
  }

  const normalized = {
    ...normalizeRestaurantMedia(media),
    updatedAt: new Date().toISOString(),
  };

  if (getRestaurantMediaUsageBytes(normalized) > MAX_RESTAURANT_MEDIA_BYTES) {
    throw new Error("Bộ ảnh vượt quá 8 MB. Hãy xóa bớt ảnh hoặc dùng ảnh nhẹ hơn.");
  }

  try {
    storage.setItem(getRestaurantMediaStorageKey(normalizedId), JSON.stringify(normalized));
  } catch (error) {
    const quotaExceeded =
      error?.name === "QuotaExceededError" ||
      error?.code === 22 ||
      error?.code === 1014;
    throw new Error(
      quotaExceeded
        ? "Local Storage đã đầy. Hãy xóa bớt ảnh hoặc chọn ảnh dung lượng nhỏ hơn."
        : "Không thể lưu ảnh vào trình duyệt hiện tại.",
    );
  }

  window.dispatchEvent(
    new CustomEvent(MEDIA_UPDATED_EVENT, {
      detail: { restaurantId: normalizedId, media: normalized },
    }),
  );
  return normalized;
};

export const clearRestaurantMedia = (restaurantId) => {
  const storage = getStorage();
  const normalizedId = String(restaurantId || "").trim();
  if (!storage || !normalizedId) return;
  storage.removeItem(getRestaurantMediaStorageKey(normalizedId));
  window.dispatchEvent(
    new CustomEvent(MEDIA_UPDATED_EVENT, {
      detail: { restaurantId: normalizedId, media: emptyMedia() },
    }),
  );
};

export const subscribeRestaurantMedia = (restaurantId, callback) => {
  if (typeof window === "undefined") return () => {};
  const normalizedId = String(restaurantId || "").trim();

  const handleCustomEvent = (event) => {
    if (String(event?.detail?.restaurantId || "") !== normalizedId) return;
    callback?.(normalizeRestaurantMedia(event.detail.media));
  };
  const handleStorage = (event) => {
    if (event.key !== getRestaurantMediaStorageKey(normalizedId)) return;
    callback?.(readRestaurantMedia(normalizedId));
  };

  window.addEventListener(MEDIA_UPDATED_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(MEDIA_UPDATED_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
};

const readImageDimensions = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ image, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Không thể đọc nội dung ảnh."));
    image.src = dataUrl;
  });

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc file ảnh."));
    reader.readAsDataURL(file);
  });

const createResizedCanvas = (
  { image, width, height },
  { maxWidth, maxHeight },
) => {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#fff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, 0, 0, outputWidth, outputHeight);
  return { canvas, width: outputWidth, height: outputHeight };
};

const compressImageToTarget = async (
  source,
  {
    maxWidth,
    maxHeight,
    minWidth,
    minHeight,
    targetBytes,
    qualitySteps,
  },
) => {
  const dimensionScales = [1, 0.88, 0.76, 0.66, 0.56];
  let best = null;
  let lastDimensions = "";

  for (const dimensionScale of dimensionScales) {
    const currentMaxWidth = Math.max(
      minWidth,
      Math.round(maxWidth * dimensionScale),
    );
    const currentMaxHeight = Math.max(
      minHeight,
      Math.round(maxHeight * dimensionScale),
    );
    const dimensionKey = `${currentMaxWidth}x${currentMaxHeight}`;
    if (dimensionKey === lastDimensions) continue;
    lastDimensions = dimensionKey;

    const resized = createResizedCanvas(source, {
      maxWidth: currentMaxWidth,
      maxHeight: currentMaxHeight,
    });

    for (const quality of qualitySteps) {
      const dataUrl = resized.canvas.toDataURL("image/jpeg", quality);
      const processedBytes = estimateDataUrlBytes(dataUrl);
      const candidate = {
        dataUrl,
        width: resized.width,
        height: resized.height,
        quality,
        processedBytes,
      };

      if (!best || candidate.processedBytes < best.processedBytes) {
        best = candidate;
      }
      if (processedBytes <= targetBytes) {
        resized.canvas.width = 0;
        resized.canvas.height = 0;
        return candidate;
      }
    }

    resized.canvas.width = 0;
    resized.canvas.height = 0;
  }

  return best;
};

export const prepareRestaurantMediaFile = async (
  file,
  { panorama = false } = {},
) => {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Vui lòng chọn file ảnh hợp lệ.");
  }
  if (file.size > MAX_RESTAURANT_SOURCE_FILE_BYTES) {
    throw new Error("Ảnh gốc quá lớn. Vui lòng chọn ảnh dưới 30 MB.");
  }

  const sourceDataUrl = await fileToDataUrl(file);
  const source = await readImageDimensions(sourceDataUrl);
  const ratio = source.width / Math.max(1, source.height);
  if (panorama && (ratio < 1.75 || ratio > 2.25)) {
    throw new Error("Ảnh 360° nên có tỷ lệ gần 2:1, ví dụ 4096 × 2048.");
  }

  const compressed = await compressImageToTarget(
    source,
    panorama
      ? {
          maxWidth: 4096,
          maxHeight: 2048,
          minWidth: 2048,
          minHeight: 1024,
          targetBytes: PANORAMA_TARGET_BYTES,
          qualitySteps: [0.84, 0.78, 0.72, 0.66, 0.6, 0.54],
        }
      : {
          maxWidth: 1600,
          maxHeight: 1200,
          minWidth: 900,
          minHeight: 675,
          targetBytes: GALLERY_TARGET_BYTES,
          qualitySteps: [0.84, 0.78, 0.72, 0.66, 0.6],
        },
  );

  if (!compressed?.dataUrl) {
    throw new Error("Không thể nén ảnh trên trình duyệt hiện tại.");
  }

  return normalizeAsset({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    dataUrl: compressed.dataUrl,
    name: file.name || (panorama ? "Ảnh 360 nhà hàng" : "Ảnh không gian nhà hàng"),
    mimeType: "image/jpeg",
    originalBytes: file.size,
    processedBytes: compressed.processedBytes,
    quality: compressed.quality,
    width: compressed.width,
    height: compressed.height,
    createdAt: new Date().toISOString(),
  });
};