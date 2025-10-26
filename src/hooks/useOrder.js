import { usePOS } from "../context/POSContext";
import { formatPrice } from "../utils/formatters";

export function useOrder() {
  const { state, dispatch } = usePOS();

  const addToOrder = (menuItem, options) => {
    const orderItem = {
      id: Date.now(),
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: options.quantity,
      cookingOption: options.cookingOption,
      unit: options.unit,
      note: options.note,
      total: menuItem.price * options.quantity,
      isNew: true,
      isExisting: false,
      addedAt: new Date(),
    };

    dispatch({ type: "ADD_TO_ORDER", payload: orderItem });
  };

  const updateOrderItem = (itemId, updates) => {
    dispatch({
      type: "UPDATE_ORDER_ITEM",
      payload: { id: itemId, updates },
    });
  };

  const removeOrderItem = (itemId) => {
    dispatch({ type: "REMOVE_ORDER_ITEM", payload: itemId });
  };

  const changeQuantity = (itemId, change) => {
    const item = state.currentOrder.find((item) => item.id === itemId);
    if (item) {
      const newQuantity = Math.max(1, item.quantity + change);
      const newTotal = item.price * newQuantity;

      updateOrderItem(itemId, {
        quantity: newQuantity,
        total: newTotal,
      });
    }
  };

  const calculateOrderSummary = () => {
    const subtotal = state.currentOrder.reduce(
      (sum, item) => sum + item.total,
      0
    );
    const discount = 0;
    const tax = subtotal * 0.1;
    const service = subtotal * 0.05;
    const total = subtotal - discount + tax + service;

    return {
      subtotal,
      discount,
      tax,
      service,
      total,
      formatted: {
        subtotal: formatPrice(subtotal),
        discount: formatPrice(discount),
        tax: formatPrice(tax),
        service: formatPrice(service),
        total: formatPrice(total),
      },
    };
  };

  const saveOrder = () => {
    dispatch({ type: "SAVE_ORDER" });

    // Mark all items as existing (no longer new)
    state.currentOrder.forEach((item) => {
      updateOrderItem(item.id, { isNew: false, isExisting: true });
    });
  };

  const clearOrder = () => {
    dispatch({ type: "CLEAR_ORDER" });
  };

  return {
    currentOrder: state.currentOrder,
    addToOrder,
    updateOrderItem,
    removeOrderItem,
    changeQuantity,
    calculateOrderSummary,
    saveOrder,
    clearOrder,
  };
}
