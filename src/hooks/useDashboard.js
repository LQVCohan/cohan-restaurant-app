import { useCallback, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import useManagerRestaurantSelection from "./useManagerRestaurantSelection";
import {
  STAFF_DATA_CHANGED_EVENT,
  emitDashboardRestaurantChanged,
  isSameRestaurantEvent,
} from "../utils/staffSyncEvents";

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

const getDashboardErrorMessage = (error) => {
  if (!error) return "";
  if (error?.networkError) {
    return "Không thể kết nối tới máy chủ. Vui lòng kiểm tra backend và thử lại.";
  }
  return "Dữ liệu tổng quan chưa sẵn sàng. Vui lòng khởi động lại backend và thử lại.";
};

export const useDashboard = () => {
  const navigate = useNavigate();
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    selectedRestaurant,
    restaurantsLoading,
  } = useManagerRestaurantSelection();
  const [range, setRange] = useState("week");


  const { data, loading, error, refetch } = useQuery(GET_MANAGER_DASHBOARD, {
    skip: !selectedRestaurantId,
    variables: { restaurantId: selectedRestaurantId, range },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    pollInterval:
      selectedRestaurantId && process.env.NODE_ENV !== "test" ? 30000 : 0,
  });

  useEffect(() => {
    if (restaurantsLoading) return;

    setSelectedRestaurantId((currentId) => {
      if (restaurantOptions.length === 0) return "";

      const normalizedCurrentId = String(currentId || "");
      const hasCurrentRestaurant = restaurantOptions.some(
        (restaurant) => restaurant.id === normalizedCurrentId,
      );

      if (normalizedCurrentId && hasCurrentRestaurant) {
        return normalizedCurrentId;
      }

      return restaurantOptions[0].id;
    });
  }, [restaurantOptions, restaurantsLoading, setSelectedRestaurantId]);

  useEffect(() => {
    emitDashboardRestaurantChanged(selectedRestaurantId);
  }, [selectedRestaurantId]);

  const rawDashboard = data?.managerDashboard;
  const hasStaleDashboard = Boolean(
    rawDashboard &&
      String(rawDashboard.restaurantId ?? "") !== selectedRestaurantId,
  );
  const dashboard = hasStaleDashboard ? null : rawDashboard;
  const dashboardLoading = loading || hasStaleDashboard;
  const dashboardError = useMemo(
    () => (error ? new Error(getDashboardErrorMessage(error)) : null),
    [error],
  );

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


  useEffect(() => {
    if (!selectedRestaurantId || typeof window === "undefined") return undefined;

    const refreshCurrentDashboard = () =>
      refetch({ restaurantId: selectedRestaurantId, range });

    const handleFocus = () => {
      void refreshCurrentDashboard();
    };
    const handleStaffDataChanged = (event) => {
      if (!isSameRestaurantEvent(event, selectedRestaurantId)) return;
      void refreshCurrentDashboard();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(STAFF_DATA_CHANGED_EVENT, handleStaffDataChanged);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(STAFF_DATA_CHANGED_EVENT, handleStaffDataChanged);
    };
  }, [range, refetch, selectedRestaurantId]);

  const handleRestaurantChange = useCallback(
    (restaurantId) => {
      const nextRestaurantId = String(restaurantId ?? "");
      if (
        restaurantOptions.some(
          (restaurant) => restaurant.id === nextRestaurantId,
        )
      ) {
        setSelectedRestaurantId(nextRestaurantId);
      }
    },
    [restaurantOptions],
  );

  const handleSwitchToPOS = useCallback(() => {
    const query = selectedRestaurantId
      ? `?restaurantId=${encodeURIComponent(selectedRestaurantId)}`
      : "";
    navigate(`/manager/dashboard/POS${query}`);
  }, [navigate, selectedRestaurantId]);

  const handleGenerateReport = useCallback(() => {
    if (selectedRestaurantId) {
      refetch({ restaurantId: selectedRestaurantId, range });
    }
  }, [refetch, selectedRestaurantId, range]);

  return {
    selectedRestaurant,
    restaurants: restaurantOptions,
    selectedRestaurantId,
    stats,
    loading: dashboardLoading,
    restaurantsLoading,
    error: dashboardError,
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
    refetchDashboard: () => {
      if (!selectedRestaurantId) return Promise.resolve(null);
      return refetch({ restaurantId: selectedRestaurantId, range });
    },
    handleRestaurantChange,
    handleSwitchToPOS,
    handleGenerateReport,
  };
};

export { GET_MANAGER_DASHBOARD, getDashboardErrorMessage };
