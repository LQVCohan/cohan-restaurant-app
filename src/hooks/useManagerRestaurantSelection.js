import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";

export const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

const normalizeRestaurantOption = (restaurant) => {
  const id = getRestaurantId(restaurant);
  return {
    ...restaurant,
    id,
    name: restaurant?.name || "Nhà hàng chưa đặt tên",
  };
};

const EMPTY_RESTAURANTS = [];

const useManagerRestaurantSelection = (additionalRestaurants = EMPTY_RESTAURANTS) => {
  const { restaurants = [], restaurantsLoading = false } = useContext(AuthContext) || {};
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const restaurantOptions = useMemo(() => {
    const seen = new Set();
    return [...(restaurants || []), ...(additionalRestaurants || [])]
      .map(normalizeRestaurantOption)
      .filter((restaurant) => {
        if (!restaurant.id || seen.has(restaurant.id)) return false;
        seen.add(restaurant.id);
        return true;
      });
  }, [additionalRestaurants, restaurants]);

  useEffect(() => {
    setSelectedRestaurantId((currentId) => {
      if (!restaurantOptions.length) return "";
      if (currentId && restaurantOptions.some((restaurant) => restaurant.id === currentId)) {
        return currentId;
      }
      return restaurantOptions[0].id;
    });
  }, [restaurantOptions]);

  const selectedRestaurant = useMemo(
    () => restaurantOptions.find((restaurant) => restaurant.id === selectedRestaurantId) || null,
    [restaurantOptions, selectedRestaurantId],
  );

  return {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    selectedRestaurant,
    restaurantsLoading,
    hasRestaurants: restaurantOptions.length > 0,
  };
};

export default useManagerRestaurantSelection;
