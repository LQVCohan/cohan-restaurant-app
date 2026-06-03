import { useCallback, useContext, useEffect, useMemo, useState } from "react";
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
      pendingOrderCount
      pendingReservationCount
      pendingSupportRequestCount
      pendingOrders {
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
      pendingReservations {
        id
        orderCode
        customerName
        customerPhone
        tableCode
        partySize
        timeTo
        status
        depositStatus
        depositAmount
        note
        createdAt
      }
      pendingSupportRequests {
        orderId
        orderCode
        trackingCode
        tableCode
        requestId
        type
        status
        message
        createdAt
        acknowledgedAt
        resolvedAt
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
    notifyOnNetworkStatusChange: true,
    pollInterval: selectedRestaurantId && process.env.NODE_ENV !== "test" ? 30000 : 0,
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

  useEffect(() => {
    if (!selectedRestaurantId || typeof window === "undefined") return undefined;
    const handleFocus = () => refetch({ restaurantId: selectedRestaurantId, range });
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetch, selectedRestaurantId, range]);

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
    pendingOrders: dashboard?.pendingOrders || [],
    pendingReservations: dashboard?.pendingReservations || [],
    pendingSupportRequests: dashboard?.pendingSupportRequests || [],
    pendingOrderCount: dashboard?.pendingOrderCount || 0,
    pendingReservationCount: dashboard?.pendingReservationCount || 0,
    pendingSupportRequestCount: dashboard?.pendingSupportRequestCount || 0,
    refetchDashboard: () => refetch({ restaurantId: selectedRestaurantId, range }),
    handleRestaurantChange,
    handleSwitchToPOS,
    handleGenerateReport,
  };
};
