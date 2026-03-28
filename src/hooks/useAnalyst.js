import { useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";

const GET_ANALYST_DASHBOARD = gql`
  query GetAnalystDashboard($restaurantId: ID!, $range: String) {
    managerDashboard(restaurantId: $restaurantId, range: $range) {
      revenue
      orders
      customers
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
        aiEnhanced
        generatedAt
        granularity
        timezone
        sampleOrders
        sampleDays
      }
    }
  }
`;

export const useAnalyst = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState(restaurants?.[0]?.id || "");
  const [range, setRange] = useState("week");

  const { data, loading, error, refetch } = useQuery(GET_ANALYST_DASHBOARD, {
    skip: !restaurantId,
    variables: { restaurantId, range },
    fetchPolicy: "network-only",
  });

  const analyst = data?.managerDashboard;
  const demandForecast = data?.demandForecast;

  const kpiData = useMemo(
    () => [
      { label: "Doanh Thu Thuần", value: analyst?.revenue || 0 },
      { label: "Lượng Khách", value: analyst?.customers || 0 },
      { label: "Tổng Đơn", value: analyst?.orders || 0 },
      { label: "Điểm Tin Cậy", value: analyst?.feedbackSummary?.avgRating || 0 },
    ],
    [analyst]
  );

  return {
    restaurantId,
    setRestaurantId,
    restaurants,
    range,
    setRange,
    loading,
    error,
    refetch,
    kpiData,
    revenueTrend: analyst?.revenueTrend || [],
    topDishes: analyst?.topDishes || [],
    feedbackSummary: analyst?.feedbackSummary || {
      avgRating: 0,
      total: 0,
      negative: 0,
      positive: 0,
    },
    feedbackItems: analyst?.feedbackItems || [],
    occupancyHeatmap: analyst?.occupancyHeatmap || [],
    staffPerformance: analyst?.staffPerformance || [],
    demandForecast: demandForecast || {
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
        aiEnhanced: false,
        generatedAt: null,
        granularity: "hourly",
        timezone: "Asia/Ho_Chi_Minh",
        sampleOrders: 0,
        sampleDays: 0,
      },
    },
  };
};
