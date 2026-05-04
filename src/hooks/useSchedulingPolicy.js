import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";

export const QUERY_SCHEDULING_POLICY = gql`
  query SchedulingPolicy($restaurantId: ID!) {
    schedulingPolicy(restaurantId: $restaurantId) {
      id
      restaurantId
      shiftTemplates {
        key
        label
        startTime
        endTime
        enabled
        allowCrossDay
      }
      laborRules {
        respectWorkingDays
        workingDaysRuleLevel

        respectLeaveRequests
        leaveConflictRuleLevel

        preventShiftOverlap

        weeklyHoursCap
        recommendedWeeklyHoursCap
        weeklyHoursRuleLevel

        maxShiftsPerDay
        maxShiftsPerDayRuleLevel

        minRestHoursBetweenShifts
        minRestRuleLevel

        maxConsecutiveWorkingDays
        hardMaxConsecutiveWorkingDays
        consecutiveDaysRuleLevel

        allowManagerOverride
        overrideRequiresReason
      }
      scoringWeights {
        roleFit
        availabilityFit
        workloadBalance
        fairness
        performance
        employmentTypeFit
        costEfficiency
        reliability
        fatiguePenalty
        overtimePenalty
        ruleRiskPenalty
      }
      mandatoryShiftRoles
      employmentTypePolicy {
        full_time {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          maxConsecutiveWorkingDays
          requireAvailability
          allowOvertime
          avoidSoloCriticalShift
          priorityWeight
        }
        part_time {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          maxConsecutiveWorkingDays
          requireAvailability
          allowOvertime
          avoidSoloCriticalShift
          priorityWeight
        }
        probation {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          maxConsecutiveWorkingDays
          requireAvailability
          allowOvertime
          avoidSoloCriticalShift
          priorityWeight
        }
        seasonal {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          maxConsecutiveWorkingDays
          requireAvailability
          allowOvertime
          avoidSoloCriticalShift
          priorityWeight
        }
        contract {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          maxConsecutiveWorkingDays
          requireAvailability
          allowOvertime
          avoidSoloCriticalShift
          priorityWeight
        }
      }
      availabilityRegistrationPolicy {
        availabilityRegistrationMode
        availabilityOpenDayOffset
        availabilityOpenTime
        availabilityCloseDayOffset
        availabilityCloseTime
        enabled
        targetEmploymentTypes
        openDayOfWeek
        openTime
        closeDayOfWeek
        closeTime
        publishTargetDayOfWeek
        publishTargetTime
        timezone
        allowFullTimeUnavailableException
        lateChangeRequiresApproval
        treatMissingPartTimeSubmissionAsUnavailable
        autoCreateWindow
      }
      schedulingOperationalStartAt
      firstWeekGracePolicy {
        enabled
        strategy
        appliedUntil
      }
      createdAt
      updatedAt
    }
  }
`;

export const QUERY_VALIDATE_SHIFT_ASSIGNMENT = gql`
  query ValidateShiftAssignment($input: ValidateShiftAssignmentInput!) {
    validateShiftAssignment(input: $input) {
      ok
      employeeId
      restaurantId
      score
      blockingErrors {
        code
        severity
        message
        suggestedAction
      }
      warnings {
        code
        severity
        message
        suggestedAction
      }
      metrics {
        shiftHours
        weeklyHoursBefore
        weeklyHoursAfter
        shiftsInDayAfter
        consecutiveWorkingDays

        performanceScore
        performanceContribution
        reliabilityScore
        reliabilityContribution
        performanceSnapshotId
      }
    }
  }
`;

const MUTATION_UPDATE_SCHEDULING_POLICY = gql`
  mutation UpdateSchedulingPolicy(
    $restaurantId: ID!
    $input: SchedulingPolicyInput!
  ) {
    updateSchedulingPolicy(restaurantId: $restaurantId, input: $input) {
      id
      restaurantId
      shiftTemplates {
        key
        label
        startTime
        endTime
        enabled
        allowCrossDay
      }
      laborRules {
        respectWorkingDays
        workingDaysRuleLevel
        respectLeaveRequests
        leaveConflictRuleLevel
        preventShiftOverlap
        weeklyHoursCap
        recommendedWeeklyHoursCap
        weeklyHoursRuleLevel
        maxShiftsPerDay
        maxShiftsPerDayRuleLevel
        minRestHoursBetweenShifts
        minRestRuleLevel
        maxConsecutiveWorkingDays
        hardMaxConsecutiveWorkingDays
        consecutiveDaysRuleLevel
        allowManagerOverride
        overrideRequiresReason
      }
      scoringWeights {
        roleFit
        availabilityFit
        workloadBalance
        fairness
        performance
        employmentTypeFit
        costEfficiency
        reliability
        fatiguePenalty
        overtimePenalty
        ruleRiskPenalty
      }
      mandatoryShiftRoles
      availabilityRegistrationPolicy {
        availabilityRegistrationMode
        availabilityOpenDayOffset
        availabilityOpenTime
        availabilityCloseDayOffset
        availabilityCloseTime
        enabled
        targetEmploymentTypes
        openDayOfWeek
        openTime
        closeDayOfWeek
        closeTime
        publishTargetDayOfWeek
        publishTargetTime
        timezone
        allowFullTimeUnavailableException
        lateChangeRequiresApproval
        treatMissingPartTimeSubmissionAsUnavailable
        autoCreateWindow
      }
      updatedAt
    }
  }
`;
const MUTATION_START_SCHEDULING_OPERATIONS = gql`
  mutation StartSchedulingOperations($restaurantId: ID!) {
    startSchedulingOperations(restaurantId: $restaurantId) {
      id
      schedulingOperationalStartAt
      firstWeekGracePolicy {
        enabled
        strategy
        appliedUntil
      }
    }
  }
`;

export default function useSchedulingPolicy({ restaurantId } = {}) {
  const { data, loading, error, refetch } = useQuery(QUERY_SCHEDULING_POLICY, {
    variables: { restaurantId },
    fetchPolicy: "cache-and-network",
    skip: !restaurantId,
  });

  const [validateShiftAssignment, validateState] = useLazyQuery(
    QUERY_VALIDATE_SHIFT_ASSIGNMENT,
    {
      fetchPolicy: "network-only",
    },
  );

  const [updateSchedulingPolicy, updateState] = useMutation(
    MUTATION_UPDATE_SCHEDULING_POLICY,
    {
      onCompleted: async () => {
        await refetch();
      },
    },
  );
  const [startSchedulingOperations, startState] = useMutation(
    MUTATION_START_SCHEDULING_OPERATIONS,
  );

  const policy = useMemo(
    () => data?.schedulingPolicy || null,
    [data?.schedulingPolicy],
  );

  return {
    policy,
    loading,
    error,
    refetch,

    validateShiftAssignment,
    validateState,

    updateSchedulingPolicy,
    startSchedulingOperations,
    updateState,
    startState,
  };
}
