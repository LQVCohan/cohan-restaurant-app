import { useContext, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";

const GET_STAFF_PERFORMANCE_VIEW = gql`
  query StaffPerformanceView(
    $summaryInput: StaffPerformanceSummaryInput!
    $adjustmentInput: StaffPerformanceScoreAdjustmentFilterInput!
    $timelineInput: StaffPerformanceScoreTimelineInput!
    $incidentsFilter: PerformanceIncidentFilterInput!
  ) {
    staffPerformanceSummary(input: $summaryInput) {
      employeeId
      finalPerformanceScore
      totalScoreDelta
      appliedAdjustmentCount
      pendingReviewIncidentCount
      eligibleIncidentCount
      appliedIncidentCount
      waivedIncidentCount
      periodStart
      periodEnd
      latestAppliedAt
    }
    staffPerformanceScoreAdjustments(input: $adjustmentInput) {
      id
      restaurantId
      employeeId
      incidentId
      reason
      scoreDelta
      previousScore
      newScore
      note
      createdAt
      appliedAt
    }
    staffPerformanceScoreTimeline(input: $timelineInput) {
      at
      score
      scoreDelta
      eventType
      note
      incidentId
    }
    performanceIncidents(filter: $incidentsFilter) {
      id
      eventType
      severity
      responsibilityStatus
      scoreImpactStatus
      proposedScoreDelta
      scoreDelta
      occurredAt
      note
      reviewNote
      waiveReason
      applyNote
    }
  }
`;

export const resolveCurrentEmployeeId = (user) => {
  if (!user) return "";
  return user.employeeId || user.staffId || user.id || user._id || "";
};

export const resolveDefaultRestaurantId = (user, restaurants = []) => {
  if (user?.restaurantId) return user.restaurantId;
  if (user?.restaurantForStaff) return user.restaurantForStaff;
  return restaurants?.[0]?.id || "";
};

export const useStaffPerformanceView = ({
  restaurantId: restaurantIdProp,
  employeeId: employeeIdProp,
  month,
  year,
  fromDate,
  toDate,
  enabled = true,
} = {}) => {
  const { user, restaurants = [] } = useContext(AuthContext) || {};
  const now = new Date();
  const effectiveMonth = month ?? now.getUTCMonth() + 1;
  const effectiveYear = year ?? now.getUTCFullYear();

  const employeeId = employeeIdProp || resolveCurrentEmployeeId(user);
  const restaurantId =
    restaurantIdProp || resolveDefaultRestaurantId(user, restaurants);

  const defaultFromDate = new Date(Date.UTC(effectiveYear, effectiveMonth - 1, 1)).toISOString();
  const defaultToDate = new Date(Date.UTC(effectiveYear, effectiveMonth, 0, 23, 59, 59, 999)).toISOString();

  const summaryInput = useMemo(() => ({
    restaurantId,
    employeeId,
    month: effectiveMonth,
    year: effectiveYear,
    fromDate: fromDate || null,
    toDate: toDate || null,
  }), [restaurantId, employeeId, effectiveMonth, effectiveYear, fromDate, toDate]);

  const dateRangeInput = useMemo(() => ({
    restaurantId,
    employeeId,
    fromDate: fromDate || defaultFromDate,
    toDate: toDate || defaultToDate,
  }), [restaurantId, employeeId, fromDate, toDate, defaultFromDate, defaultToDate]);

  const shouldSkip = !enabled || !restaurantId || !employeeId;

  const { data, loading, error, refetch } = useQuery(GET_STAFF_PERFORMANCE_VIEW, {
    skip: shouldSkip,
    variables: {
      summaryInput,
      adjustmentInput: dateRangeInput,
      timelineInput: dateRangeInput,
      incidentsFilter: dateRangeInput,
    },
    fetchPolicy: "network-only",
  });

  return {
    summary: data?.staffPerformanceSummary || null,
    adjustments: data?.staffPerformanceScoreAdjustments || [],
    timeline: data?.staffPerformanceScoreTimeline || [],
    incidents: data?.performanceIncidents || [],
    loading,
    error,
    refetch,
    employeeId,
    restaurantId,
    missingIdentity: !restaurantId || !employeeId,
  };
};
