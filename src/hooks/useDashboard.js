import { useCallback, useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const GET_MANAGER_DASHBOARD = gql`
  query GetManagerDashboard($restaurantId: ID!, $range: String) {
    managerDashboard(restaurantId: $restaurantId, range: $range) {
      restaurantId
      revenue
      orders
      customers
      tables
      menuItems
      activePromotions
      workingStaff
      statusCounts {
        pending
        preparing
        completed
        cancelled
      }
      revenueTrend {
        key
        current
        previous
      }
      orderTrend {
        key
        current
        previous
      }
      topDishes {
        dishName
        quantity
        revenue
      }
      recentOrders {
        id
        orderCode
        customerName
        orderType
        tableCode
        status
        total
        createdAt
        itemNames
      }
      lowStockItems {
        id
        name
        onHand
        reserved
      }
    }
  }
`;

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const useDashboard = () => {
  const navigate = useNavigate();
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(
    restaurants?.[0]?.id || ""
  );
  const [range, setRange] = useState("week");

  const { data, loading, error, refetch } = useQuery(GET_MANAGER_DASHBOARD, {
    skip: !selectedRestaurantId,
    variables: { restaurantId: selectedRestaurantId, range },
    fetchPolicy: "network-only",
  });

  const dashboard = data?.managerDashboard;

  const stats = useMemo(() => {
    return {
      revenue: formatMoney(dashboard?.revenue || 0),
      orders: dashboard?.orders || 0,
      customers: dashboard?.customers || 0,
      tables: dashboard?.tables || 0,
      menuItems: dashboard?.menuItems || 0,
      promotions: dashboard?.activePromotions || 0,
      staff: dashboard?.workingStaff || 0,
      statusCounts: dashboard?.statusCounts || {
        pending: 0,
        preparing: 0,
        completed: 0,
        cancelled: 0,
      },
    };
  }, [dashboard]);

  const selectedRestaurant = useMemo(
    () => restaurants.find((x) => x.id === selectedRestaurantId) || null,
    [restaurants, selectedRestaurantId]
  );

  const handleRestaurantChange = useCallback((restaurantId) => {
    setSelectedRestaurantId(restaurantId);
  }, []);

  const handleSwitchToPOS = useCallback(() => {
    navigate("/manager/dashboard/POS");
  }, [navigate]);

  const handleGenerateReport = useCallback(() => {
    if (selectedRestaurantId) {
      refetch({ restaurantId: selectedRestaurantId, range });
    }
  }, [refetch, selectedRestaurantId, range]);

  return {
    selectedRestaurant,
    restaurants,
    selectedRestaurantId,
    stats,
    loading,
    error,
    range,
    setRange,
    revenueTrend: dashboard?.revenueTrend || [],
    orderTrend: dashboard?.orderTrend || [],
    topDishes: dashboard?.topDishes || [],
    recentOrders: dashboard?.recentOrders || [],
    lowStockItems: dashboard?.lowStockItems || [],
    handleRestaurantChange,
    handleSwitchToPOS,
    handleGenerateReport,
  };
};
