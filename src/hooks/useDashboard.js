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
  const graphQLError = error?.graphQLErrors?.[0];
  if (graphQLError?.message === "FORBIDDEN_SCOPE") {
    return "Tài khoản không có quyền xem chi nhánh đã chọn. Hãy chọn lại chi nhánh được phân công.";
  }
  if (error?.networkError) {
    return "Không thể kết nối tới máy chủ. Vui lòng kiểm tra backend và thử lại.";
  }
  return "Dữ liệu tổng quan chưa sẵn sàng. Vui lòng thử lại.";
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
  const hasConfirmedRestaurantScope = Boolean(
    !restaurantsLoading &&
      selectedRestaurantId &&
      selectedRestaurant &&
      String(selectedRestaurant.id) === String(selectedRestaurantId),
  );

  const { data, loading, error, refetch } = useQuery(GET_MANAGER_DASHBOARD, {
    skip: !hasConfirmedRestaurantScope,
    variables: { restaurantId: selectedRestaurantId, range },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    pollInterval:
      hasConfirmedRestaurantScope && process.env.NODE_ENV !== "test" ? 30000 : 0,
  });

  useEffect(() => {
    emitDashboardRestaurantChanged(
      hasConfirmedRestaurantScope ? selectedRestaurantId : "",
    );
  }, [hasConfirmedRestaurantScope, selectedRestaurantId]);

  const rawDashboard = data?.managerDashboard;
  const hasStaleDashboard = Boolean(
    rawDashboard &&
      String(rawDashboard.restaurantId ?? "") !== selectedRestaurantId,
  );
  const dashboard = hasStaleDashboard ? null : rawDashboard;
  const dashboardLoading =
    restaurantsLoading ||
    (Boolean(selectedRestaurantId) && !hasConfirmedRestaurantScope) ||
    loading ||
    hasStaleDashboard;
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
    if (
      !hasConfirmedRestaurantScope ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

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
  }, [hasConfirmedRestaurantScope, range, refetch, selectedRestaurantId]);

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
    [restaurantOptions, setSelectedRestaurantId],
  );

  const handleSwitchToPOS = useCallback(() => {
    const query = selectedRestaurantId
      ? `?restaurantId=${encodeURIComponent(selectedRestaurantId)}`
      : "";
    navigate(`/manager/dashboard/POS${query}`);
  }, [navigate, selectedRestaurantId]);

  const handleGenerateReport = useCallback(() => {
    if (hasConfirmedRestaurantScope) {
      refetch({ restaurantId: selectedRestaurantId, range });
    }
  }, [hasConfirmedRestaurantScope, refetch, selectedRestaurantId, range]);

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
    pendingOrderCount: Number(dashboard?.pendingOrderCount || 0),
    pendingReservationCount: Number(dashboard?.pendingReservationCount || 0),
    pendingSupportRequestCount: Number(dashboard?.pendingSupportRequestCount || 0),
    handleRestaurantChange,
    handleSwitchToPOS,
    handleGenerateReport,
    refetchDashboard: refetch,
  };
};
