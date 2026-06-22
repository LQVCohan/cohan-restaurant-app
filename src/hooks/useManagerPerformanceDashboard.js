import { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";

const GET_MANAGER_PERFORMANCE_DASHBOARD = gql`
  query ManagerPerformanceDashboard($input: ManagerPerformanceDashboardInput!) {
    managerPerformanceDashboard(input: $input) {
      period {
        restaurantId
        periodStart
        periodEnd
      }
      incidentOverview {
        totalIncidents
        openIncidents
        pendingReviewCount
        overdueCount
        dueSoonCount
        eligibleCount
        appliedCount
        waivedCount
        notApplicableCount
        criticalCount
        highPriorityCount
      }
      scoringOverview {
        averageScore
        lowestScore
        highestScore
        lowScoreEmployeeCount
        totalScoreDelta
        appliedAdjustmentCount
        eligibleScoreDeltaPending
        waivedScoreDelta
      }
      slaOverview {
        totalRequiringReview
        overdueCount
        dueSoonCount
        onTrackCount
        slaComplianceRate
        averageResolutionHours
        oldestOpenIncidentAt
      }
      topRiskEmployees {
        employeeId
        finalPerformanceScore
        totalScoreDelta
        pendingReviewCount
        overdueCount
        eligibleCount
        appliedAdjustmentCount
        latestIncidentAt
        riskLevel
        riskReasons
      }
      topEventTypes {
        eventType
        count
        appliedCount
        waivedCount
        totalScoreDelta
      }
      responsibilityBreakdown {
        responsibilityStatus
        count
        totalScoreDelta
      }
      recommendedActions {
        action
        count
        priority
      }
    }
  }
`;

const DEFAULT_DASHBOARD = {
  period: { restaurantId: "", periodStart: null, periodEnd: null },
  incidentOverview: {
    totalIncidents: 0,
    openIncidents: 0,
    pendingReviewCount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    eligibleCount: 0,
    appliedCount: 0,
    waivedCount: 0,
    notApplicableCount: 0,
    criticalCount: 0,
    highPriorityCount: 0,
  },
  scoringOverview: {
    averageScore: 0,
    lowestScore: 0,
    highestScore: 0,
    lowScoreEmployeeCount: 0,
    totalScoreDelta: 0,
    appliedAdjustmentCount: 0,
    eligibleScoreDeltaPending: 0,
    waivedScoreDelta: 0,
  },
  slaOverview: {
    totalRequiringReview: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    onTrackCount: 0,
    slaComplianceRate: 0,
    averageResolutionHours: 0,
    oldestOpenIncidentAt: null,
  },
  topRiskEmployees: [],
  topEventTypes: [],
  responsibilityBreakdown: [],
  recommendedActions: [],
};

export const useManagerPerformanceDashboard = ({
  restaurantId,
  month,
  year,
  fromDate,
  toDate,
  enabled = true,
} = {}) => {
  const now = new Date();
  const effectiveMonth = month ?? now.getUTCMonth() + 1;
  const effectiveYear = year ?? now.getUTCFullYear();

  const input = useMemo(() => {
    const baseInput = {
      restaurantId,
      month: effectiveMonth,
      year: effectiveYear,
      limit: 10,
    };

    if (fromDate || toDate) {
      return {
        ...baseInput,
        month: null,
        year: null,
        fromDate: fromDate || null,
        toDate: toDate || null,
      };
    }

    return baseInput;
  }, [restaurantId, effectiveMonth, effectiveYear, fromDate, toDate]);

  const shouldSkip = !enabled || !restaurantId;

  const { data, loading, error, refetch } = useQuery(
    GET_MANAGER_PERFORMANCE_DASHBOARD,
    {
      skip: shouldSkip,
      variables: { input },
      fetchPolicy: "network-only",
    },
  );

  const dashboard = data?.managerPerformanceDashboard || DEFAULT_DASHBOARD;
  const hasScoreData =
    Number(dashboard?.scoringOverview?.highestScore || 0) > 0 ||
    Number(dashboard?.scoringOverview?.averageScore || 0) > 0;

  return {
    dashboard,
    loading,
    error,
    refetch,
    isEmpty:
      !loading &&
      !error &&
      !hasScoreData &&
      dashboard.incidentOverview.totalIncidents === 0 &&
      dashboard.topRiskEmployees.length === 0,
  };
};
