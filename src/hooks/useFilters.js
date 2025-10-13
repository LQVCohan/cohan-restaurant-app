import { useState, useMemo } from "react";

export const useFilters = (menuItems, currentRestaurant, currentTimeSlot) => {
  const [currentCategory, setCurrentCategory] = useState("");
  const [currentView, setCurrentView] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const setPriceRange = ({ minPrice: min, maxPrice: max }) => {
    setMinPrice(min);
    setMaxPrice(max);
  };

  // Trả về mảng đã lọc trực tiếp thay vì function
  const filteredItems = useMemo(() => {
    if (!menuItems || !currentRestaurant) return [];

    let filtered = menuItems.filter(
      (item) =>
        item.restaurantId == currentRestaurant &&
        item.timeSlot === currentTimeSlot
    );

    // Filter by category
    if (currentCategory) {
      filtered = filtered.filter((item) => item.category === currentCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.category.toLowerCase().includes(searchLower) ||
          item.methods.some((method) =>
            method.name.toLowerCase().includes(searchLower)
          )
      );
    }

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      filtered = filtered.filter((item) => {
        const prices = item.methods.map((method) => method.price);
        const itemMinPrice = Math.min(...prices);
        const itemMaxPrice = Math.max(...prices);

        let matchesMin = true;
        let matchesMax = true;

        if (minPrice) {
          matchesMin = itemMaxPrice >= parseFloat(minPrice);
        }

        if (maxPrice) {
          matchesMax = itemMinPrice <= parseFloat(maxPrice);
        }

        return matchesMin && matchesMax;
      });
    }

    return filtered;
  }, [
    menuItems,
    currentRestaurant,
    currentTimeSlot,
    currentCategory,
    searchTerm,
    statusFilter,
    minPrice,
    maxPrice,
  ]);

  return {
    currentCategory,
    currentView,
    searchTerm,
    statusFilter,
    minPrice,
    maxPrice,
    setCurrentCategory,
    setCurrentView,
    setSearchTerm,
    setStatusFilter,
    setPriceRange,
    filteredItems, // Trả về mảng thay vì function
  };
};
