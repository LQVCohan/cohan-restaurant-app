import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CartCore from "./CartCore";

export * from "./CartCore";

export const resolveBookingCartContext = ({
  search = "",
  state = null,
  bookingAddonMode = false,
  bookingRestaurantId = null,
} = {}) => {
  const params = new URLSearchParams(search);
  const returnTo = state?.returnTo || params.get("returnTo");
  const restaurantId =
    bookingRestaurantId || state?.restaurantId || params.get("restaurantId") || null;
  const hasServiceAt = Boolean(state?.serviceAt || params.get("serviceAt"));
  const inferredMode =
    returnTo === "booking" || Boolean(state?.bookingDraft && hasServiceAt);

  return {
    bookingAddonMode: Boolean(bookingAddonMode || (inferredMode && restaurantId)),
    bookingRestaurantId: restaurantId,
  };
};

const Cart = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingContext = useMemo(
    () =>
      resolveBookingCartContext({
        search: location.search,
        state: location.state,
        bookingAddonMode: props.bookingAddonMode,
        bookingRestaurantId: props.bookingRestaurantId,
      }),
    [
      location.search,
      location.state,
      props.bookingAddonMode,
      props.bookingRestaurantId,
    ],
  );

  const handleBookingAddonComplete =
    props.onBookingAddonComplete ||
    (() => {
      if (!bookingContext.bookingRestaurantId) return;
      navigate(
        `/restaurant/${encodeURIComponent(
          bookingContext.bookingRestaurantId,
        )}/layout?fromMenu=1`,
        {
          state: { bookingDraft: location.state?.bookingDraft || null },
        },
      );
    });

  return (
    <CartCore
      {...props}
      bookingAddonMode={bookingContext.bookingAddonMode}
      bookingRestaurantId={bookingContext.bookingRestaurantId}
      onBookingAddonComplete={handleBookingAddonComplete}
    />
  );
};

export default Cart;
