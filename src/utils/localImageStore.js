const DB_NAME = "cohan-restaurant-local-media";
const DB_VERSION = 1;
const IMAGE_STORE = "images";
const LOCAL_IMAGE_PREFIX = "local-image://";
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

let dbPromise = null;

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
    throw new Error(`Ảnh không được vượt quá ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`);
  }
};

export const saveLocalImage = async (file, metadata = {}) => {
  validateImageFile(file, metadata);

  const id =
    metadata.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`);

  const now = new Date().toISOString();
  const record = {
    id,
    blob: file,
    name: file.name || "local-image",
    type: file.type || "image/*",
    size: file.size || 0,
    ownerKey: metadata.ownerKey || null,
    purpose: metadata.purpose || "menu-image",
    createdAt: now,
    updatedAt: now,
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

export const createLocalImageObjectUrl = async (uriOrId) => {
  const record = await getLocalImage(uriOrId);
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
};

export const LOCAL_IMAGE_SCHEME = LOCAL_IMAGE_PREFIX;
