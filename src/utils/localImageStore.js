const DB_NAME = "cohan-restaurant-local-media";
const DB_VERSION = 2;
const IMAGE_STORE = "images";
const LOCAL_IMAGE_PREFIX = "local-image://";

const DEFAULT_MAX_SIZE_BYTES = 8 * 1024 * 1024;
const THUMB_MAX_WIDTH = 320;
const PREVIEW_MAX_WIDTH = 960;
const THUMB_QUALITY = 0.72;
const PREVIEW_QUALITY = 0.78;
const WEBP_MIME = "image/webp";
const JPEG_MIME = "image/jpeg";

let dbPromise = null;
let webpSupportPromise = null;

const isBrowser = () => typeof window !== "undefined" && "indexedDB" in window;

const openLocalMediaDb = () => {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        const store = db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("ownerKey", "ownerKey", { unique: false });
        store.createIndex("purpose", "purpose", { unique: false });
        return;
      }

      const store = request.transaction.objectStore(IMAGE_STORE);
      if (!store.indexNames.contains("createdAt")) {
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!store.indexNames.contains("ownerKey")) {
        store.createIndex("ownerKey", "ownerKey", { unique: false });
      }
      if (!store.indexNames.contains("purpose")) {
        store.createIndex("purpose", "purpose", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Cannot open local media database."));
    request.onblocked = () => reject(new Error("Local media database is blocked by another tab."));
  });

  return dbPromise;
};

const runStore = async (mode, executor) => {
  const db = await openLocalMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, mode);
    const store = tx.objectStore(IMAGE_STORE);
    let result;

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));

    try {
      result = executor(store);
    } catch (error) {
      reject(error);
    }
  });
};

const readStore = async (executor) => {
  const db = await openLocalMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readonly");
    const store = tx.objectStore(IMAGE_STORE);

    tx.onerror = () => reject(tx.error || new Error("IndexedDB read failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB read aborted."));

    try {
      executor(store, resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
};

export const isLocalImageUri = (value) =>
  typeof value === "string" && value.startsWith(LOCAL_IMAGE_PREFIX);

export const toLocalImageUri = (id) => `${LOCAL_IMAGE_PREFIX}${id}`;

export const getLocalImageId = (value) => {
  if (!value) return null;
  if (isLocalImageUri(value)) return value.slice(LOCAL_IMAGE_PREFIX.length);
  return String(value);
};

export const validateImageFile = (file, options = {}) => {
  const maxSizeBytes = options.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES;
  if (!file) throw new Error("Vui lòng chọn file ảnh.");
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("File được chọn không phải là ảnh.");
  }
  if (file.size > maxSizeBytes) {
    throw new Error(`Ảnh gốc không được vượt quá ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`);
  }
};

const supportsWebp = () => {
  if (webpSupportPromise) return webpSupportPromise;

  webpSupportPromise = new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(false);
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob(
      (blob) => resolve(!!blob && blob.type === WEBP_MIME),
      WEBP_MIME,
      0.7
    );
  });

  return webpSupportPromise;
};

const loadBitmap = async (file) => {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không thể đọc file ảnh."));
    };
    img.src = objectUrl;
  });
};

const calculateSize = (width, height, maxWidth) => {
  if (!width || !height) return { width: maxWidth, height: maxWidth };
  if (width <= maxWidth) return { width, height };
  const ratio = maxWidth / width;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
};

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Không thể nén ảnh."));
      },
      mimeType,
      quality
    );
  });

const compressBitmap = async (bitmap, { maxWidth, quality, mimeType }) => {
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  const target = calculateSize(sourceWidth, sourceHeight, maxWidth);

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  return {
    blob,
    width: target.width,
    height: target.height,
    size: blob.size,
  };
};

export const optimizeImageFile = async (file, options = {}) => {
  validateImageFile(file, options);

  const bitmap = await loadBitmap(file);
  const mimeType = (await supportsWebp()) ? WEBP_MIME : JPEG_MIME;

  try {
    const [thumb, preview] = await Promise.all([
      compressBitmap(bitmap, {
        maxWidth: options.thumbMaxWidth || THUMB_MAX_WIDTH,
        quality: options.thumbQuality || THUMB_QUALITY,
        mimeType,
      }),
      compressBitmap(bitmap, {
        maxWidth: options.previewMaxWidth || PREVIEW_MAX_WIDTH,
        quality: options.previewQuality || PREVIEW_QUALITY,
        mimeType,
      }),
    ]);

    return {
      mimeType,
      originalName: file.name || "local-image",
      originalType: file.type || "image/*",
      originalSize: file.size || 0,
      originalWidth: bitmap.width || bitmap.naturalWidth || null,
      originalHeight: bitmap.height || bitmap.naturalHeight || null,
      thumb,
      preview,
    };
  } finally {
    if (typeof bitmap.close === "function") bitmap.close();
  }
};

export const saveLocalImage = async (file, metadata = {}) => {
  const optimized = await optimizeImageFile(file, metadata);

  const id =
    metadata.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`);

  const now = new Date().toISOString();
  const record = {
    id,
    originalName: optimized.originalName,
    originalType: optimized.originalType,
    originalSize: optimized.originalSize,
    originalWidth: optimized.originalWidth,
    originalHeight: optimized.originalHeight,
    mimeType: optimized.mimeType,

    thumbBlob: optimized.thumb.blob,
    thumbWidth: optimized.thumb.width,
    thumbHeight: optimized.thumb.height,
    thumbSize: optimized.thumb.size,

    previewBlob: optimized.preview.blob,
    previewWidth: optimized.preview.width,
    previewHeight: optimized.preview.height,
    previewSize: optimized.preview.size,

    ownerKey: metadata.ownerKey || null,
    purpose: metadata.purpose || "menu-image",
    createdAt: now,
    updatedAt: now,
    version: 2,
  };

  await runStore("readwrite", (store) => store.put(record));

  return {
    ...record,
    uri: toLocalImageUri(id),
  };
};

export const getLocalImage = async (uriOrId) => {
  const id = getLocalImageId(uriOrId);
  if (!id) return null;

  return readStore((store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Cannot read local image."));
  });
};

export const deleteLocalImage = async (uriOrId) => {
  const id = getLocalImageId(uriOrId);
  if (!id) return;
  await runStore("readwrite", (store) => store.delete(id));
};

const getVariantBlob = (record, variant = "preview") => {
  if (!record) return null;
  if (variant === "thumb") return record.thumbBlob || record.previewBlob || record.blob || null;
  return record.previewBlob || record.thumbBlob || record.blob || null;
};

export const createLocalImageObjectUrl = async (uriOrId, variant = "preview") => {
  const record = await getLocalImage(uriOrId);
  const blob = getVariantBlob(record, variant);
  if (!blob) return null;
  return URL.createObjectURL(blob);
};

export const getLocalImageStats = async (uriOrId) => {
  const record = await getLocalImage(uriOrId);
  if (!record) return null;

  return {
    id: record.id,
    originalSize: record.originalSize || record.size || 0,
    thumbSize: record.thumbSize || record.thumbBlob?.size || 0,
    previewSize: record.previewSize || record.previewBlob?.size || 0,
    savedBytes:
      (record.originalSize || record.size || 0) -
      ((record.thumbSize || record.thumbBlob?.size || 0) +
        (record.previewSize || record.previewBlob?.size || 0)),
  };
};

export const LOCAL_IMAGE_SCHEME = LOCAL_IMAGE_PREFIX;
export const LOCAL_IMAGE_VARIANTS = {
  THUMB: "thumb",
  PREVIEW: "preview",
};
