import { gql, useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FALLBACK_USD_TO_VND,
  getUsdToVndRate,
  normalizeCurrency,
} from "@/utils/currency";

export const RESTAURANT_CURRENCY_QUERY = gql`
  query RestaurantCurrencySettings($id: ID!) {
    restaurant(id: $id) {
      id
      defaultCurrency
      manualUsdToVndRate
    }
  }
`;

export const UPDATE_RESTAURANT_CURRENCY_MUTATION = gql`
  mutation UpdateRestaurantCurrency($id: ID!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      id
      defaultCurrency
      manualUsdToVndRate
    }
  }
`;

export function useRestaurantCurrency(restaurantId) {
  const { data, loading, error, refetch } = useQuery(RESTAURANT_CURRENCY_QUERY, {
    variables: { id: restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [updateRestaurant] = useMutation(UPDATE_RESTAURANT_CURRENCY_MUTATION);

  const restaurant = data?.restaurant || null;
  const defaultCurrency = normalizeCurrency(
    restaurant?.defaultCurrency,
    "VND",
  );
  const manualRate = Number(restaurant?.manualUsdToVndRate);
  const hasManualRate = Number.isFinite(manualRate) && manualRate > 0;
  const displayedManualRate = hasManualRate ? manualRate : FALLBACK_USD_TO_VND;

  const [activeCurrency, setActiveCurrency] = useState(defaultCurrency);
  const [usdToVndRate, setUsdToVndRate] = useState(displayedManualRate);
  const [rateSource, setRateSource] = useState("fallback");

  useEffect(() => {
    setActiveCurrency(defaultCurrency);
  }, [defaultCurrency, restaurantId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const result = await getUsdToVndRate({
        manualRate: hasManualRate ? manualRate : undefined,
        timeoutMs: 1000,
      });
      if (cancelled) return;
      setUsdToVndRate(result.rate);
      setRateSource(result.source);
    };
    if (restaurantId) run();
    return () => {
      cancelled = true;
    };
  }, [hasManualRate, manualRate, restaurantId]);

  const persistSettings = useCallback(
    async (next = {}) => {
      if (!restaurantId) return null;

      const input = {};
      if (Object.prototype.hasOwnProperty.call(next, "defaultCurrency")) {
        input.defaultCurrency = normalizeCurrency(next.defaultCurrency, "VND");
      }
      if (Object.prototype.hasOwnProperty.call(next, "manualUsdToVndRate")) {
        const nextRate = Number(next.manualUsdToVndRate);
        if (!Number.isFinite(nextRate) || nextRate <= 0) {
          throw new Error("Tỷ giá USD sang VND phải lớn hơn 0.");
        }
        input.manualUsdToVndRate = nextRate;
      }
      if (Object.keys(input).length === 0) return null;

      const result = await updateRestaurant({
        variables: { id: restaurantId, input },
      });
      await refetch?.();
      return result.data?.updateRestaurant || null;
    },
    [refetch, restaurantId, updateRestaurant],
  );

  return useMemo(
    () => ({
      loading,
      error,
      defaultCurrency,
      activeCurrency,
      setActiveCurrency,
      usdToVndRate,
      rateSource,
      manualUsdToVndRate: hasManualRate ? manualRate : null,
      displayedUsdToVndRate: displayedManualRate,
      persistSettings,
      refetch,
    }),
    [
      activeCurrency,
      defaultCurrency,
      displayedManualRate,
      error,
      hasManualRate,
      loading,
      manualRate,
      persistSettings,
      rateSource,
      refetch,
      usdToVndRate,
    ],
  );
}
