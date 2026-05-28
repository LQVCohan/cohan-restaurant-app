export const OPEN_CUSTOMER_CART_EVENT = "cohan:open-customer-cart";

export const openCustomerCart = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_CUSTOMER_CART_EVENT));
};
