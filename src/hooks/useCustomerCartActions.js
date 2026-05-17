import { gql, useMutation } from "@apollo/client";
import { useCallback, useMemo, useState } from "react";

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
}) => {
  const [busyItemIds, setBusyItemIds] = useState({});
  const [busyRestaurantIds, setBusyRestaurantIds] = useState({});
  const [isClearing, setIsClearing] = useState(false);

  const [updateCartItemMutation] = useMutation(UPDATE_CART_ITEM);
  const [removeCartItemMutation] = useMutation(REMOVE_CART_ITEM);
  const [clearCartMutation] = useMutation(CLEAR_CART);

  const setBusyItem = (itemId, value) => {
    setBusyItemIds((prev) => ({ ...prev, [itemId]: value }));
  };

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
        updateQuantity(item.id, delta);
        return;
      }

      if (!item.backendCartId) {
        alert("Món này có giữ chỗ trên hệ thống nhưng thiếu thông tin giỏ hàng. Vui lòng thêm lại món.");
        return;
      }

      setBusyItem(item.id, true);
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
        updateQuantity(item.id, delta);
      } catch (error) {
        alert(getMutationErrorMessage(error, "Không thể cập nhật số lượng món. Vui lòng thử lại."));
      } finally {
        setBusyItem(item.id, false);
      }
    },
    [cart, updateCartItemMutation, updateQuantity],
  );

  const removeCartLineItem = useCallback(
    async (item) => {
      if (!item) return;
      if (!item.backendCartItemId) {
        removeFromCart(item.id);
        return;
      }
      if (!item.backendCartId) {
        alert("Món này có giữ chỗ trên hệ thống nhưng thiếu thông tin giỏ hàng. Vui lòng thêm lại món.");
        return;
      }

      setBusyItem(item.id, true);
      try {
        await removeCartItemMutation({
          variables: { input: { cartId: item.backendCartId, itemId: item.backendCartItemId } },
        });
        removeFromCart(item.id);
      } catch (error) {
        alert(getMutationErrorMessage(error, "Không thể xóa món. Vui lòng thử lại."));
      } finally {
        setBusyItem(item.id, false);
      }
    },
    [removeCartItemMutation, removeFromCart],
  );

  const removeRestaurantScopedItems = useCallback(
    async (restaurantId) => {
      const itemsToRemove = (cart || []).filter(
        (item) => String(item.restaurantId) === String(restaurantId),
      );
      if (!itemsToRemove.length) return;

      setBusyRestaurantIds((prev) => ({ ...prev, [restaurantId]: true }));
      try {
        for (const item of itemsToRemove) {
          if (!item.backendCartItemId) {
            removeFromCart(item.id);
            continue;
          }
          if (!item.backendCartId) {
            alert("Có món đang giữ chỗ nhưng thiếu thông tin đồng bộ. Vui lòng thêm lại món.");
            return;
          }
          await removeCartItemMutation({
            variables: { input: { cartId: item.backendCartId, itemId: item.backendCartItemId } },
          });
          removeFromCart(item.id);
        }
      } catch (error) {
        alert(getMutationErrorMessage(error, "Không thể xóa món của nhà hàng này. Vui lòng thử lại."));
      } finally {
        setBusyRestaurantIds((prev) => ({ ...prev, [restaurantId]: false }));
      }
    },
    [cart, removeCartItemMutation, removeFromCart],
  );

  const clearCustomerCart = useCallback(async () => {
    if (!(cart || []).length) return;
    setIsClearing(true);
    try {
      const firstBackendCartId = (cart || []).find((item) => item.backendCartId)?.backendCartId;
      if (firstBackendCartId) {
        try {
          await clearCartMutation({ variables: { input: { cartId: firstBackendCartId } } });
          clearCart();
          return;
        } catch {
          // fallback remove tuần tự
        }
      }

      const backendItems = (cart || []).filter((item) => item.backendCartItemId);
      for (const item of backendItems) {
        if (!item.backendCartId) {
          alert("Có món đang giữ chỗ nhưng thiếu thông tin đồng bộ. Vui lòng thêm lại món.");
          return;
        }
        await removeCartItemMutation({
          variables: { input: { cartId: item.backendCartId, itemId: item.backendCartItemId } },
        });
      }
      clearCart();
    } catch (error) {
      alert(getMutationErrorMessage(error, "Không thể xóa giỏ hàng. Vui lòng thử lại."));
    } finally {
      setIsClearing(false);
    }
  }, [cart, clearCart, clearCartMutation, removeCartItemMutation]);

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
