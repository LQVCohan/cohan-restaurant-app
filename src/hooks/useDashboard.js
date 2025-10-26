import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
export const useDashboard = () => {
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    revenue: "₫24.8M",
    orders: 156,
    customers: 89,
    rating: 4.8,
  });

  const statsData = {
    all: { revenue: "₫24.8M", orders: 156, customers: 89, rating: 4.8 },
    "hcm-center": { revenue: "₫8.2M", orders: 52, customers: 28, rating: 4.9 },
    "hcm-district7": {
      revenue: "₫6.1M",
      orders: 38,
      customers: 21,
      rating: 4.7,
    },
    "hcm-thuduc": { revenue: "₫4.8M", orders: 31, customers: 18, rating: 4.8 },
    "hanoi-center": {
      revenue: "₫3.2M",
      orders: 22,
      customers: 15,
      rating: 4.6,
    },
    "hanoi-caugiay": {
      revenue: "₫2.1M",
      orders: 13,
      customers: 7,
      rating: 4.9,
    },
    "danang-center": { revenue: "₫0.4M", orders: 0, customers: 0, rating: 5.0 },
  };

  const updateStats = useCallback((restaurantId) => {
    const newStats = statsData[restaurantId] || statsData["all"];
    setStats(newStats);
  }, []);

  const handleRestaurantChange = useCallback(
    (restaurantId) => {
      setSelectedRestaurant(restaurantId);
      updateStats(restaurantId);
    },
    [updateStats]
  );

  const handleSwitchToPOS = () => {
    navigate("/manager/dashboard/POS");
  };

  const handleGenerateReport = useCallback(() => {
    alert("📈 Đang tạo báo cáo tổng hợp...\n(Tính năng demo)");
  }, []);

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      updateStats(selectedRestaurant);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedRestaurant, updateStats]);

  return {
    selectedRestaurant,
    stats,
    handleRestaurantChange,
    handleSwitchToPOS,
    handleGenerateReport,
  };
};
