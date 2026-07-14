const asArray = (value) => (Array.isArray(value) ? value : []);

export function getPosDraftLineKey(item, index = 0) {
  if (!item) return `missing:${index}`;
  return String(
    item._lineId ||
      item.clientLineId ||
      item.cartItemId ||
      `${item.dishId || item.menuId || item.name || "item"}:${
        item.createdAt || index
      }`,
  );
}

export function normalizeDineInOrderItemsForPersistence(items = []) {
  return asArray(items).map((item) => {
    if (!item || item.isNew === true) return item;
    return {
      ...item,
      isNew: false,
      isExisting: true,
      _edited: false,
    };
  });
}

export function getExplicitDineInDraftItems(items = []) {
  return asArray(items).filter((item) => item?.isNew === true);
}

export function getSubmittedDraftKeys(items = []) {
  return new Set(
    getExplicitDineInDraftItems(items).map((item, index) =>
      getPosDraftLineKey(item, index),
    ),
  );
}

export function markSubmittedDineInDraftsPersisted(
  items = [],
  submittedKeys = new Set(),
) {
  return asArray(items).map((item, index) => {
    if (!item || !submittedKeys.has(getPosDraftLineKey(item, index))) {
      return item;
    }
    return {
      ...item,
      isNew: false,
      isExisting: true,
      _edited: false,
      persisted: true,
    };
  });
}

export function getDineInDraftStorageKeys({ restaurantId, table } = {}) {
  if (!restaurantId || !table) return [];
  const tableId = table.id || table._id || null;
  const tableCode = table.code ? String(table.code) : null;
  return [
    tableId ? `pos_draft_table_${restaurantId}_${tableId}` : null,
    tableCode ? `pos_draft_table_${restaurantId}_${tableCode}` : null,
    tableCode
      ? `pos_draft_table_${restaurantId}_${tableCode.toUpperCase()}`
      : null,
  ].filter(Boolean);
}
