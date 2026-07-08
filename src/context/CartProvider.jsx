import React, { createContext, useContext, useEffect, useMemo } from "react";
import { gql, useApolloClient, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { useCart as useCartCore } from "../hooks/useCart";

const CartContext = createContext(null);
const IS_TEST_ENV = import.meta.env.MODE === "test";
const CART_ADD_VALIDATION_EVENT = "cohan:cart-add-validation";

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
        modifiersPrice
        quantity
        thumbImage
        note
        servingVariantKey
        modifiers {
          groupId
          groupName
          optionId
          optionName
          priceRule {
            rule
            amount
          }
        }
        holdExpiresAt
        holdStatus
      }
    }
  }
`;

const CUSTOMER_MENU_ITEM = gql`
  query CartCustomerMenuItem($id: ID!, $restaurantId: ID) {
    customerMenuItem(id: $id, restaurantId: $restaurantId) {
      id
      restaurantId
      menuId
      categoryId
      name
      basePrice
      thumbImage
      defaultServingKey
      servingUnit
      servingVariants {
        key
        name
        mode
        price
        sellQty
        sellUnit
      }
    }
  }
`;

const noopRefetchServerCart = async () => null;

const mapServerCartItem = (cartId, item = {}) => ({
  itemType: item.itemType || "MENU_ITEM",
  id:
    item.itemType === "COMBO"
      ? item.comboId || item.id
      : item.menuItemId || item.id,
  dishId: item.menuItemId || item.id,
  menuItemId: item.menuItemId || item.id,
  comboId: item.comboId || null,
  comboSnapshot: item.comboSnapshot || null,
  restaurantId: item.restaurantId,
  name: item.name || "Món ăn",
  price: Number(item.price || 0),
  modifiersPrice: Number(item.modifiersPrice || 0),
  quantity: Number(item.quantity || 1) || 1,
  image: item.thumbImage || "",
  thumbImage: item.thumbImage || "",
  note: item.note || "",
  servingVariantKey: item.servingVariantKey || "portion",
  servingKey: item.servingVariantKey || "portion",
  modifiers: item.modifiers || [],
  selectedModifiers: (item.modifiers || []).map((modifier) => ({
    groupId: modifier.groupId,
    optionId: modifier.optionId,
  })),
  holdExpiresAt: item.holdExpiresAt || null,
  holdStatus: item.holdStatus || "active",
  backendCartId: cartId,
  backendCartItemId: item.id,
});

const resolveMenuItemId = (item = {}) =>
  item.menuItemId || item.dishId || item.itemId || item.id;

const isComboCartItem = (item = {}) =>
  item.itemType === "COMBO" || item.comboId;

const emitCartAddValidation = (status) => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const current = window.__cohanCartAddValidation;
  const summary =
    current && now - current.updatedAt < 1200
      ? current
      : { total: 0, pending: 0, success: 0, skipped: 0, updatedAt: now };

  if (status === "pending") {
    summary.total += 1;
    summary.pending += 1;
  } else if (status === "success") {
    summary.success += 1;
    summary.pending = Math.max(0, summary.pending - 1);
  } else if (status === "skipped") {
    summary.skipped += 1;
    summary.pending = Math.max(0, summary.pending - 1);
  }

  summary.updatedAt = now;
  window.__cohanCartAddValidation = summary;
  window.dispatchEvent(
    new CustomEvent(CART_ADD_VALIDATION_EVENT, { detail: summary }),
  );
};

const mergeLiveMenuItem = (cartItem = {}, menuItem = {}) => {
  const wantedVariantKey =
    cartItem.servingVariantKey || cartItem.servingKey || cartItem.variantKey;
  const variants = Array.isArray(menuItem.servingVariants)
    ? menuItem.servingVariants
    : [];
  const variant =
    variants.find((item) => item?.key === wantedVariantKey) ||
    variants.find((item) => item?.key === menuItem.defaultServingKey) ||
    variants[0] ||
    null;
  const servingVariantKey =
    variant?.key ||
    menuItem.defaultServingKey ||
    wantedVariantKey ||
    "portion";
  const price = Number(
    cartItem.backendCartItemId
      ? cartItem.price ?? variant?.price ?? menuItem.basePrice ?? 0
      : variant?.price ?? menuItem.basePrice ?? cartItem.price ?? 0,
  );

  return {
    ...cartItem,
    id: menuItem.id,
    dishId: menuItem.id,
    menuItemId: menuItem.id,
    menuId: menuItem.menuId || cartItem.menuId || null,
    categoryId: menuItem.categoryId || cartItem.categoryId || null,
    restaurantId: menuItem.restaurantId || cartItem.restaurantId,
    name: menuItem.name || cartItem.name || "Món ăn",
    price,
    modifiersPrice: Number(cartItem.modifiersPrice || 0),
    unit: menuItem.servingUnit || cartItem.unit || "phần",
    image:
      menuItem.thumbImage || cartItem.image || cartItem.thumbImage || "",
    thumbImage:
      menuItem.thumbImage || cartItem.thumbImage || cartItem.image || "",
    servingVariantKey,
    servingKey: servingVariantKey,
    method: variant?.name || cartItem.method || servingVariantKey,
    servingVariant: variant || cartItem.servingVariant,
    modifiers: cartItem.modifiers || [],
    selectedModifiers:
      cartItem.selectedModifiers ||
      (cartItem.modifiers || []).map((modifier) => ({
        groupId: modifier.groupId,
        optionId: modifier.optionId,
      })),
  };
};

async function resolveLiveCartItem(client, cartItem = {}) {
  if (!client || isComboCartItem(cartItem)) return cartItem;

  const id = resolveMenuItemId(cartItem);
  const restaurantId = cartItem.restaurantId;
  if (!id || !restaurantId) return cartItem;

  const { data } = await client.query({
    query: CUSTOMER_MENU_ITEM,
    variables: { id, restaurantId },
    fetchPolicy: "network-only",
  });

  return data?.customerMenuItem
    ? mergeLiveMenuItem(cartItem, data.customerMenuItem)
    : null;
}

function buildCartContextValue(cartState, serverCart, loading, refetch) {
  return {
    ...cartState,
    serverCart: serverCart || null,
    serverCartLoading: Boolean(loading),
    refetchServerCart: refetch || noopRefetchServerCart,
  };
}

function ServerCartBridge({ cartState, children }) {
  const client = useApolloClient();
  const { data, refetch, loading } = useQuery(MY_CART, {
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    const serverCart = data?.myCart;
    if (!serverCart?.id) return;
    const serverItems = (serverCart.items || []).map((item) =>
      mapServerCartItem(serverCart.id, item),
    );
    cartState.syncServerCart?.(serverItems, { replace: false });
  }, [cartState, data?.myCart]);

  const addToCart = useMemo(
    () => async (item) => {
      const shouldValidate = Boolean(
        client &&
          !isComboCartItem(item) &&
          resolveMenuItemId(item) &&
          item?.restaurantId,
      );
      if (shouldValidate) emitCartAddValidation("pending");

      try {
        const liveItem = await resolveLiveCartItem(client, item);
        if (!liveItem) {
          if (shouldValidate) emitCartAddValidation("skipped");
          return false;
        }
        cartState.addToCart(liveItem);
        if (shouldValidate) emitCartAddValidation("success");
        return true;
      } catch {
        if (shouldValidate) emitCartAddValidation("skipped");
        return false;
      }
    },
    [cartState, client],
  );

  const value = useMemo(
    () => ({
      ...buildCartContextValue(cartState, data?.myCart, loading, refetch),
      addToCart,
    }),
    [cartState, data?.myCart, loading, refetch, addToCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const CartProvider = ({ children }) => {
  const cartState = useCartCore();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const roleName = String(
    user?.roleName || user?.role?.slug || user?.role?.name || "",
  ).toLowerCase();
  const shouldLoadServerCart = Boolean(
    isAuthenticated && roleName === "customer" && !IS_TEST_ENV,
  );

  const localOnlyValue = useMemo(
    () => buildCartContextValue(cartState, null, false, noopRefetchServerCart),
    [cartState],
  );

  if (!shouldLoadServerCart) {
    return (
      <CartContext.Provider value={localOnlyValue}>
        {children}
      </CartContext.Provider>
    );
  }

  return (
    <ServerCartBridge cartState={cartState}>{children}</ServerCartBridge>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
};

export default CartContext;
