// Backward-compatible shim for legacy imports used by CartPage tests.
// The old CustomerMenuPage no longer exists in this location, but some
// consumers still import getWarehouseInfo from this path.

export const getWarehouseInfo = (menuItem = {}) => {
  const warehouseId =
    menuItem?.warehouseId ||
    menuItem?.warehouse?._id ||
    menuItem?.warehouse?.id ||
    null;
  const warehouseName =
    menuItem?.warehouseName ||
    menuItem?.warehouse?.name ||
    null;
  return { warehouseId, warehouseName };
};

export default function CustomerMenuPage() {
  return null;
}
