import { gql, useMutation, useQuery } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
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
  const defaultCurrency = normalizeCurrency(restaurant?.defaultCurrency, "VND");
  const manualRate = Number(restaurant?.manualUsdToVndRate);
  const safeManualRate =
    Number.isFinite(manualRate) && manualRate > 0
      ? manualRate
      : FALLBACK_USD_TO_VND;

  const [activeCurrency, setActiveCurrency] = useState(defaultCurrency);
  const [usdToVndRate, setUsdToVndRate] = useState(safeManualRate);
  const [rateSource, setRateSource] = useState("fallback");

  useEffect(() => {
    setActiveCurrency(defaultCurrency);
  }, [defaultCurrency, restaurantId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const result = await getUsdToVndRate({
        manualRate: safeManualRate,
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
  }, [restaurantId, safeManualRate]);

  const persistSettings = async (next = {}) => {
    if (!restaurantId) return;
    await updateRestaurant({
      variables: {
        id: restaurantId,
        input: {
          defaultCurrency: next.defaultCurrency
            ? normalizeCurrency(next.defaultCurrency, "VND")
            : defaultCurrency,
          manualUsdToVndRate:
            Number(next.manualUsdToVndRate) > 0
              ? Number(next.manualUsdToVndRate)
              : safeManualRate,
        },
      },
    });
    await refetch?.();
  };

  return useMemo(
    () => ({
      loading,
      error,
      defaultCurrency,
      activeCurrency,
      setActiveCurrency,
      usdToVndRate,
      rateSource,
      manualUsdToVndRate: safeManualRate,
      persistSettings,
      refetch,
    }),
    [
      loading,
      error,
      defaultCurrency,
      activeCurrency,
      usdToVndRate,
      rateSource,
      safeManualRate,
      refetch,
    ],
  );
}
