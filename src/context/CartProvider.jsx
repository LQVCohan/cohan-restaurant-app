import React, { createContext, useContext, useEffect, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { useCart as useCartCore } from "../hooks/useCart";

const CartContext = createContext(null);

const MY_CART = gql`
  query MyActiveCustomerCartForContext {
    myCart {
      id
      restaurantId
      totalQuantity
      totalAmount
      totalPrice
      items {
        id
        restaurantId
        itemType
        menuItemId
        comboId
        comboSnapshot
        name
        price
        quantity
        thumbImage
        note
        servingVariantKey
        holdExpiresAt
        holdStatus
      }
    }
  }
`;

const mapServerCartItem = (cartId, item = {}) => ({
  itemType: item.itemType || "MENU_ITEM",
  id: item.itemType === "COMBO" ? (item.comboId || item.id) : (item.menuItemId || item.id),
  dishId: item.menuItemId || item.id,
  comboId: item.comboId || null,
  comboSnapshot: item.comboSnapshot || null,
  restaurantId: item.restaurantId,
  name: item.name || "Món ăn",
  price: Number(item.price || 0),
  quantity: Number(item.quantity || 1) || 1,
  image: item.thumbImage || "",
  thumbImage: item.thumbImage || "",
  note: item.note || "",
  servingVariantKey: item.servingVariantKey || "portion",
  holdExpiresAt: item.holdExpiresAt || null,
  holdStatus: item.holdStatus || "active",
  backendCartId: cartId,
  backendCartItemId: item.id,
});

export const CartProvider = ({ children }) => {
  const cartState = useCartCore();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const roleName = String(user?.roleName || user?.role?.slug || user?.role?.name || "").toLowerCase();
  const isCustomer = roleName === "customer";

  const { data, refetch, loading } = useQuery(MY_CART, {
    skip: !isAuthenticated || !isCustomer,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    const serverCart = data?.myCart;
    if (!serverCart?.id) return;
    const serverItems = (serverCart.items || []).map((item) => mapServerCartItem(serverCart.id, item));
    cartState.syncServerCart(serverItems, { replace: false });
  }, [cartState.syncServerCart, data?.myCart]);

  const value = useMemo(
    () => ({
      ...cartState,
      serverCart: data?.myCart || null,
      serverCartLoading: loading,
      refetchServerCart: refetch,
    }),
    [cartState, data?.myCart, loading, refetch],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
};

export default CartContext;
