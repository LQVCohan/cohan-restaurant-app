const numberOrZero = (value) => Number(value || 0) || 0;

const getSnapshotItems = (snapshot) => (Array.isArray(snapshot?.items) ? snapshot.items : []);

export const isComboOrderLine = (item = {}) =>
  String(item?.itemType || item?.kind || item?.type || "").toUpperCase() === "COMBO" ||
  Boolean(item?.comboId || item?.comboSnapshot);

export const getOrderLineDisplay = (item = {}, options = {}) => {
  const quantity = Math.max(1, numberOrZero(item.quantity || item.qty || 1));
  const combo = isComboOrderLine(item);
  const snapshot = item.comboSnapshot || {};
  const unitPrice = combo
    ? numberOrZero(snapshot.comboPrice ?? item.unitPrice ?? item.price)
    : numberOrZero(item.unitPrice ?? item.price ?? item.basePrice);
  const totalPrice = numberOrZero(item.totalPrice ?? item.lineSubtotal) || unitPrice * quantity;
  const originalPrice = combo ? numberOrZero(snapshot.originalPrice) : 0;
  const lineOriginalPrice = combo && originalPrice > 0 ? originalPrice * quantity : 0;
  const unitDiscountAmount = combo && originalPrice > unitPrice ? originalPrice - unitPrice : 0;
  const discountAmount = unitDiscountAmount * quantity;
  const childMultiplier = options.mode === "kitchen" ? quantity : 1;

  const childItems = combo
    ? getSnapshotItems(snapshot).map((child, index) => ({
        menuItemId: child.menuItemId || child.id || null,
        name: child.name || "Món trong combo",
        qty: Math.max(1, numberOrZero(child.qty || child.quantity || 1)) * childMultiplier,
        price: numberOrZero(child.price),
        note: child.note || child.options || "",
        key: child.menuItemId || child.id || `${child.name || "combo-item"}-${index}`,
      }))
    : [];

  return {
    isComboLine: combo,
    displayName: combo ? snapshot.name || item.name || "Combo" : item.name || "Món",
    badgeLabel: combo ? "Combo" : "",
    quantity,
    unitPrice,
    totalPrice,
    childItems,
    originalPrice,
    lineOriginalPrice,
    unitDiscountAmount,
    discountAmount,
    note: item.note || snapshot.note || "",
  };
};