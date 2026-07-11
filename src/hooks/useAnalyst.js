import { useCallback, useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";
import useManagerRestaurantSelection, {
  getRestaurantId,
} from "./useManagerRestaurantSelection";
import { hasAnyPermission } from "../utils/frontendPermissionAccess";

const GET_ANALYST_DASHBOARD = gql`
  query GetAnalystDashboard(
    $restaurantId: ID!
    $range: String
    $includeStaffScheduling: Boolean!
  ) {
    managerDashboard(restaurantId: $restaurantId, range: $range) {
      restaurantId
      revenue
      orders
      customers
      statusCounts {
        pending
        preparing
        completed
        cancelled
      }
      feedbackSummary {
        avgRating
        total
        negative
        positive
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
      feedbackItems {
        id
        customerName
        rating
        content
        createdAt
        sentiment
      }
      occupancyHeatmap {
        dayLabel
        hourLabel
        occupancyRate
        staffRequired
      }
      staffPerformance {
        staffId
        fullName
        role
        status
        ordersHandled
        efficiency
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
    staffSchedulingAssistant(
      restaurantId: $restaurantId
      horizonDays: 2
    ) @include(if: $includeStaffScheduling) {
      summary {
        totalShiftGroups
        underStaffedShifts
        overStaffedShifts
        highestRiskShift
        notes
      }
      shifts {
        shiftKey
        date
        shiftType
        demandLevel
        expectedOrders
        expectedGuests
        recommendedTotalStaff
        currentAssignedStaff
        deltaStaff
        status
        severity
        confidence
        recommendedRoles {
          role
          required
          assigned
          delta
        }
        suggestedCandidates {
          staffId
          fullName
          role
          reason
        }
      }
      meta {
        method
        basedOnForecast
        fallbackUsed
        generatedAt
        timezone
      }
    }

    demandForecast(restaurantId: $restaurantId, horizonDays: 2) {
      summary {
        busiestPeriods
        topRisingDishes
        totalRecommendedPrep
        notes
      }
      hourlyForecast {
        slot
        date
        hourLabel
        expectedOrders
        expectedGuests
        demandScore
        suggestedStaff
        confidence
      }
      dailyForecast {
        date
        expectedOrders
        expectedGuests
        peakWindow
        confidence
      }
      risingDishes {
        dishId
        dishName
        baselineQty
        forecastQty
        upliftPct
        suggestedPrepQty
        confidence
        stockRisk
        inventoryNote
      }
      prepPlan {
        dishId
        dishName
        suggestedPrepQty
        reason
        inventoryNote
      }
      meta {
        method
        fallbackUsed
        forecastFallbackUsed
        lowDataFallbackUsed
        aiEnhanced
        generatedAt
        granularity
        timezone
        sampleOrders
        sampleDays
      }
    }

    menuEngineeringAssistant(restaurantId: $restaurantId, lookbackDays: 30) {
      summary {
        totalDishes
        starCount
        plowhorseCount
        puzzleCount
        dogCount
        avgMarginPct
        notes
      }
      dishes {
        dishId
        dishName
        quantity
        revenue
        estimatedCost
        profit
        marginPct
        popularityScore
        marginScore
        contributionMargin
        quadrant
        recommendation
      }
      recommendations
      meta {
        method
        fallbackUsed
        fallbackMarginRate
        generatedAt
        timezone
        sampleOrders
        sampleDays
      }
    }

    smartPromotionEngine(
      restaurantId: $restaurantId
      lookbackDays: 30
      horizonDays: 2
    ) {
      summary {
        recommendedCampaignCount
        topOpportunityWindow
        highestPrioritySegment
        notes
      }
      campaigns {
        campaignKey
        title
        objective
        campaignType
        priority
        score
        targetSegment
        targetOrderType
        targetWindow {
          days
          startHour
          endHour
        }
        recommendation {
          promotionType
          targetAudience
          conditions
          scope
          discountType
          discountValue
          minOrderValue
          maxDiscount
          stacking
        }
        expectedKpi {
          expectedOrdersLiftPct
          expectedRevenueLiftPct
          expectedConversionLiftPct
          expectedAovLiftPct
          expectedRedemptionRate
          expectedStockReliefScore
          confidence
        }
        guardrails
        reason
      }
      autoSelectedPromotions {
        source
        promotionId
        promotionName
        fitScore
        fitReason
      }
      segmentInsights {
        segment
        recommendedStrategy
        reason
      }
      timeWindowInsights {
        window
        demandLevel
        recommendedStrategy
      }
      couponContext {
        activeCouponCount
        nearUsageLimitCount
      }
      meta {
        method
        fallbackUsed
        forecastFallbackUsed
        lowDataFallbackUsed
        aiEnhanced
        generatedAt
        timezone
        sampleOrders
        sampleDays
      }
    }
  }
`;

const GET_ANALYST_OPERATIONS_REQUESTS = gql`
  query GetAnalystOperationsRequests($restaurantId: ID!) {
    pendingServiceRequests: customerServiceRequests(
      restaurantId: $restaurantId
      status: "PENDING"
      limit: 20
    ) {
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
    acknowledgedServiceRequests: customerServiceRequests(
      restaurantId: $restaurantId
      status: "ACKNOWLEDGED"
      limit: 20
    ) {
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
`;

const EMPTY_FEEDBACK_SUMMARY = {
  avgRating: 0,
  total: 0,
  negative: 0,
  positive: 0,
};
const EMPTY_STATUS_COUNTS = {
  pending: 0,
  preparing: 0,
  completed: 0,
  cancelled: 0,
};
const EMPTY_DEMAND_FORECAST = {
  summary: {
    busiestPeriods: [],
    topRisingDishes: [],
    totalRecommendedPrep: 0,
    notes: [],
  },
  hourlyForecast: [],
  dailyForecast: [],
  risingDishes: [],
  prepPlan: [],
  meta: {
    method: "time_series_v1",
    fallbackUsed: true,
    forecastFallbackUsed: true,
    lowDataFallbackUsed: true,
    aiEnhanced: false,
    generatedAt: null,
    granularity: "hourly",
    timezone: "Asia/Ho_Chi_Minh",
    sampleOrders: 0,
    sampleDays: 0,
  },
};
const EMPTY_STAFF_SCHEDULING = {
  summary: {
    totalShiftGroups: 0,
    underStaffedShifts: 0,
    overStaffedShifts: 0,
    highestRiskShift: null,
    notes: [],
  },
  shifts: [],
  meta: {
    method: "staff_scheduling_v1",
    basedOnForecast: false,
    fallbackUsed: true,
    generatedAt: null,
    timezone: "Asia/Ho_Chi_Minh",
  },
};
const EMPTY_MENU_ENGINEERING = {
  summary: {
    totalDishes: 0,
    starCount: 0,
    plowhorseCount: 0,
    puzzleCount: 0,
    dogCount: 0,
    avgMarginPct: 0,
    notes: [],
  },
  dishes: [],
  recommendations: [],
  meta: {
    method: "menu_engineering_v1",
    fallbackUsed: true,
    fallbackMarginRate: 0.65,
    generatedAt: null,
    timezone: "Asia/Ho_Chi_Minh",
    sampleOrders: 0,
    sampleDays: 30,
  },
};
const EMPTY_SMART_PROMOTION = {
  summary: {
    recommendedCampaignCount: 0,
    topOpportunityWindow: "15:00-17:00",
    highestPrioritySegment: "NEW",
    notes: [],
  },
  campaigns: [],
  autoSelectedPromotions: [],
  segmentInsights: [],
  timeWindowInsights: [],
  couponContext: { activeCouponCount: 0, nearUsageLimitCount: 0 },
  meta: {
    method: "smart_promo_v1",
    fallbackUsed: true,
    forecastFallbackUsed: true,
    lowDataFallbackUsed: true,
    aiEnhanced: false,
    generatedAt: null,
    timezone: "Asia/Ho_Chi_Minh",
    sampleOrders: 0,
    sampleDays: 30,
  },
};

const PARTIAL_ERROR_LABELS = {
  staffSchedulingAssistant: "Gợi ý phân ca",
  demandForecast: "Dự báo nhu cầu",
  menuEngineeringAssistant: "Phân tích menu",
  smartPromotionEngine: "Khuyến mãi thông minh",
  feedbackSummary: "Tổng hợp đánh giá",
  feedbackItems: "Chi tiết đánh giá",
  occupancyHeatmap: "Công suất bàn",
  staffPerformance: "Hiệu suất nhân viên",
  managerDashboard: "Tổng quan kinh doanh",
};

export const getAnalystPartialErrorSections = (error) => {
  const graphQLErrors = error?.graphQLErrors || error?.errors || [];
  return [
    ...new Set(
      graphQLErrors
        .map((graphQLError) => {
          const path = Array.isArray(graphQLError?.path) ? graphQLError.path : [];
          const field = path[0] === "managerDashboard" ? path[1] : path[0];
          return PARTIAL_ERROR_LABELS[field] || null;
        })
        .filter(Boolean),
    ),
  ];
};

export const useAnalyst = () => {
  const { user } = useContext(AuthContext) || {};
  const {
    restaurantOptions: rawRestaurantOptions = [],
    selectedRestaurantId: restaurantId = "",
    setSelectedRestaurantId: setRestaurantId,
    selectedRestaurant,
    restaurantsLoading,
    error: restaurantSelectionError,
  } = useManagerRestaurantSelection();
  const restaurantOptions = Array.isArray(rawRestaurantOptions)
    ? rawRestaurantOptions
    : [];
  const [range, setRange] = useState("week");
  const canReadStaffScheduling = hasAnyPermission(user, ["shift.read"]);
  const canReadOperationsRequests = hasAnyPermission(user, ["order.read"]);
  const hasConfirmedRestaurantScope = Boolean(
    !restaurantsLoading &&
      restaurantId &&
      selectedRestaurant &&
      getRestaurantId(selectedRestaurant) === String(restaurantId),
  );
  const dashboardVariables = {
    restaurantId,
    range,
    includeStaffScheduling: canReadStaffScheduling,
  };

  const {
    data,
    loading: dashboardQueryLoading,
    error: dashboardQueryError,
    refetch: refetchDashboard,
  } = useQuery(GET_ANALYST_DASHBOARD, {
    skip: !hasConfirmedRestaurantScope,
    variables: dashboardVariables,
    fetchPolicy: "network-only",
    errorPolicy: "all",
    notifyOnNetworkStatusChange: true,
  });
  const {
    data: operationsRequestsData,
    loading: rawOperationsRequestsLoading,
    error: rawOperationsRequestsError,
    refetch: refetchOperationsQuery,
  } = useQuery(GET_ANALYST_OPERATIONS_REQUESTS, {
    skip: !hasConfirmedRestaurantScope || !canReadOperationsRequests,
    variables: { restaurantId },
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
    notifyOnNetworkStatusChange: true,
  });

  const rawAnalyst = data?.managerDashboard;
  const hasStaleDashboard = Boolean(
    rawAnalyst?.restaurantId &&
      String(rawAnalyst.restaurantId) !== String(restaurantId),
  );
  const hasScopedDashboard = Boolean(rawAnalyst && !hasStaleDashboard);
  const scopedData = hasScopedDashboard ? data : null;
  const analyst = scopedData?.managerDashboard;
  const demandForecast = scopedData?.demandForecast;
  const staffSchedulingAssistant = scopedData?.staffSchedulingAssistant;
  const menuEngineeringAssistant = scopedData?.menuEngineeringAssistant;
  const smartPromotionEngine = scopedData?.smartPromotionEngine;
  const loading = Boolean(
    restaurantsLoading ||
      (restaurantId && !hasConfirmedRestaurantScope) ||
      dashboardQueryLoading ||
      hasStaleDashboard,
  );
  const error =
    restaurantSelectionError ||
    (!dashboardQueryLoading && dashboardQueryError && !hasScopedDashboard
      ? dashboardQueryError
      : null);
  const partialErrorSections = getAnalystPartialErrorSections(
    hasScopedDashboard ? dashboardQueryError : null,
  );

  const pendingServiceRequests = canReadOperationsRequests
    ? operationsRequestsData?.pendingServiceRequests || []
    : [];
  const acknowledgedServiceRequests = canReadOperationsRequests
    ? operationsRequestsData?.acknowledgedServiceRequests || []
    : [];
  const serviceRequests = useMemo(
    () =>
      [...pendingServiceRequests, ...acknowledgedServiceRequests]
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(b?.createdAt || 0).getTime() -
            new Date(a?.createdAt || 0).getTime(),
        ),
    [pendingServiceRequests, acknowledgedServiceRequests],
  );
  const operationsSummary = useMemo(
    () => ({
      processingOrders:
        Number(analyst?.statusCounts?.pending || 0) +
        Number(analyst?.statusCounts?.preparing || 0),
      pendingRequestsCount: pendingServiceRequests.length,
      acknowledgedRequestsCount: acknowledgedServiceRequests.length,
      openRequestsCount: serviceRequests.length,
      lowStockCount: (analyst?.lowStockItems || []).length,
    }),
    [
      acknowledgedServiceRequests.length,
      analyst,
      pendingServiceRequests.length,
      serviceRequests.length,
    ],
  );

  const actionItems = useMemo(() => {
    const items = [];
    if ((staffSchedulingAssistant?.summary?.underStaffedShifts || 0) > 0) {
      items.push("staffing");
    }
    if ((smartPromotionEngine?.campaigns || []).length) {
      items.push("promotion");
    }
    if ((demandForecast?.summary?.busiestPeriods || []).length) {
      items.push("forecast");
    }
    if ((menuEngineeringAssistant?.recommendations || []).length) {
      items.push("menu");
    }
    if ((analyst?.feedbackSummary?.negative || 0) > 0) {
      items.push("feedback");
    }
    return items;
  }, [
    analyst,
    demandForecast,
    menuEngineeringAssistant,
    smartPromotionEngine,
    staffSchedulingAssistant,
  ]);

  const hasBusinessData = useMemo(() => {
    const revenue = Number(analyst?.revenue || 0);
    const orders = Number(analyst?.orders || 0);
    const customers = Number(analyst?.customers || 0);
    const reviews = Number(analyst?.feedbackSummary?.total || 0);
    const staffing = (staffSchedulingAssistant?.shifts || []).length;
    const menu = (menuEngineeringAssistant?.dishes || []).length;

    return (
      revenue > 0 ||
      orders > 0 ||
      customers > 0 ||
      reviews > 0 ||
      staffing > 0 ||
      menu > 0
    );
  }, [analyst, menuEngineeringAssistant, staffSchedulingAssistant]);

  const kpiData = useMemo(
    () => [
      { label: "Doanh Thu Thuần", value: analyst?.revenue || 0 },
      { label: "Lượng Khách", value: analyst?.customers || 0 },
      { label: "Tổng Đơn", value: analyst?.orders || 0 },
      {
        label: "Điểm Tin Cậy",
        value: analyst?.feedbackSummary?.avgRating || 0,
      },
    ],
    [analyst],
  );

  const refetchOperationsRequests = useCallback(() => {
    if (
      !hasConfirmedRestaurantScope ||
      !canReadOperationsRequests ||
      !refetchOperationsQuery
    ) {
      return Promise.resolve(null);
    }
    return refetchOperationsQuery({ restaurantId });
  }, [
    canReadOperationsRequests,
    hasConfirmedRestaurantScope,
    refetchOperationsQuery,
    restaurantId,
  ]);

  const refetch = useCallback(() => {
    if (!hasConfirmedRestaurantScope) return Promise.resolve([]);
    const requests = [refetchDashboard(dashboardVariables)];
    if (canReadOperationsRequests && refetchOperationsQuery) {
      requests.push(refetchOperationsQuery({ restaurantId }));
    }
    return Promise.allSettled(requests);
  }, [
    canReadOperationsRequests,
    dashboardVariables,
    hasConfirmedRestaurantScope,
    refetchDashboard,
    refetchOperationsQuery,
    restaurantId,
  ]);

  return {
    restaurantId,
    setRestaurantId,
    restaurants: restaurantOptions,
    restaurantOptions,
    range,
    setRange,
    loading,
    error,
    partialErrorSections,
    operationsRequestsLoading: canReadOperationsRequests
      ? rawOperationsRequestsLoading
      : false,
    operationsRequestsError: canReadOperationsRequests
      ? rawOperationsRequestsError
      : null,
    refetch,
    refetchOperationsRequests: canReadOperationsRequests
      ? refetchOperationsRequests
      : null,
    selectedRestaurant,
    canReadOperationsRequests,
    canReadStaffScheduling,
    hasBusinessData,
    hasOperationalRisk: actionItems.length > 0,
    actionItems,
    kpiData,
    revenueTrend: analyst?.revenueTrend || [],
    orderTrend: analyst?.orderTrend || [],
    topDishes: analyst?.topDishes || [],
    feedbackSummary: analyst?.feedbackSummary || EMPTY_FEEDBACK_SUMMARY,
    feedbackItems: analyst?.feedbackItems || [],
    occupancyHeatmap: analyst?.occupancyHeatmap || [],
    staffPerformance: analyst?.staffPerformance || [],
    statusCounts: analyst?.statusCounts || EMPTY_STATUS_COUNTS,
    recentOrders: analyst?.recentOrders || [],
    lowStockItems: analyst?.lowStockItems || [],
    pendingServiceRequests,
    acknowledgedServiceRequests,
    serviceRequests,
    operationsSummary,
    demandForecast: demandForecast || EMPTY_DEMAND_FORECAST,
    staffSchedulingAssistant:
      staffSchedulingAssistant || EMPTY_STAFF_SCHEDULING,
    menuEngineeringAssistant:
      menuEngineeringAssistant || EMPTY_MENU_ENGINEERING,
    smartPromotionEngine: smartPromotionEngine || EMPTY_SMART_PROMOTION,
  };
};
