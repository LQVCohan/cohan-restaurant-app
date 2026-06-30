import { gql, useMutation } from "@apollo/client";
import { useCallback, useMemo, useState } from "react";
import { useNotification } from "./useNotification";

const UPDATE_CART_ITEM = gql`
  mutation UpdateCartItem($input: UpdateCartItemInput!) {
    updateCartItem(input: $input) {
      id
    }
  }
`;

const REMOVE_CART_ITEM = gql`
  mutation RemoveCartItem($input: RemoveCartItemInput!) {
    removeCartItem(input: $input) {
      id
    }
  }
`;

const CLEAR_CART = gql`
  mutation ClearCart($input: ClearCartInput!) {
    clearCart(input: $input)
  }
`;

const getMutationErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

export const useCustomerCartActions = ({
  cart,
  updateQuantity,
  removeFromCart,
  clearCart,
  removeRestaurantItems,
  onAfterBackendCartChange,
}) => {
  const safeUpdateQuantity = updateQuantity || (() => {});
  const safeRemoveFromCart = removeFromCart || (() => {});
  const safeClearCart = clearCart || (() => {});
  const safeRemoveRestaurantItems = removeRestaurantItems || (() => {});
  const { showNotification } = useNotification();

  const [busyItemIds, setBusyItemIds] = useState({});
  const [busyRestaurantIds, setBusyRestaurantIds] = useState({});
  const [isClearing, setIsClearing] = useState(false);

  const [updateCartItemMutation] = useMutation(UPDATE_CART_ITEM);
  const [removeCartItemMutation] = useMutation(REMOVE_CART_ITEM);
  const [clearCartMutation] = useMutation(CLEAR_CART);

  const getItemBusyKey = (item) => item?.cartLineKey || item?.id;

  const setBusyItem = (itemId, value) => {
    setBusyItemIds((prev) => ({ ...prev, [itemId]: value }));
  };

  const notifyCartError = useCallback(
    (message) => showNotification(message, "error"),
    [showNotification],
  );

  const updateCartItemQuantity = useCallback(
    async (itemOrId, delta) => {
      const item =
        typeof itemOrId === "object"
          ? itemOrId
          : (cart || []).find((entry) => entry.id === itemOrId);
      if (!item) return;

      const nextQuantity = Math.max(1, Number(item.quantity || 1) + Number(delta || 0));
      if (nextQuantity === Number(item.quantity || 1)) return;

      if (!item.backendCartItemId) {
        safeUpdateQuantity(item, delta);
        return;
      }

      if (!item.backendCartId) {
        notifyCartError("Món này có giữ chỗ trên hệ thống nhưng thiếu thông tin giỏ hàng. Vui lòng thêm lại món.");
        return;
      }

      setBusyItem(getItemBusyKey(item), true);
      try {
        await updateCartItemMutation({
          variables: {
            input: {
              cartId: item.backendCartId,
              itemId: item.backendCartItemId,
              quantity: nextQuantity,
            },
          },
        });
        safeUpdateQuantity(item, delta);
        onAfterBackendCartChange?.();
      } catch (error) {
        notifyCartError(getMutationErrorMessage(error, "Không thể cập nhật số lượng món. Vui lòng thử lại."));
      } finally {
        setBusyItem(getItemBusyKey(item), false);
      }
    },
    [cart, notifyCartError, onAfterBackendCartChange, safeUpdateQuantity, updateCartItemMutation],
  );

  const removeCartLineItem = useCallback(
    async (item) => {
      if (!item) return;
      if (!item.backendCartItemId) {
        safeRemoveFromCart(item);
        return;
      }
      if (!item.backendCartId) {
        notifyCartError("Món này có giữ chỗ trên hệ thống nhưng thiếu thông tin giỏ hàng. Vui lòng thêm lại món.");
        return;
      }

      setBusyItem(getItemBusyKey(item), true);
      try {
        await removeCartItemMutation({
          variables: { input: { cartId: item.backendCartId, itemId: item.backendCartItemId } },
        });
        safeRemoveFromCart(item);
        onAfterBackendCartChange?.();
      } catch (error) {
        notifyCartError(getMutationErrorMessage(error, "Không thể xóa món. Vui lòng thử lại."));
      } finally {
        setBusyItem(getItemBusyKey(item), false);
      }
    },
    [notifyCartError, onAfterBackendCartChange, removeCartItemMutation, safeRemoveFromCart],
  );

  const removeRestaurantScopedItems = useCallback(
    async (restaurantId) => {
      const itemsToRemove = (cart || []).filter(
        (item) => String(item.restaurantId) === String(restaurantId),
      );
      if (!itemsToRemove.length) return;

      setBusyRestaurantIds((prev) => ({ ...prev, [restaurantId]: true }));
      try {
        const localOnlyItems = itemsToRemove.filter((item) => !item.backendCartItemId);
        for (const item of itemsToRemove) {
          if (!item.backendCartItemId) continue;
          if (!item.backendCartId) {
            notifyCartError("Có món đang giữ chỗ nhưng thiếu thông tin đồng bộ. Vui lòng thêm lại món.");
            return;
          }
          await removeCartItemMutation({
            variables: { input: { cartId: item.backendCartId, itemId: item.backendCartItemId } },
          });
          safeRemoveFromCart(item);
        }
        if (localOnlyItems.length) safeRemoveRestaurantItems(restaurantId);
        onAfterBackendCartChange?.();
      } catch (error) {
        notifyCartError(getMutationErrorMessage(error, "Không thể xóa món của nhà hàng này. Vui lòng thử lại."));
      } finally {
        setBusyRestaurantIds((prev) => ({ ...prev, [restaurantId]: false }));
      }
    },
    [
      cart,
      notifyCartError,
      onAfterBackendCartChange,
      removeCartItemMutation,
      safeRemoveFromCart,
      safeRemoveRestaurantItems,
    ],
  );

  const clearCustomerCart = useCallback(async () => {
    if (!(cart || []).length) return;
    setIsClearing(true);
    try {
      const firstBackendCartId = (cart || []).find((item) => item.backendCartId)?.backendCartId;
      if (firstBackendCartId) {
        try {
          await clearCartMutation({ variables: { input: { cartId: firstBackendCartId } } });
          safeClearCart();
          onAfterBackendCartChange?.();
          return;
        } catch {
          // fallback remove tuần tự
        }
      }

      const backendItems = (cart || []).filter((item) => item.backendCartItemId);
      for (const item of backendItems) {
        if (!item.backendCartId) {
          notifyCartError("Có món đang giữ chỗ nhưng thiếu thông tin đồng bộ. Vui lòng thêm lại món.");
          return;
        }
        await removeCartItemMutation({
          variables: { input: { cartId: item.backendCartId, itemId: item.backendCartItemId } },
        });
      }
      safeClearCart();
      onAfterBackendCartChange?.();
    } catch (error) {
      notifyCartError(getMutationErrorMessage(error, "Không thể xóa giỏ hàng. Vui lòng thử lại."));
    } finally {
      setIsClearing(false);
    }
  }, [
    cart,
    clearCartMutation,
    notifyCartError,
    onAfterBackendCartChange,
    removeCartItemMutation,
    safeClearCart,
  ]);

  const isBusy = useMemo(
    () => isClearing || Object.values(busyItemIds).some(Boolean) || Object.values(busyRestaurantIds).some(Boolean),
    [busyItemIds, busyRestaurantIds, isClearing],
  );

  return {
    updateCartItemQuantity,
    removeCartLineItem,
    clearCustomerCart,
    removeRestaurantScopedItems,
    isBusy,
    busyItemIds,
    busyRestaurantIds,
    isClearing,
  };
};
