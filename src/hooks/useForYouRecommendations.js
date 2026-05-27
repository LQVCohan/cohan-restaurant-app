import { gql, useApolloClient } from "@apollo/client";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useFoodPreferences from "@/hooks/useFoodPreferences";
import {
  analyzeMenuItemForFoodPreferences,
  sortMenuItemsByFoodPreference,
} from "@/utils/foodPreferenceMatcher";

const TOP_MENU_ITEMS_FOR_YOU = gql`
  query TopMenuItemsForYou($restaurantId: ID!, $limit: Int = 12, $timeSlot: TimeSlot) {
    topMenuItems(restaurantId: $restaurantId, limit: $limit, timeSlot: $timeSlot) {
      id
      restaurantId
      menuId
      categoryId
      name
      description
      basePrice
      thumbImage
      status
      inventoryStatus
      stockWarnings
      labels
      dietTags
      allergenTags
      tasteProfile {
        containsOnion
        containsCilantro
        sugar
        spice
      }
      rate
      orderCounter
      servingVariants {
        key
        mode
        sellQty
        sellUnit
        name
        price
      }
    }
  }
`;

export default function useForYouRecommendations({
  limitPerRestaurant = 12,
  maxRestaurants = 5,
  enabled = true,
  timeSlot,
  preferencesOverride = null,
} = {}) {
  const client = useApolloClient();
  const { restaurants, refRestaurant, isAuthenticated } = useContext(AuthContext) || {};
  const shouldLoadPreferences = !preferencesOverride;
  const { preferences: loadedPreferences, loading: prefLoading, error: prefError } = useFoodPreferences({
    skip: !enabled || !isAuthenticated || !shouldLoadPreferences,
  });
  const effectivePreferences = preferencesOverride || loadedPreferences;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const accessibleRestaurants = useMemo(() => {
    const merged = [...(Array.isArray(refRestaurant) ? refRestaurant : []), ...(Array.isArray(restaurants) ? restaurants : [])];
    const seen = new Set();
    return merged
      .filter((restaurant) => {
        const id = restaurant?.id || restaurant?._id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, maxRestaurants);
  }, [maxRestaurants, refRestaurant, restaurants]);

  const fetchRecommendations = useCallback(async () => {
    if (!enabled || !isAuthenticated || accessibleRestaurants.length === 0) {
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        accessibleRestaurants.map(async (restaurant) => {
          const restaurantId = restaurant?.id || restaurant?._id;
          if (!restaurantId) return { restaurant, items: [] };
          const result = await client.query({
            query: TOP_MENU_ITEMS_FOR_YOU,
            variables: {
              restaurantId,
              limit: limitPerRestaurant,
              timeSlot: timeSlot || undefined,
            },
            fetchPolicy: "network-only",
          });
          return { restaurant, items: result?.data?.topMenuItems || [] };
        }),
      );

      const deduped = new Map();
      results.forEach(({ restaurant, items: restaurantItems }) => {
        const restaurantId = restaurant?.id || restaurant?._id;
        restaurantItems.forEach((item) => {
          if (!item?.id || deduped.has(item.id)) return;
          deduped.set(item.id, {
            ...item,
            restaurantId: item?.restaurantId || restaurantId,
            restaurantName: restaurant?.name || "Nhà hàng",
            restaurant,
          });
        });
      });
      setItems(Array.from(deduped.values()));
    } catch (_err) {
      setError("Chưa thể tải gợi ý món. Bạn vẫn có thể chỉnh hồ sơ khẩu vị.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessibleRestaurants, client, enabled, isAuthenticated, limitPerRestaurant, timeSlot]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const scoredItems = useMemo(() => sortMenuItemsByFoodPreference(
    items.map((item) => ({
      ...item,
      foodPreferenceMeta: analyzeMenuItemForFoodPreferences(item, effectivePreferences),
    })),
    effectivePreferences,
  ), [effectivePreferences, items]);

  const recommendedItems = useMemo(
    () => scoredItems.filter((item) => item.foodPreferenceMeta?.isRecommended),
    [scoredItems],
  );
  const warningItems = useMemo(
    () => scoredItems.filter((item) => item.foodPreferenceMeta?.hasAllergyWarning),
    [scoredItems],
  );
  const fallbackItems = useMemo(() => {
    if (recommendedItems.length > 0) return [];
    return [...scoredItems]
      .filter((item) => !item.foodPreferenceMeta?.hasAllergyWarning)
      .sort((a, b) => {
        if (Number(b?.rate || 0) !== Number(a?.rate || 0)) return Number(b?.rate || 0) - Number(a?.rate || 0);
        return Number(b?.orderCounter || 0) - Number(a?.orderCounter || 0);
      });
  }, [recommendedItems.length, scoredItems]);

  const effectivePrefLoading = shouldLoadPreferences ? prefLoading : false;
  const effectivePrefError = shouldLoadPreferences ? prefError : null;

  return {
    loading: loading || effectivePrefLoading,
    error: error || effectivePrefError?.message || "",
    items,
    scoredItems,
    recommendedItems,
    warningItems,
    fallbackItems,
    accessibleRestaurants,
    preferences: effectivePreferences,
    refetch: fetchRecommendations,
  };
}
