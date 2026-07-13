const EMPTY_SELECTION = Object.freeze({
  active: false,
  restaurantId: "",
  tableId: "",
  selectedOrderIds: [],
  allOrderIds: [],
  isPartial: false,
  useOrderIds: false,
});

let currentSelection = EMPTY_SELECTION;
const memoryPartialTables = new Set();
const STORAGE_PREFIX = "cohan_pos_partial_payment:";

const normalizeIds = (values = []) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  ),
];

const getTableKey = ({ restaurantId, tableId } = {}) => {
  const restaurant = String(restaurantId || "").trim();
  const table = String(tableId || "").trim();
  return restaurant && table ? `${restaurant}:${table}` : "";
};

const getStorageKey = (scope) => {
  const key = getTableKey(scope);
  return key ? `${STORAGE_PREFIX}${key}` : "";
};

export function tableHasPartialPaymentHistory(scope = {}) {
  const key = getTableKey(scope);
  if (!key) return false;
  if (memoryPartialTables.has(key)) return true;

  if (typeof window === "undefined") return false;
  try {
    const exists = window.sessionStorage.getItem(getStorageKey(scope)) === "1";
    if (exists) memoryPartialTables.add(key);
    return exists;
  } catch {
    return false;
  }
}

export function markTablePartialPaymentHistory(scope = {}) {
  const key = getTableKey(scope);
  if (!key) return;
  memoryPartialTables.add(key);

  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getStorageKey(scope), "1");
  } catch {
    // In-memory history still keeps the current POS session safe.
  }
}

export function clearTablePartialPaymentHistory(scope = {}) {
  const key = getTableKey(scope);
  if (!key) return;
  memoryPartialTables.delete(key);

  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(getStorageKey(scope));
  } catch {
    // No-op when storage is unavailable.
  }
}

export function setPartialTablePaymentSelection(selection = {}) {
  const selectedOrderIds = normalizeIds(selection.selectedOrderIds);
  const allOrderIds = normalizeIds(selection.allOrderIds);
  const scope = {
    restaurantId: String(selection.restaurantId || "").trim(),
    tableId: String(selection.tableId || "").trim(),
  };
  const isPartial =
    selectedOrderIds.length > 0 &&
    allOrderIds.length > 0 &&
    selectedOrderIds.length < allOrderIds.length;

  currentSelection = {
    active: Boolean(selection.active && selectedOrderIds.length),
    ...scope,
    selectedOrderIds,
    allOrderIds,
    isPartial,
    useOrderIds: isPartial || tableHasPartialPaymentHistory(scope),
  };

  return currentSelection;
}

export function getPartialTablePaymentSelection() {
  return currentSelection;
}

export function clearPartialTablePaymentSelection() {
  currentSelection = EMPTY_SELECTION;
}
