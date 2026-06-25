// src/hooks/useRestaurants.js
import { useState, useMemo } from "react";

export const useRestaurants = (source = [], { itemsPerPage = 12 } = {}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("relevance");
  const [favorites, setFavorites] = useState(new Set());
  const [filters, setFilters] = useState({
    districts: [],
    cuisines: [],
    ratings: [],
    priceRanges: [],
  });

  const filteredRestaurants = useMemo(() => {
    let filtered = source.filter((restaurant) => {
      // Search
      if (searchTerm.trim() !== "") {
        const s = searchTerm.toLowerCase();
        const fields = [
          restaurant.name,
          restaurant.cuisine,
          restaurant.description,
          restaurant.district,
        ]
          .filter(Boolean)
          .map((x) => x.toLowerCase());
        const matchesSearch = fields.some((f) => f.includes(s));
        if (!matchesSearch) return false;
      }
      // District
      if (
        filters.districts.length > 0 &&
        !filters.districts.includes(restaurant.district)
      ) {
        return false;
      }
      // Cuisine
      if (
        filters.cuisines.length > 0 &&
        !filters.cuisines.includes(restaurant.cuisine)
      ) {
        return false;
      }
      // Ratings
      if (filters.ratings.length > 0) {
        const ok = filters.ratings.some((r) => {
          if (r === "5")
            return (restaurant.avgRating ?? restaurant.rating ?? 0) >= 4.9;
          if (r === "4")
            return (restaurant.avgRating ?? restaurant.rating ?? 0) >= 4.0;
          if (r === "3")
            return (restaurant.avgRating ?? restaurant.rating ?? 0) >= 3.0;
          return false;
        });
        if (!ok) return false;
      }
      // Price ranges (tuỳ theo format giá của bạn)
      if (filters.priceRanges.length > 0 && restaurant.priceRange) {
        const [minStr, maxStr] = restaurant.priceRange
          .replace(/[^\d\-\s]/g, "")
          .split("-")
          .map((t) => t.trim());
        const min = Number((minStr || "0").replace(/\./g, ""));
        const max = Number((maxStr || "0").replace(/\./g, ""));
        const match = filters.priceRanges.some((range) => {
          if (range === "under-100k") return max < 100_000;
          if (range === "100k-300k") return min >= 100_000 && max <= 300_000;
          if (range === "over-300k") return min > 300_000;
          return false;
        });
        if (!match) return false;
      }
      return true;
    });

    const compareRecentRank = (a, b) => {
      const ar = Number.isFinite(Number(a.recentRank))
        ? Number(a.recentRank)
        : Number.POSITIVE_INFINITY;
      const br = Number.isFinite(Number(b.recentRank))
        ? Number(b.recentRank)
        : Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      return 0;
    };

    // Sort
    switch (sortBy) {
      case "rating":
        filtered.sort(
          (a, b) =>
            compareRecentRank(a, b) ||
            (b.avgRating ?? b.rating ?? 0) - (a.avgRating ?? a.rating ?? 0)
        );
        break;
      case "price-low": {
        const toMin = (pr) => {
          if (!pr) return Number.POSITIVE_INFINITY;
          const [minStr] = pr
            .replace(/[^\d\-\s]/g, "")
            .split("-")
            .map((t) => t.trim());
          return Number((minStr || "0").replace(/\./g, ""));
        };
        filtered.sort((a, b) => compareRecentRank(a, b) || toMin(a.priceRange) - toMin(b.priceRange));
        break;
      }
      case "distance":
        filtered.sort(
          (a, b) =>
            compareRecentRank(a, b) ||
            (parseFloat(a.distance) || 0) - (parseFloat(b.distance) || 0)
        );
        break;
      default:
        filtered.sort(compareRecentRank);
        break;
    }
    return filtered;
  }, [source, searchTerm, filters, sortBy]);

  const totalPages = Math.ceil(filteredRestaurants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRestaurants = filteredRestaurants.slice(
    startIndex,
    startIndex + itemsPerPage
  );

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
    setFilters({ districts: [], cuisines: [], ratings: [], priceRanges: [] });
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleToggleFavorite = (event, restaurantId) => {
    event?.stopPropagation?.();
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(restaurantId)
        ? next.delete(restaurantId)
        : next.add(restaurantId);
      return next;
    });
  };

  return {
    // state
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    sortBy,
    setSortBy,
    favorites,
    filters,
    // computed
    filteredRestaurants,
    currentRestaurants,
    totalPages,
    // handlers
    handleFilterChange,
    handleClearFilters,
    handleToggleFavorite,
  };
};
