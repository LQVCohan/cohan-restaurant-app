import { useState, useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { INITIAL_DATA } from "../utils/constants";

export const useMenuData = () => {
  const [restaurants, setRestaurants] = useLocalStorage(
    "restaurants",
    INITIAL_DATA.restaurants
  );
  const [categories, setCategories] = useLocalStorage(
    "categories",
    INITIAL_DATA.categories
  );
  const [menuItems, setMenuItems] = useLocalStorage(
    "menuItems",
    INITIAL_DATA.menuItems
  );
  const [promotions, setPromotions] = useLocalStorage("promotions", []);

  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [currentTimeSlot, setCurrentTimeSlot] = useState("breakfast");

  // Initialize current restaurant
  useEffect(() => {
    if (restaurants.length > 0 && !currentRestaurant) {
      setCurrentRestaurant(restaurants[0].id.toString());
    }
  }, [restaurants, currentRestaurant]);

  // Menu item operations
  const addMenuItem = (itemData) => {
    const newId = Math.max(...menuItems.map((item) => item.id), 0) + 1;
    setMenuItems((prev) => [...prev, { id: newId, ...itemData }]);
  };

  const updateMenuItem = (id, updates) => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const deleteMenuItem = (id) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Category operations
  const addCategory = (categoryData) => {
    const newId = Math.max(...categories.map((c) => c.id), 0) + 1;
    setCategories((prev) => [...prev, { id: newId, ...categoryData }]);
  };

  // Promotion operations
  const addPromotion = (promotionData) => {
    const newId = Date.now();
    setPromotions((prev) => [
      ...prev,
      {
        id: newId,
        ...promotionData,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  return {
    restaurants,
    categories,
    menuItems,
    promotions,
    currentRestaurant,
    currentTimeSlot,
    setCurrentRestaurant,
    setCurrentTimeSlot,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addCategory,
    addPromotion,
  };
};
