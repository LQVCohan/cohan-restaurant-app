import React, { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import FoodDetailV2Core from "./FoodDetailV2Core";

export * from "./FoodDetailV2Core";

export const isBookingAddonFoodDetail = ({ search = "", state = null } = {}) => {
  const params = new URLSearchParams(search);
  const returnTo = state?.returnTo || params.get("returnTo");
  const hasServiceAt = Boolean(state?.serviceAt || params.get("serviceAt"));
  return returnTo === "booking" || Boolean(state?.bookingDraft && hasServiceAt);
};

const FoodDetailV2 = () => {
  const location = useLocation();
  const bookingAddonMode = useMemo(
    () => isBookingAddonFoodDetail(location),
    [location.search, location.state],
  );

  useEffect(() => {
    if (!bookingAddonMode) return undefined;
    document.documentElement.classList.add("booking-addon-food-detail");
    return () => {
      document.documentElement.classList.remove("booking-addon-food-detail");
    };
  }, [bookingAddonMode]);

  return (
    <>
      {bookingAddonMode ? (
        <style>{`
          .booking-addon-food-detail .food-detail-v2__actions > button:not(.secondary) {
            display: none;
          }

          .booking-addon-food-detail .food-detail-v2__actions {
            grid-template-columns: minmax(0, 1fr);
          }
        `}</style>
      ) : null}
      <FoodDetailV2Core />
    </>
  );
};

export default FoodDetailV2;
