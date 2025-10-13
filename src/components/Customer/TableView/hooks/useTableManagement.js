import { useState, useEffect, useCallback } from "react";
import { INITIAL_TABLE_DATA } from "../../../../utils/constants";

export const useTableManagement = (
  restaurantId,
  selectedDate,
  selectedTimeSlot
) => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableFilters, setTableFilters] = useState({
    area: "",
    features: [],
    capacity: "",
    priceRange: { min: "", max: "" },
  });

  // Load tables data
  const loadTables = useCallback(async () => {
    if (!restaurantId) return;

    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      const restaurantTables = INITIAL_TABLE_DATA.filter(
        (table) => table.restaurantId === restaurantId
      );

      setTables(restaurantTables);
    } catch (error) {
      console.error("Error loading tables:", error);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Filter tables based on current filters
  const filteredTables = tables.filter((table) => {
    // Area filter
    if (tableFilters.area && table.area !== tableFilters.area) {
      return false;
    }

    // Capacity filter
    if (
      tableFilters.capacity &&
      table.capacity < parseInt(tableFilters.capacity)
    ) {
      return false;
    }

    // Features filter
    if (tableFilters.features && tableFilters.features.length > 0) {
      const hasAllFeatures = tableFilters.features.every(
        (feature) => table.features && table.features.includes(feature)
      );
      if (!hasAllFeatures) {
        return false;
      }
    }

    // Price range filter
    if (table.reservationFee) {
      const { min, max } = tableFilters.priceRange;
      if (min && table.reservationFee < parseInt(min)) {
        return false;
      }
      if (max && table.reservationFee > parseInt(max)) {
        return false;
      }
    }

    return true;
  });

  // Get table availability for specific date and time
  const getTableAvailability = useCallback(
    (tableId, date, timeSlot) => {
      const table = tables.find((t) => t.id === tableId);
      if (!table || !date || !timeSlot) {
        return { isAvailable: false, status: "unknown" };
      }

      // Simulate checking reservations and availability
      const dayOfWeek = new Date(date).getDay();
      const hour = parseInt(timeSlot.split(":")[0]);

      // Mock logic for demonstration
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPeakHour =
        (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 20);

      // Random availability simulation
      const randomFactor = Math.random();
      let availability = {
        isAvailable: true,
        status: "available",
        nextAvailable: null,
        alternativeTimes: [],
      };

      // Higher chance of being occupied during peak hours and weekends
      if (isPeakHour && isWeekend && randomFactor < 0.4) {
        availability = {
          isAvailable: false,
          status: "occupied",
          nextAvailable: `${hour + 2}:00`,
          alternativeTimes: [
            `${hour + 1}:30`,
            `${hour + 2}:00`,
            `${hour + 2}:30`,
          ],
        };
      } else if (isPeakHour && randomFactor < 0.2) {
        availability = {
          isAvailable: false,
          status: "reserved",
          nextAvailable: `${hour + 1}:30`,
          alternativeTimes: [
            `${hour + 1}:00`,
            `${hour + 1}:30`,
            `${hour + 3}:00`,
          ],
        };
      } else if (randomFactor < 0.05) {
        availability = {
          isAvailable: false,
          status: "maintenance",
          nextAvailable: "Ngày mai",
          alternativeTimes: [],
        };
      }

      return availability;
    },
    [tables]
  );

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setTableFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  // Refresh tables data
  const refreshTables = useCallback(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  return {
    tables,
    filteredTables,
    loading,
    tableFilters,
    updateFilters,
    getTableAvailability,
    refreshTables,
  };
};
