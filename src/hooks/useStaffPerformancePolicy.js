import { gql, useMutation, useQuery } from "@apollo/client";

export const QUERY_STAFF_PERFORMANCE_POLICY = gql`
  query StaffPerformancePolicy($restaurantId: ID!) {
    staffPerformancePolicy(restaurantId: $restaurantId) {
      restaurantId
      weights {
        productivity
        punctuality
        quality
        managerReview
        compliance
      }
      levelThresholds {
        excellentMin
        goodMin
        averageMin
        needsAttentionMin
      }
      editableFields
      lockedFields
      updatedBy
      updatedAt
    }
  }
`;

export const MUTATION_UPDATE_STAFF_PERFORMANCE_POLICY = gql`
  mutation UpdateStaffPerformancePolicy(
    $input: UpdateStaffPerformancePolicyInput!
  ) {
    updateStaffPerformancePolicy(input: $input) {
      restaurantId
      weights {
        productivity
        punctuality
        quality
        managerReview
        compliance
      }
      levelThresholds {
        excellentMin
        goodMin
        averageMin
        needsAttentionMin
      }
      editableFields
      lockedFields
      updatedBy
      updatedAt
    }
  }
`;

export default function useStaffPerformancePolicy({ restaurantId } = {}) {
  const query = useQuery(QUERY_STAFF_PERFORMANCE_POLICY, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [updatePolicy, updateState] = useMutation(
    MUTATION_UPDATE_STAFF_PERFORMANCE_POLICY,
    {
      onCompleted: async () => {
        await query.refetch?.();
      },
    },
  );

  return {
    policy: query.data?.staffPerformancePolicy || null,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    updatePolicy,
    updateState,
  };
}
