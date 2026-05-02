import { gql, useQuery } from "@apollo/client";
import { useMemo } from "react";

const GET_MANAGER_INCIDENT_REVIEW_QUEUE = gql`
  query ManagerIncidentReviewQueue($input: ManagerIncidentReviewQueueInput!, $summaryInput: ManagerIncidentReviewQueueSummaryInput!) {
    managerIncidentReviewQueue(input: $input) {
      items {
        incident {
          id
          employeeId
          eventType
          severity
          responsibilityStatus
          scoreImpactStatus
          proposedScoreDelta
          scoreDelta
          note
          reviewNote
          responsibilityNote
          waiveReason
          occurredAt
          detectedAt
          createdAt
          reviewedAt
          waivedAt
          eligibleAt
          appliedAt
        }
        employeeId
        restaurantId
        eventType
        severity
        responsibilityStatus
        scoreImpactStatus
        proposedScoreDelta
        scoreDelta
        occurredAt
        detectedAt
        createdAt
        slaDueAt
        slaHours
        slaStatus
        overdueMinutes
        dueSoon
        priority
        recommendedAction
        canReview
        canWaive
        canMarkEligible
        canApplyScore
      }
      totalCount
      limit
      offset
      hasMore
    }
    managerIncidentReviewQueueSummary(input: $summaryInput) {
      restaurantId
      totalOpen
      pendingReviewCount
      eligibleCount
      overdueCount
      dueSoonCount
      waivedCount
      appliedCount
      notApplicableCount
      criticalCount
      highPriorityCount
      mediumPriorityCount
      lowPriorityCount
      bySeverity { key count }
      byEventType { key count }
      byResponsibilityStatus { key count }
      byScoreImpactStatus { key count }
      byEmployee {
        employeeId
        count
        pendingReviewCount
        eligibleCount
        overdueCount
        latestIncidentAt
      }
    }
  }
`;

const DEFAULT_QUEUE = { items: [], totalCount: 0, limit: 20, offset: 0, hasMore: false };
const DEFAULT_SUMMARY = { totalOpen: 0, pendingReviewCount: 0, eligibleCount: 0, overdueCount: 0, dueSoonCount: 0, waivedCount: 0, appliedCount: 0 };

export default function useManagerIncidentReviewQueue({ restaurantId, filters = {}, limit = 20, offset = 0, enabled = true } = {}) {
  const input = useMemo(() => ({ restaurantId, limit, offset, ...filters }), [restaurantId, limit, offset, filters]);
  const summaryInput = useMemo(() => ({ restaurantId, ...filters }), [restaurantId, filters]);
  const shouldSkip = !enabled || !restaurantId;

  const { data, loading, error, refetch } = useQuery(GET_MANAGER_INCIDENT_REVIEW_QUEUE, {
    variables: { input, summaryInput },
    skip: shouldSkip,
    fetchPolicy: "network-only",
  });

  const queue = data?.managerIncidentReviewQueue || DEFAULT_QUEUE;
  const summary = data?.managerIncidentReviewQueueSummary || DEFAULT_SUMMARY;

  return {
    items: queue.items || [],
    summary,
    loading,
    error,
    refetch,
    totalCount: Number(queue.totalCount || 0),
    limit: Number(queue.limit || limit),
    offset: Number(queue.offset || offset),
    hasMore: Boolean(queue.hasMore),
    nextOffset: Number(queue.offset || offset) + Number(queue.limit || limit),
    prevOffset: Math.max(0, Number(queue.offset || offset) - Number(queue.limit || limit)),
  };
}
