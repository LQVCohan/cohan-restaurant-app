import { gql, useMutation } from "@apollo/client";

const INCIDENT_FRAGMENT = gql`
  fragment PerformanceIncidentActionFields on PerformanceIncident {
    id
    responsibilityStatus
    scoreImpactStatus
    proposedScoreDelta
    scoreDelta
    reviewNote
    responsibilityNote
    waiveReason
    reviewedAt
    waivedAt
    eligibleAt
    appliedAt
  }
`;

const REVIEW_INCIDENT = gql`
  mutation ReviewPerformanceIncident($input: ReviewPerformanceIncidentInput!) {
    reviewPerformanceIncident(input: $input) {
      ...PerformanceIncidentActionFields
    }
  }
  ${INCIDENT_FRAGMENT}
`;

const WAIVE_INCIDENT = gql`
  mutation WaivePerformanceIncident($incidentId: ID!, $reason: String!) {
    waivePerformanceIncident(incidentId: $incidentId, reason: $reason) {
      ...PerformanceIncidentActionFields
    }
  }
  ${INCIDENT_FRAGMENT}
`;

const MARK_ELIGIBLE = gql`
  mutation MarkPerformanceIncidentEligible($input: MarkPerformanceIncidentEligibleInput!) {
    markPerformanceIncidentEligible(input: $input) {
      ...PerformanceIncidentActionFields
    }
  }
  ${INCIDENT_FRAGMENT}
`;

const APPLY_SCORE = gql`
  mutation ApplyPerformanceIncidentScore($input: ApplyPerformanceIncidentScoreInput!) {
    applyPerformanceIncidentScore(input: $input) {
      ...PerformanceIncidentActionFields
    }
  }
  ${INCIDENT_FRAGMENT}
`;

export default function usePerformanceIncidentActions() {
  const [reviewMutation, reviewState] = useMutation(REVIEW_INCIDENT);
  const [waiveMutation, waiveState] = useMutation(WAIVE_INCIDENT);
  const [eligibleMutation, eligibleState] = useMutation(MARK_ELIGIBLE);
  const [applyMutation, applyState] = useMutation(APPLY_SCORE);

  return {
    reviewIncident: async (input) => (await reviewMutation({ variables: { input } })).data?.reviewPerformanceIncident,
    waiveIncident: async ({ incidentId, reason }) => (await waiveMutation({ variables: { incidentId, reason } })).data?.waivePerformanceIncident,
    markEligible: async (input) => (await eligibleMutation({ variables: { input } })).data?.markPerformanceIncidentEligible,
    applyScore: async (input) => (await applyMutation({ variables: { input } })).data?.applyPerformanceIncidentScore,
    actionLoading: reviewState.loading || waiveState.loading || eligibleState.loading || applyState.loading,
    loadingStates: { review: reviewState.loading, waive: waiveState.loading, markEligible: eligibleState.loading, apply: applyState.loading },
    error: reviewState.error || waiveState.error || eligibleState.error || applyState.error,
  };
}
