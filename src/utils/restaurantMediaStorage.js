const STORAGE_PREFIX = "cohan:restaurant-media:v1:";
const MEDIA_UPDATED_EVENT = "cohan:restaurant-media-updated";

export const MAX_RESTAURANT_GALLERY_IMAGES = 8;
export const MAX_RESTAURANT_MEDIA_BYTES = 8 * 1024 * 1024;

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

const normalizeAsset = (asset) => {
  if (!asset || typeof asset !== "object" || !asset.dataUrl) return null;
  return {
    id: String(asset.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    dataUrl: String(asset.dataUrl),
    name: String(asset.name || "Ảnh nhà hàng"),
    mimeType: String(asset.mimeType || "image/jpeg"),
    originalBytes: Number(asset.originalBytes || 0),
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

export const estimateDataUrlBytes = (dataUrl = "") => {
  const payload = String(dataUrl).split(",")[1] || "";
  return Math.ceil((payload.length * 3) / 4);
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
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight });
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

const resizeImage = async (dataUrl, { maxWidth, maxHeight, quality }) => {
  const { image, width, height } = await readImageDimensions(dataUrl);
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  context.drawImage(image, 0, 0, outputWidth, outputHeight);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    width: outputWidth,
    height: outputHeight,
  };
};

export const prepareRestaurantMediaFile = async (file, { panorama = false } = {}) => {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Vui lòng chọn file ảnh hợp lệ.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Ảnh gốc quá lớn. Vui lòng chọn ảnh dưới 12 MB.");
  }

  const sourceDataUrl = await fileToDataUrl(file);
  const source = await readImageDimensions(sourceDataUrl);
  const ratio = source.width / Math.max(1, source.height);
  if (panorama && (ratio < 1.75 || ratio > 2.25)) {
    throw new Error("Ảnh 360° nên có tỷ lệ gần 2:1, ví dụ 4096 × 2048.");
  }

  const resized = await resizeImage(sourceDataUrl, panorama
    ? { maxWidth: 4096, maxHeight: 2048, quality: 0.78 }
    : { maxWidth: 1600, maxHeight: 1200, quality: 0.8 });

  return normalizeAsset({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    dataUrl: resized.dataUrl,
    name: file.name || (panorama ? "Ảnh 360 nhà hàng" : "Ảnh không gian nhà hàng"),
    mimeType: "image/jpeg",
    originalBytes: file.size,
    width: resized.width,
    height: resized.height,
    createdAt: new Date().toISOString(),
  });
};
