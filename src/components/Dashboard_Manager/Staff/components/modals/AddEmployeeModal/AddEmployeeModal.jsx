import React, { useCallback, useMemo } from "react";
import EmployeeFormModal from "../EmployeeFormModal/EmployeeFormModal";

const normalizeId = (value) =>
  String(value?.id ?? value?._id ?? value?.restaurantId ?? value ?? "");

const AddEmployeeModal = ({
  defaultRestaurantId,
  restaurantList = [],
  onSubmit,
  ...props
}) => {
  const activeRestaurantId = normalizeId(defaultRestaurantId);
  const activeRestaurant = useMemo(
    () =>
      restaurantList.find(
        (restaurant) => normalizeId(restaurant) === activeRestaurantId,
      ) || null,
    [activeRestaurantId, restaurantList],
  );
  const activeBrandId = normalizeId(activeRestaurant?.brandId);
  const activeBusinessRestaurants = useMemo(
    () =>
      activeBrandId
        ? restaurantList.filter(
            (restaurant) =>
              normalizeId(restaurant?.brandId) === activeBrandId,
          )
        : [],
    [activeBrandId, restaurantList],
  );

  const handleSubmit = useCallback(
    async (values) => {
      const selectedRestaurantId =
        normalizeId(values?.restaurantId) || activeRestaurantId;
      const selectedRestaurantBelongsToActiveBusiness =
        activeBusinessRestaurants.some(
          (restaurant) => normalizeId(restaurant) === selectedRestaurantId,
        );

      if (
        !activeBrandId ||
        !selectedRestaurantId ||
        !selectedRestaurantBelongsToActiveBusiness
      ) {
        throw new Error(
          "Chưa xác định được doanh nghiệp và nhà hàng đang hoạt động.",
        );
      }

      const { restaurantId: _restaurantId, ...accountInput } = values || {};

      return onSubmit?.({
        ...accountInput,
        staffBusinessContext: {
          brandId: activeBrandId,
          restaurantId: selectedRestaurantId,
        },
      });
    },
    [activeBrandId, activeBusinessRestaurants, activeRestaurantId, onSubmit],
  );

  return (
    <EmployeeFormModal
      {...props}
      restaurantList={activeBusinessRestaurants}
      defaultRestaurantId={activeRestaurantId}
      onSubmit={handleSubmit}
    />
  );
};

export default AddEmployeeModal;
