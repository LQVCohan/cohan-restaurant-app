const VR_TABLE_IMAGE_PREFIX = "vr-image-table:";

export const getTableVrImageKey = (tableId) =>
  `${VR_TABLE_IMAGE_PREFIX}${tableId}`;

export const loadTableVrImage = (tableId) => {
  if (typeof window === "undefined") return null;
  if (!tableId) return null;
  return window.localStorage.getItem(getTableVrImageKey(tableId));
};

export const storeTableVrImage = (tableId, dataUrl) => {
  if (typeof window === "undefined") return false;
  if (!tableId || !dataUrl) return false;
  try {
    window.localStorage.setItem(getTableVrImageKey(tableId), dataUrl);
    return true;
  } catch (error) {
    console.error("Không thể lưu ảnh 360 vào Local Storage.", error);
    return false;
  }
};

export const removeTableVrImage = (tableId) => {
  if (typeof window === "undefined") return;
  if (!tableId) return;
  window.localStorage.removeItem(getTableVrImageKey(tableId));
};
