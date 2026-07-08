import React, { useCallback, useMemo } from "react";
import EmployeeFormModal from "../EmployeeFormModal/EmployeeFormModal";

const normalizeId = (value) =>
  String(value?.id ?? value?._id ?? value?.restaurantId ?? value ?? "");

const AddEmployeeModal = ({
  businessContext,
  restaurantList = [],
  onSubmit,
  ...props
}) => {
  const brandId = normalizeId(businessContext?.brandId);
  const restaurantId = normalizeId(businessContext?.restaurantId);

  const activeRestaurantList = useMemo(
    () =>
      restaurantList.filter(
        (restaurant) => normalizeId(restaurant) === restaurantId,
      ),
    [restaurantId, restaurantList],
  );

  const handleSubmit = useCallback(
    async (values) => {
      if (!brandId || !restaurantId) {
        throw new Error(
          "Chưa xác định được doanh nghiệp và nhà hàng đang hoạt động.",
        );
      }

      const { restaurantForStaff: _legacyRestaurant, ...accountInput } =
        values || {};

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
      restaurantList={activeRestaurantList}
      defaultRestaurantId={restaurantId}
      onSubmit={handleSubmit}
    />
  );
};

export default AddEmployeeModal;
