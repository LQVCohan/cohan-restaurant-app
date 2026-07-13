const DB_NAME = "cohan-table-3d-capture";
const DB_VERSION = 1;
const STORE_NAME = "capture-slots";
const DEFAULT_SCOPE = "default";

export const TABLE_3D_BUILDER_OPEN_SESSION_KEY =
  "cohan:table-3d-builder:open";
export const TABLE_3D_BUILDER_MODE_SESSION_KEY =
  "cohan:table-3d-builder:mode";

export const AI_CAPTURE_MAX_SOURCE_BYTES = 30 * 1024 * 1024;
export const AI_CAPTURE_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const AI_CAPTURE_TARGET_BYTES = Math.round(1.6 * 1024 * 1024);
export const AI_CAPTURE_MAX_EDGE = 2048;
export const AI_CAPTURE_MIN_EDGE = 1280;

const ACCEPTED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const normalizeScope = (scope) =>
  String(scope || DEFAULT_SCOPE)
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .slice(0, 120) || DEFAULT_SCOPE;

const slotKey = (scope, index) => `${normalizeScope(scope)}:${Number(index)}`;

export const getTable3DBuilderSessionState = () => {
  if (typeof window === "undefined") return { open: false, mode: "parametric" };
  try {
    return {
      open: window.sessionStorage.getItem(TABLE_3D_BUILDER_OPEN_SESSION_KEY) === "1",
      mode:
        window.sessionStorage.getItem(TABLE_3D_BUILDER_MODE_SESSION_KEY) ||
        "parametric",
    };
  } catch {
    return { open: false, mode: "parametric" };
  }
};

export const setTable3DBuilderSessionState = ({ open, mode } = {}) => {
  if (typeof window === "undefined") return;
  try {
    if (typeof open === "boolean") {
      window.sessionStorage.setItem(
        TABLE_3D_BUILDER_OPEN_SESSION_KEY,
        open ? "1" : "0",
      );
    }
    if (mode) {
      window.sessionStorage.setItem(TABLE_3D_BUILDER_MODE_SESSION_KEY, mode);
    }
  } catch {
    // Private browsing or strict storage policies may block sessionStorage.
  }
};

export const clearTable3DBuilderSessionState = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TABLE_3D_BUILDER_OPEN_SESSION_KEY);
    window.sessionStorage.removeItem(TABLE_3D_BUILDER_MODE_SESSION_KEY);
  } catch {
    // Closing the builder must still work when storage is unavailable.
  }
};

export const validateAiTableCaptureFile = (file) => {
  if (!file) return "Không tìm thấy ảnh vừa chụp.";
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  const extensionAccepted = /\.(jpe?g|png|webp|avif)$/i.test(name);

  if (!ACCEPTED_INPUT_TYPES.has(type) && !extensionAccepted) {
    if (/\.(heic|heif)$/i.test(name) || /heic|heif/i.test(type)) {
      return "Ảnh HEIC/HEIF chưa được trình duyệt giải mã. Hãy chọn chế độ Tương thích/JPG trong cài đặt camera.";
    }
    return "Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc AVIF có thể đọc trực tiếp trên web.";
  }
  if (Number(file.size || 0) > AI_CAPTURE_MAX_SOURCE_BYTES) {
    return "Ảnh gốc vượt quá 30 MB. Hãy giảm độ phân giải camera rồi chụp lại.";
  }
  return "";
};

export const calculateCaptureDimensions = (
  width,
  height,
  maxEdge = AI_CAPTURE_MAX_EDGE,
) => {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const longest = Math.max(safeWidth, safeHeight);
  const scale = Math.min(1, maxEdge / longest);
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
};

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Trình duyệt không thể nén ảnh vừa chụp."));
      },
      "image/jpeg",
      quality,
    );
  });

const decodeImage = async (file) => {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close?.(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("Không thể đọc ảnh vừa chụp."));
      node.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

const outputName = (name) => {
  const base = String(name || "capture").replace(/\.[^.]+$/, "") || "capture";
  return `${base}-web.jpg`;
};

export const processAiTableCapture = async (file) => {
  const validationMessage = validateAiTableCaptureFile(file);
  if (validationMessage) throw new Error(validationMessage);

  let decoded;
  try {
    decoded = await decodeImage(file);
  } catch (error) {
    throw new Error(
      error?.message ||
        "Không thể giải mã ảnh camera. Hãy dùng định dạng JPG/Tương thích.",
    );
  }

  const originalWidth = decoded.width;
  const originalHeight = decoded.height;
  let dimensions = calculateCaptureDimensions(originalWidth, originalHeight);
  let qualityIndex = 0;
  const qualities = [0.86, 0.8, 0.74, 0.68, 0.62];
  let blob = null;
  let usedQuality = qualities[0];

  try {
    while (true) {
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Thiết bị không hỗ trợ xử lý ảnh bằng Canvas.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      usedQuality = qualities[Math.min(qualityIndex, qualities.length - 1)];
      blob = await canvasToBlob(canvas, usedQuality);
      canvas.width = 1;
      canvas.height = 1;

      if (blob.size <= AI_CAPTURE_TARGET_BYTES) break;
      if (qualityIndex < qualities.length - 1) {
        qualityIndex += 1;
        continue;
      }

      const nextWidth = Math.round(dimensions.width * 0.85);
      const nextHeight = Math.round(dimensions.height * 0.85);
      if (Math.max(nextWidth, nextHeight) < AI_CAPTURE_MIN_EDGE) break;
      dimensions = { width: nextWidth, height: nextHeight };
      qualityIndex = Math.max(2, qualityIndex - 1);
    }
  } finally {
    decoded.dispose?.();
  }

  if (!blob || blob.size > AI_CAPTURE_MAX_OUTPUT_BYTES) {
    throw new Error(
      "Ảnh vẫn quá nặng sau khi nén. Hãy giảm độ phân giải camera và thử lại.",
    );
  }

  const processedFile = new File([blob], outputName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  return {
    file: processedFile,
    metadata: {
      originalName: file.name || "Ảnh camera",
      originalSize: Number(file.size || 0),
      outputSize: processedFile.size,
      originalWidth,
      originalHeight,
      width: dimensions.width,
      height: dimensions.height,
      quality: usedQuality,
      savedAt: Date.now(),
    },
  };
};

const openDatabase = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không mở được IndexedDB."));
  });

const runTransaction = async (mode, callback) => {
  const database = await openDatabase();
  if (!database) return null;
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};

const requestResult = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });

export const saveAiTableCaptureDraftSlot = async (
  scope,
  index,
  { file, metadata },
) => {
  if (!file) return;
  await runTransaction("readwrite", (store) => {
    store.put({
      key: slotKey(scope, index),
      scope: normalizeScope(scope),
      index: Number(index),
      blob: file,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      metadata,
      updatedAt: Date.now(),
    });
  });
};

export const loadAiTableCaptureDraft = async (scope, slotCount = 5) => {
  const images = Array(slotCount).fill(null);
  const metadata = Array(slotCount).fill(null);
  const database = await openDatabase();
  if (!database) return { images, metadata };

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const records = await Promise.all(
      Array.from({ length: slotCount }, (_, index) =>
        requestResult(store.get(slotKey(scope, index))),
      ),
    );
    records.forEach((record, index) => {
      if (!record?.blob) return;
      images[index] = new File([record.blob], record.name || `capture-${index + 1}.jpg`, {
        type: record.type || "image/jpeg",
        lastModified: record.lastModified || record.updatedAt || Date.now(),
      });
      metadata[index] = record.metadata || null;
    });
    return { images, metadata };
  } finally {
    database.close();
  }
};

export const clearAiTableCaptureDraft = async (scope, slotCount = 5) => {
  await runTransaction("readwrite", (store) => {
    Array.from({ length: slotCount }, (_, index) =>
      store.delete(slotKey(scope, index)),
    );
  });
};
