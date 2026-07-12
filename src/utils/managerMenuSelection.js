const STORAGE_KEY = "manager.menu.selection";
export const MANAGER_MENU_SELECTION_EVENT = "manager:menu-selection";

let memorySelection = null;

const normalizeSelection = (value) => {
  const restaurantId = String(value?.restaurantId || "").trim();
  const menuId = String(value?.menuId || "").trim();
  const timeSlot = String(value?.timeSlot || "").trim();
  return restaurantId && menuId && timeSlot
    ? { restaurantId, menuId, timeSlot }
    : null;
};

export const getManagerMenuSelection = () => {
  if (memorySelection) return memorySelection;
  if (typeof window === "undefined") return null;
  try {
    memorySelection = normalizeSelection(
      JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null"),
    );
  } catch {
    memorySelection = null;
  }
  return memorySelection;
};

export const setManagerMenuSelection = (selection) => {
  memorySelection = normalizeSelection(selection);
  if (typeof window === "undefined") return memorySelection;

  try {
    if (memorySelection) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memorySelection));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // In-memory selection still keeps the current page consistent.
  }

  window.dispatchEvent(
    new CustomEvent(MANAGER_MENU_SELECTION_EVENT, {
      detail: memorySelection,
    }),
  );
  return memorySelection;
};
