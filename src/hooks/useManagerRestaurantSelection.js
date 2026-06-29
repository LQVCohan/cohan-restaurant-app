import { useMemo } from "react";
import useBrandManagement from "./useBrandManagement";

export const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

const EMPTY_RESTAURANTS = [];

const useManagerRestaurantSelection = (additionalRestaurants = EMPTY_RESTAURANTS) => {
  const brandState = useBrandManagement(additionalRestaurants);
  const brandOptions = useMemo(
    () => brandState.brands.map((brand) => ({ ...brand, id: String(brand.id), name: brand.name || "Chuỗi chưa đặt tên" })),
    [brandState.brands],
  );
  const restaurantOptions = brandState.selectedBrandId
    ? brandState.restaurantsInSelectedBrand
    : brandState.legacyRestaurants.length
      ? brandState.legacyRestaurants
      : brandState.allManageableRestaurants;

  return {
    selectedBrandId: brandState.selectedBrandId,
    setSelectedBrandId: brandState.setSelectedBrandId,
    selectedBrand: brandState.selectedBrand,
    brandOptions,
    restaurantOptions,
    selectedRestaurantId: brandState.selectedRestaurantId,
    setSelectedRestaurantId: brandState.setSelectedRestaurantId,
    selectedRestaurant: brandState.selectedRestaurant,
    restaurantsLoading: brandState.loading,
    loading: brandState.loading,
    error: brandState.error,
    refetch: brandState.refetch,
    hasBrands: brandState.hasBrands,
    hasRestaurants: brandState.hasRestaurants,
    isLegacyRestaurantSelected: Boolean(brandState.selectedRestaurant && !brandState.selectedRestaurant.brandId),
  };
};

export default useManagerRestaurantSelection;
