import { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";

export const MY_BRANDS_QUERY = gql`
  query MyBrands {
    myBrands {
      id
      name
      slug
      description
      logoUrl
      status
      businessName
      businessTaxCode
      businessEmail
      businessPhone
      ownerId
      restaurantCount
      restaurants(limit: 100) { id name brandId avatar }
    }
    myBrandMemberships {
      id
      brandId
      role
      status
      restaurantIds
    }
  }
`;

const EMPTY_RESTAURANTS = [];
const getId = (item) => String(item?.id ?? item?._id ?? item?.restaurantId ?? "");
const storageGet = (key) => (typeof localStorage === "undefined" ? "" : localStorage.getItem(key) || "");
const storageSet = (key, value) => {
  if (typeof localStorage === "undefined") return;
  const nextValue = value || "";
  const currentValue = localStorage.getItem(key) || "";
  if (nextValue === currentValue) return;
  if (nextValue) localStorage.setItem(key, nextValue);
  else localStorage.removeItem(key);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("manager:scope-selection", { detail: { key, value: nextValue } }));
  }
};

const normalizeRestaurant = (restaurant) => ({
  ...restaurant,
  id: getId(restaurant),
  name: restaurant?.name || restaurant?.restaurantName || "Nhà hàng chưa đặt tên",
  brandId: restaurant?.brandId ? String(restaurant.brandId) : "",
});

export default function useBrandManagement(
  additionalRestaurants = EMPTY_RESTAURANTS,
  { skip = false } = {},
) {
  const {
    user,
    restaurants = [],
    restaurantsLoading = false,
  } = useContext(AuthContext) || {};
  const userId = String(user?.id || user?._id || "");
  const shouldSkip = skip || !userId;
  const { data, loading, error, refetch } = useQuery(MY_BRANDS_QUERY, {
    fetchPolicy: "cache-and-network",
    skip: shouldSkip,
  });
  const memberships = data?.myBrandMemberships || [];
  const membershipByBrandId = useMemo(
    () => new Map(memberships.map((membership) => [String(membership.brandId), membership])),
    [memberships],
  );
  const brands = useMemo(
    () => (data?.myBrands || []).map((brand) => {
      const membership = membershipByBrandId.get(String(brand.id)) || null;
      return {
        ...brand,
        membership,
        membershipRole: membership?.role || brand.membershipRole || brand.role || "",
        restaurantIds: membership?.restaurantIds || brand.restaurantIds || [],
      };
    }),
    [data?.myBrands, membershipByBrandId],
  );
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
    if (shouldSkip || loading) return;
    const availableBrandIds = brands.map((brand) => String(brand.id));
    const nextBrandId = availableBrandIds.includes(selectedBrandId)
      ? selectedBrandId
      : availableBrandIds[0] || "";
    if (nextBrandId !== selectedBrandId) setSelectedBrandId(nextBrandId);
  }, [brands, loading, selectedBrandId, shouldSkip]);

  useEffect(() => storageSet("manager.selectedBrandId", selectedBrandId), [selectedBrandId]);
  useEffect(() => storageSet("manager.selectedRestaurantId", selectedRestaurantId), [selectedRestaurantId]);

  useEffect(() => {
    const syncSelection = (event) => {
      const key = event?.detail?.key;
      const value = event?.detail?.value || "";
      if (key === "manager.selectedBrandId") setSelectedBrandId(value);
      if (key === "manager.selectedRestaurantId") setSelectedRestaurantId(value);
    };
    if (typeof window === "undefined") return undefined;
    window.addEventListener("manager:scope-selection", syncSelection);
    return () => window.removeEventListener("manager:scope-selection", syncSelection);
  }, []);

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
    loading: !shouldSkip && (loading || restaurantsLoading),
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
