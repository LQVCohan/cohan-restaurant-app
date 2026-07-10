const STORAGE_KEY = "cohan:staff-order:selected-table";
const MOBILE_QUERY = "(max-width: 899px)";

export const isStaffOrderMobile = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.(MOBILE_QUERY)?.matches === true;

export const readStaffOrderTableSelection = () => {
  if (typeof window === "undefined") return null;

  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null");
    if (!value?.id || !value?.tableCode) return null;
    return {
      id: String(value.id),
      tableCode: String(value.tableCode),
    };
  } catch {
    return null;
  }
};

export const saveStaffOrderTableSelection = (table) => {
  const tableCode = table?.tableCode || table?.code || table?.name;
  if (typeof window === "undefined" || !table?.id || !tableCode) return;

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: String(table.id),
        tableCode: String(tableCode),
      }),
    );
  } catch {
    // Session storage may be unavailable in restricted browser modes.
  }
};

export const clearStaffOrderTableSelection = () => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Session storage may be unavailable in restricted browser modes.
  }
};

export const openStaffOrderMenuTab = () => {
  if (!isStaffOrderMobile() || typeof document === "undefined") return false;

  const menuButton = Array.from(
    document.querySelectorAll(".staff-pos-bottom-nav .nav-item"),
  ).find((button) => button.textContent?.trim() === "Menu");

  menuButton?.click();
  return Boolean(menuButton);
};

export const __testables = {
  STORAGE_KEY,
  MOBILE_QUERY,
};
