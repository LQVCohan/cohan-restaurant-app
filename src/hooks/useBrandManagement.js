import { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";

export const MY_BRANDS_QUERY = gql`
  query MyBrands {
    myBrands {
      id
      name
      slug
      logoUrl
      status
      restaurantCount
      restaurants(limit: 100) { id name brandId avatar }
    }
  }
`;

const getId = (item) => String(item?.id ?? item?._id ?? item?.restaurantId ?? "");
const storageGet = (key) => (typeof localStorage === "undefined" ? "" : localStorage.getItem(key) || "");
const storageSet = (key, value) => {
  if (typeof localStorage === "undefined") return;
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
};

const normalizeRestaurant = (restaurant) => ({
  ...restaurant,
  id: getId(restaurant),
  name: restaurant?.name || restaurant?.restaurantName || "Nhà hàng chưa đặt tên",
  brandId: restaurant?.brandId ? String(restaurant.brandId) : "",
});

export default function useBrandManagement(additionalRestaurants = []) {
  const { restaurants = [], restaurantsLoading = false } = useContext(AuthContext) || {};
  const { data, loading, error, refetch } = useQuery(MY_BRANDS_QUERY, { fetchPolicy: "cache-and-network" });
  const brands = data?.myBrands || [];
  const [selectedBrandId, setSelectedBrandId] = useState(() => storageGet("manager.selectedBrandId"));
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(() => storageGet("manager.selectedRestaurantId"));

  const brandRestaurantIds = useMemo(() => new Set(brands.flatMap((brand) => (brand.restaurants || []).map(getId)).filter(Boolean)), [brands]);
  const authRestaurants = useMemo(() => [...(restaurants || []), ...(additionalRestaurants || [])].map(normalizeRestaurant).filter((r) => r.id), [additionalRestaurants, restaurants]);

  const legacyRestaurants = useMemo(() => {
    const seen = new Set();
    return authRestaurants.filter((restaurant) => {
      if (seen.has(restaurant.id)) return false;
      seen.add(restaurant.id);
      return !restaurant.brandId || !brandRestaurantIds.has(restaurant.id);
    });
  }, [authRestaurants, brandRestaurantIds]);

  const selectedBrand = useMemo(() => brands.find((b) => String(b.id) === selectedBrandId) || null, [brands, selectedBrandId]);
  const restaurantsInSelectedBrand = useMemo(() => (selectedBrand?.restaurants || []).map(normalizeRestaurant), [selectedBrand]);

  const allManageableRestaurants = useMemo(() => {
    const seen = new Set();
    return [...brands.flatMap((brand) => brand.restaurants || []), ...legacyRestaurants]
      .map(normalizeRestaurant)
      .filter((restaurant) => {
        if (!restaurant.id || seen.has(restaurant.id)) return false;
        seen.add(restaurant.id);
        return true;
      });
  }, [brands, legacyRestaurants]);

  const activeRestaurantOptions = useMemo(
    () => selectedBrandId ? restaurantsInSelectedBrand : legacyRestaurants.length ? legacyRestaurants : allManageableRestaurants,
    [allManageableRestaurants, legacyRestaurants, restaurantsInSelectedBrand, selectedBrandId],
  );

  useEffect(() => {
    if (!selectedBrandId && brands.length === 1) setSelectedBrandId(String(brands[0].id));
  }, [brands, selectedBrandId]);

  useEffect(() => storageSet("manager.selectedBrandId", selectedBrandId), [selectedBrandId]);
  useEffect(() => storageSet("manager.selectedRestaurantId", selectedRestaurantId), [selectedRestaurantId]);

  useEffect(() => {
    setSelectedRestaurantId((currentId) => {
      if (!activeRestaurantOptions.length) return "";
      if (currentId && activeRestaurantOptions.some((restaurant) => restaurant.id === currentId)) return currentId;
      return activeRestaurantOptions.length === 1 || !currentId ? activeRestaurantOptions[0].id : "";
    });
  }, [activeRestaurantOptions]);

  const selectedRestaurant = useMemo(
    () => activeRestaurantOptions.find((restaurant) => restaurant.id === selectedRestaurantId) || null,
    [activeRestaurantOptions, selectedRestaurantId],
  );

  return {
    brands,
    loading: loading || restaurantsLoading,
    error,
    refetch,
    selectedBrandId,
    setSelectedBrandId,
    selectedBrand,
    restaurantsInSelectedBrand,
    legacyRestaurants,
    allManageableRestaurants,
    selectedRestaurantId,
    setSelectedRestaurantId,
    selectedRestaurant,
    hasBrands: brands.length > 0,
    hasRestaurants: activeRestaurantOptions.length > 0,
    isBrandScoped: Boolean(selectedBrandId),
  };
}
