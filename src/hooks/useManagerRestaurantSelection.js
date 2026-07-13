import { useMemo } from "react";
import useBrandManagement from "./useBrandManagement";
import { localizeDemoLabel } from "../utils/vietnameseDemoLabels";

export const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

const EMPTY_RESTAURANTS = [];

const localizeEntityName = (entity, fallback) =>
  entity
    ? {
        ...entity,
        name: localizeDemoLabel(entity.name, fallback),
      }
    : entity;

const useManagerRestaurantSelection = (additionalRestaurants = EMPTY_RESTAURANTS) => {
  const brandState = useBrandManagement(additionalRestaurants, {
    loadFullBrands: true,
  });
  const brandOptions = useMemo(
    () =>
      brandState.brands.map((brand) => ({
        ...brand,
        id: String(brand.id),
        name: localizeDemoLabel(brand.name, "Chuỗi chưa đặt tên"),
      })),
    [brandState.brands],
  );
  const rawRestaurantOptions = brandState.selectedBrandId
    ? brandState.restaurantsInSelectedBrand
    : brandState.legacyRestaurants.length
      ? brandState.legacyRestaurants
      : brandState.allManageableRestaurants;
  const restaurantOptions = useMemo(
    () =>
      (Array.isArray(rawRestaurantOptions) ? rawRestaurantOptions : []).map(
        (restaurant) =>
          localizeEntityName(restaurant, "Nhà hàng chưa đặt tên"),
      ),
    [rawRestaurantOptions],
  );
  const selectedBrand = useMemo(
    () => localizeEntityName(brandState.selectedBrand, "Chuỗi chưa đặt tên"),
    [brandState.selectedBrand],
  );
  const selectedRestaurant = useMemo(
    () =>
      localizeEntityName(
        brandState.selectedRestaurant,
        "Nhà hàng chưa đặt tên",
      ),
    [brandState.selectedRestaurant],
  );

  return {
    selectedBrandId: brandState.selectedBrandId,
    setSelectedBrandId: brandState.setSelectedBrandId,
    selectedBrand,
    brandOptions,
    restaurantOptions,
    selectedRestaurantId: brandState.selectedRestaurantId,
    setSelectedRestaurantId: brandState.setSelectedRestaurantId,
    selectedRestaurant,
    restaurantsLoading: brandState.loading,
    loading: brandState.loading,
    error: brandState.error,
    refetch: brandState.refetch,
    hasBrands: brandState.hasBrands,
    hasRestaurants: brandState.hasRestaurants,
    isLegacyRestaurantSelected: Boolean(
      brandState.selectedRestaurant && !brandState.selectedRestaurant.brandId,
    ),
  };
};

export default useManagerRestaurantSelection;
