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
  const restaurantId = normalizeId(defaultRestaurantId);
  const activeRestaurant = useMemo(
    () =>
      restaurantList.find(
        (restaurant) => normalizeId(restaurant) === restaurantId,
      ) || null,
    [restaurantId, restaurantList],
  );
  const brandId = normalizeId(activeRestaurant?.brandId);

  const handleSubmit = useCallback(
    async (values) => {
      if (!brandId || !restaurantId) {
        throw new Error(
          "Chưa xác định được doanh nghiệp và nhà hàng đang hoạt động.",
        );
      }

      const accountInput = { ...(values || {}) };
      delete accountInput.restaurantForStaff;

      return onSubmit?.({
        ...accountInput,
        staffBusinessContext: { brandId, restaurantId },
      });
    },
    [brandId, onSubmit, restaurantId],
  );

  return (
    <EmployeeFormModal
      {...props}
      restaurantList={activeRestaurant ? [activeRestaurant] : []}
      defaultRestaurantId={restaurantId}
      onSubmit={handleSubmit}
    />
  );
};

export default AddEmployeeModal;
