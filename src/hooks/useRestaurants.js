import { useState, useMemo } from "react";
import { restaurantsData } from "../data/restaurantsData";

export const useRestaurants = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("relevance");
  const [favorites, setFavorites] = useState(new Set());
  const [filters, setFilters] = useState({
    districts: [],
    cuisines: [],
    ratings: [],
    priceRanges: [], // Thêm filter mức giá
  });

  const itemsPerPage = 6;

  // Filter và search logic
  const filteredRestaurants = useMemo(() => {
    let filtered = restaurantsData.filter((restaurant) => {
      // Search filter
      if (searchTerm.trim() !== "") {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          restaurant.name.toLowerCase().includes(searchLower) ||
          restaurant.cuisine.toLowerCase().includes(searchLower) ||
          restaurant.description.toLowerCase().includes(searchLower) ||
          restaurant.district.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // District filter
      if (
        filters.districts.length > 0 &&
        !filters.districts.includes(restaurant.district)
      ) {
        return false;
      }

      // Cuisine filter
      if (
        filters.cuisines.length > 0 &&
        !filters.cuisines.includes(restaurant.cuisine)
      ) {
        return false;
      }

      // Rating filter
      if (filters.ratings.length > 0) {
        const matchesRating = filters.ratings.some((rating) => {
          if (rating === "5") return restaurant.rating >= 4.9;
          if (rating === "4") return restaurant.rating >= 4.0;
          if (rating === "3") return restaurant.rating >= 3.0;
          return false;
        });
        if (!matchesRating) return false;
      }

      // Price range filter
      if (filters.priceRanges.length > 0) {
        const priceMatch = filters.priceRanges.some((range) => {
          const maxPrice = parseInt(restaurant.priceRange.split(" - ")[1]);
          if (range === "under-100k") return maxPrice < 100;
          if (range === "100k-300k") return maxPrice >= 100 && maxPrice <= 300;
          if (range === "over-300k") return maxPrice > 300;
          return false;
        });
        if (!priceMatch) return false;
      }

      return true;
    });

    // Sort logic (giữ nguyên như cũ)
    switch (sortBy) {
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case "price-low":
        filtered.sort((a, b) => {
          const aPrice = parseInt(a.priceRange.split("k")[0]);
          const bPrice = parseInt(b.priceRange.split("k")[0]);
          return aPrice - bPrice;
        });
        break;
      case "distance":
        filtered.sort((a, b) => {
          const aDistance = parseFloat(a.distance);
          const bDistance = parseFloat(b.distance);
          return aDistance - bDistance;
        });
        break;
      default:
        break;
    }

    return filtered;
  }, [searchTerm, filters, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredRestaurants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRestaurants = filteredRestaurants.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Event handlers
  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter((item) => item !== value)
        : [...prev[filterType], value],
    }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      districts: [],
      cuisines: [],
      ratings: [],
      priceRanges: [],
    });
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleToggleFavorite = (event, restaurantId) => {
    event.stopPropagation();
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(restaurantId)) {
        newFavorites.delete(restaurantId);
      } else {
        newFavorites.add(restaurantId);
      }
      return newFavorites;
    });
  };

  return {
    // State
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    sortBy,
    setSortBy,
    favorites,
    filters,

    // Computed
    filteredRestaurants,
    currentRestaurants,
    totalPages,

    // Handlers
    handleFilterChange,
    handleClearFilters,
    handleToggleFavorite,
  };
};
