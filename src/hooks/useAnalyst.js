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

    staffSchedulingAssistant(restaurantId: $restaurantId, horizonDays: 2) {
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

    smartPromotionEngine(restaurantId: $restaurantId, lookbackDays: 30, horizonDays: 2) {
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
        aiEnhanced
        generatedAt
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
  const staffSchedulingAssistant = data?.staffSchedulingAssistant;
  const menuEngineeringAssistant = data?.menuEngineeringAssistant;
  const smartPromotionEngine = data?.smartPromotionEngine;

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === restaurantId) || null,
    [restaurants, restaurantId]
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
  }, [staffSchedulingAssistant, smartPromotionEngine, demandForecast, menuEngineeringAssistant, analyst]);

  const hasBusinessData = useMemo(() => {
    const revenue = Number(analyst?.revenue || 0);
    const orders = Number(analyst?.orders || 0);
    const customers = Number(analyst?.customers || 0);
    const reviews = Number(analyst?.feedbackSummary?.total || 0);
    const staffing = (staffSchedulingAssistant?.shifts || []).length;
    const menu = (menuEngineeringAssistant?.dishes || []).length;

    return revenue > 0 || orders > 0 || customers > 0 || reviews > 0 || staffing > 0 || menu > 0;
  }, [analyst, staffSchedulingAssistant, menuEngineeringAssistant]);

  const hasOperationalRisk = actionItems.length > 0;

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
    selectedRestaurant,
    hasBusinessData,
    hasOperationalRisk,
    actionItems,
    kpiData,
    revenueTrend: analyst?.revenueTrend || [],
    topDishes: analyst?.topDishes || [],
    feedbackSummary: analyst?.feedbackSummary || { avgRating: 0, total: 0, negative: 0, positive: 0 },
    feedbackItems: analyst?.feedbackItems || [],
    occupancyHeatmap: analyst?.occupancyHeatmap || [],
    staffPerformance: analyst?.staffPerformance || [],
    demandForecast: demandForecast || { summary: { busiestPeriods: [], topRisingDishes: [], totalRecommendedPrep: 0, notes: [] }, hourlyForecast: [], dailyForecast: [], risingDishes: [], prepPlan: [], meta: { method: "time_series_v1", fallbackUsed: true, aiEnhanced: false, generatedAt: null, granularity: "hourly", timezone: "Asia/Ho_Chi_Minh", sampleOrders: 0, sampleDays: 0 } },
    staffSchedulingAssistant: staffSchedulingAssistant || { summary: { totalShiftGroups: 0, underStaffedShifts: 0, overStaffedShifts: 0, highestRiskShift: null, notes: [] }, shifts: [], meta: { method: "staff_scheduling_v1", basedOnForecast: false, fallbackUsed: true, generatedAt: null, timezone: "Asia/Ho_Chi_Minh" } },
    menuEngineeringAssistant: menuEngineeringAssistant || { summary: { totalDishes: 0, starCount: 0, plowhorseCount: 0, puzzleCount: 0, dogCount: 0, avgMarginPct: 0, notes: [] }, dishes: [], recommendations: [], meta: { method: "menu_engineering_v1", fallbackUsed: true, fallbackMarginRate: 0.65, generatedAt: null, timezone: "Asia/Ho_Chi_Minh", sampleOrders: 0, sampleDays: 30 } },
    smartPromotionEngine: smartPromotionEngine || { summary: { recommendedCampaignCount: 0, topOpportunityWindow: "15:00-17:00", highestPrioritySegment: "NEW", notes: [] }, campaigns: [], autoSelectedPromotions: [], segmentInsights: [], timeWindowInsights: [], couponContext: { activeCouponCount: 0, nearUsageLimitCount: 0 }, meta: { method: "smart_promo_v1", fallbackUsed: true, aiEnhanced: false, generatedAt: null, timezone: "Asia/Ho_Chi_Minh", sampleOrders: 0, sampleDays: 30 } },
  };
};
