import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";
import { isAdminRole } from "../utils/frontendRoleAccess";

export const MY_BRANDS_QUERY = gql`
  query MyBrands {
    myBrands {
      id
      name
      slug
      logoUrl
      status
      businessName
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
const EMPTY_MEMBERSHIPS = [];
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

const getScopedBrandRestaurants = (brand, systemAdmin) => {
  const restaurants = (brand?.restaurants || [])
    .map(normalizeRestaurant)
    .filter((restaurant) => restaurant.id);
  if (systemAdmin || ["owner", "admin"].includes(brand?.membershipRole)) {
    return restaurants;
  }
  if (!["manager", "staff"].includes(brand?.membershipRole)) return [];

  const allowedIds = new Set((brand?.restaurantIds || []).map(String));
  return restaurants.filter((restaurant) => allowedIds.has(restaurant.id));
};

export default function useBrandManagement(
  additionalRestaurants = EMPTY_RESTAURANTS,
  { skip = false, loadFullBrands = false } = {},
) {
  const {
    user,
    brandMemberships: contextMemberships,
    restaurants = [],
    restaurantsLoading = false,
  } = useContext(AuthContext) || {};
  const userId = String(user?.id || user?._id || "");
  const systemAdmin = isAdminRole(user);
  const shouldUseContextBrands = Boolean(
    !loadFullBrands &&
      !systemAdmin &&
      userId &&
      Array.isArray(contextMemberships),
  );
  const shouldSkipQuery = skip || !userId || shouldUseContextBrands;
  const {
    data,
    loading: queryLoading,
    error,
    refetch,
  } = useQuery(MY_BRANDS_QUERY, {
    fetchPolicy: "cache-and-network",
    skip: shouldSkipQuery,
  });
  const authRestaurants = useMemo(
    () => [...(restaurants || []), ...(additionalRestaurants || [])]
      .map(normalizeRestaurant)
      .filter((restaurant) => restaurant.id),
    [additionalRestaurants, restaurants],
  );
  const memberships = shouldUseContextBrands
    ? contextMemberships
    : data?.myBrandMemberships || EMPTY_MEMBERSHIPS;
  const membershipByBrandId = useMemo(
    () => new Map(memberships.map((membership) => [String(membership.brandId), membership])),
    [memberships],
  );
  const brands = useMemo(() => {
    if (shouldUseContextBrands) {
      const restaurantsByBrandId = new Map();
      authRestaurants.forEach((restaurant) => {
        if (!restaurant.brandId) return;
        const brandRestaurants = restaurantsByBrandId.get(restaurant.brandId) || [];
        brandRestaurants.push(restaurant);
        restaurantsByBrandId.set(restaurant.brandId, brandRestaurants);
      });

      return memberships
        .map((membership) => {
          const brand = membership?.brand || {};
          const brandId = String(brand.id || membership?.brandId || "");
          if (!brandId) return null;
          const brandRestaurants = restaurantsByBrandId.get(brandId) || [];
          return {
            ...brand,
            id: brandId,
            name: brand.name || "Chuỗi chưa đặt tên",
            membership,
            membershipRole: membership?.role || "",
            restaurantIds: membership?.restaurantIds || [],
            restaurants: brandRestaurants,
            restaurantCount: brandRestaurants.length,
          };
        })
        .filter(Boolean);
    }

    return (data?.myBrands || []).map((brand) => {
      const membership = membershipByBrandId.get(String(brand.id)) || null;
      return {
        ...brand,
        membership,
        membershipRole: membership?.role || brand.membershipRole || brand.role || "",
        restaurantIds: membership?.restaurantIds || brand.restaurantIds || [],
      };
    });
  }, [
    authRestaurants,
    data?.myBrands,
    membershipByBrandId,
    memberships,
    shouldUseContextBrands,
  ]);
  const brandScopeLoading = shouldUseContextBrands
    ? restaurantsLoading
    : !shouldSkipQuery && (queryLoading || restaurantsLoading);
  const [selectedBrandId, setSelectedBrandIdState] = useState(() => storageGet("manager.selectedBrandId"));
  const [selectedRestaurantId, setSelectedRestaurantIdState] = useState(() => storageGet("manager.selectedRestaurantId"));

  const setSelectedBrandId = useCallback((value) => {
    const nextValue = String(value || "");
    setSelectedBrandIdState(nextValue);
    storageSet("manager.selectedBrandId", nextValue);
  }, []);

  const setSelectedRestaurantId = useCallback((value) => {
    const nextValue = String(value || "");
    setSelectedRestaurantIdState(nextValue);
    storageSet("manager.selectedRestaurantId", nextValue);
  }, []);

  const brandRestaurantIds = useMemo(() => new Set(brands.flatMap((brand) => (brand.restaurants || []).map(getId)).filter(Boolean)), [brands]);

  const legacyRestaurants = useMemo(() => {
    const seen = new Set();
    return authRestaurants.filter((restaurant) => {
      if (seen.has(restaurant.id)) return false;
      seen.add(restaurant.id);
      return !restaurant.brandId || !brandRestaurantIds.has(restaurant.id);
    });
  }, [authRestaurants, brandRestaurantIds]);

  const selectedBrand = useMemo(() => brands.find((brand) => String(brand.id) === selectedBrandId) || null, [brands, selectedBrandId]);
  const restaurantsInSelectedBrand = useMemo(
    () => getScopedBrandRestaurants(selectedBrand, systemAdmin),
    [selectedBrand, systemAdmin],
  );
  const scopedBrandRestaurants = useMemo(
    () => brands.flatMap((brand) => getScopedBrandRestaurants(brand, systemAdmin)),
    [brands, systemAdmin],
  );

  const allManageableRestaurants = useMemo(() => {
    const seen = new Set();
    return [...scopedBrandRestaurants, ...legacyRestaurants]
      .map(normalizeRestaurant)
      .filter((restaurant) => {
        if (!restaurant.id || seen.has(restaurant.id)) return false;
        seen.add(restaurant.id);
        return true;
      });
  }, [legacyRestaurants, scopedBrandRestaurants]);

  const activeRestaurantOptions = useMemo(
    () => selectedBrandId ? restaurantsInSelectedBrand : legacyRestaurants.length ? legacyRestaurants : allManageableRestaurants,
    [allManageableRestaurants, legacyRestaurants, restaurantsInSelectedBrand, selectedBrandId],
  );

  useEffect(() => {
    if (skip || !userId || brandScopeLoading) return;
    const availableBrandIds = brands.map((brand) => String(brand.id));
    const nextBrandId = availableBrandIds.includes(selectedBrandId)
      ? selectedBrandId
      : availableBrandIds[0] || "";
    if (nextBrandId !== selectedBrandId) setSelectedBrandIdState(nextBrandId);
  }, [brandScopeLoading, brands, selectedBrandId, skip, userId]);

  useEffect(() => storageSet("manager.selectedBrandId", selectedBrandId), [selectedBrandId]);
  useEffect(() => storageSet("manager.selectedRestaurantId", selectedRestaurantId), [selectedRestaurantId]);

  useEffect(() => {
    const syncSelection = (event) => {
      const key = event?.detail?.key;
      const value = event?.detail?.value || "";
      if (key === "manager.selectedBrandId") setSelectedBrandIdState(value);
      if (key === "manager.selectedRestaurantId") setSelectedRestaurantIdState(value);
    };
    if (typeof window === "undefined") return undefined;
    window.addEventListener("manager:scope-selection", syncSelection);
    return () => window.removeEventListener("manager:scope-selection", syncSelection);
  }, []);

  useEffect(() => {
    setSelectedRestaurantIdState((currentId) => {
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
    loading: brandScopeLoading,
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
