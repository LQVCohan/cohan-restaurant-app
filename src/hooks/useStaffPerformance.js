import { gql, useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";

export const QUERY_STAFF_PERFORMANCE_SNAPSHOTS = gql`
  query StaffPerformanceSnapshots($filter: StaffPerformanceFilterInput) {
    staffPerformanceSnapshots(filter: $filter) {
      id
      employeeId
      employeeName
      employeeCode
      employeeRole
      employeeAvatar
      restaurantId
      periodStart
      periodEnd

      productivity {
        score
        weight
        note
      }
      punctuality {
        score
        weight
        note
      }
      quality {
        score
        weight
        note
      }
      managerReview {
        score
        weight
        note
      }
      compliance {
        score
        weight
        note
      }

      finalPerformanceScore
      performanceLevel
      factors

      generatedBy
      generatedByName
      reviewedBy
      reviewedAt
      lockedAt

      createdAt
      updatedAt
    }
  }
`;

const MUTATION_UPSERT_STAFF_PERFORMANCE_REVIEW = gql`
  mutation UpsertStaffPerformanceReview(
    $input: UpsertStaffPerformanceReviewInput!
  ) {
    upsertStaffPerformanceReview(input: $input) {
      id
      employeeId
      employeeName
      employeeCode
      restaurantId
      periodStart
      periodEnd
      managerRatingScore
      attitudeScore
      teamworkScore
      skillScore
      note
      reviewedBy
      reviewedByName
      createdAt
      updatedAt
    }
  }
`;

const MUTATION_RECALCULATE_STAFF_PERFORMANCE = gql`
  mutation RecalculateStaffPerformanceSnapshots(
    $input: RecalculateStaffPerformanceInput!
  ) {
    recalculateStaffPerformanceSnapshots(input: $input) {
      id
      employeeId
      employeeName
      employeeCode
      employeeRole
      restaurantId
      periodStart
      periodEnd
      finalPerformanceScore
      performanceLevel
      productivity {
        score
        weight
        note
      }
      punctuality {
        score
        weight
        note
      }
      quality {
        score
        weight
        note
      }
      managerReview {
        score
        weight
        note
      }
      compliance {
        score
        weight
        note
      }
      factors
      updatedAt
    }
  }
`;

export const toPerformanceIsoStartOfDay = (value) =>
  value ? `${value}T00:00:00.000Z` : undefined;

export const toPerformanceIsoEndOfDay = (value) =>
  value ? `${value}T23:59:59.999Z` : undefined;

export default function useStaffPerformance({
  restaurantId,
  employeeId,
  periodStart,
  periodEnd,
} = {}) {
  const filter = useMemo(
    () => ({
      restaurantId: restaurantId || undefined,
      employeeId: employeeId || undefined,
      periodStart: periodStart
        ? toPerformanceIsoStartOfDay(periodStart)
        : undefined,
      periodEnd: periodEnd ? toPerformanceIsoEndOfDay(periodEnd) : undefined,
    }),
    [employeeId, periodEnd, periodStart, restaurantId],
  );

  const { data, loading, error, refetch } = useQuery(
    QUERY_STAFF_PERFORMANCE_SNAPSHOTS,
    {
      variables: { filter },
      fetchPolicy: "cache-and-network",
      skip: !restaurantId,
    },
  );

  const [upsertStaffPerformanceReview, reviewState] = useMutation(
    MUTATION_UPSERT_STAFF_PERFORMANCE_REVIEW,
    {
      onCompleted: async () => {
        await refetch();
      },
    },
  );

  const [recalculateStaffPerformanceSnapshots, recalculateState] = useMutation(
    MUTATION_RECALCULATE_STAFF_PERFORMANCE,
    {
      onCompleted: async () => {
        await refetch();
      },
    },
  );

  const snapshots = useMemo(
    () => data?.staffPerformanceSnapshots || [],
    [data?.staffPerformanceSnapshots],
  );

  return {
    snapshots,
    loading,
    error,
    refetch,

    upsertStaffPerformanceReview,
    recalculateStaffPerformanceSnapshots,

    reviewState,
    recalculateState,
  };
}
