import { gql, useMutation, useQuery } from "@apollo/client";

export const GET_PERFORMANCE_INCIDENT_APPEALS = gql`
  query PerformanceIncidentAppeals($filter: PerformanceIncidentAppealFilterInput!) {
    performanceIncidentAppeals(filter: $filter) {
      id
      restaurantId
      incidentId
      employeeId
      submittedAt
      reason
      evidenceNote
      evidenceUrls
      status
      reviewNote
      decisionReason
      reviewedAt
      scoreReversalStatus
      scoreReversalDelta
    }
  }
`;

export const CREATE_PERFORMANCE_INCIDENT_APPEAL = gql`
  mutation CreatePerformanceIncidentAppeal($input: CreatePerformanceIncidentAppealInput!) {
    createPerformanceIncidentAppeal(input: $input) { id status incidentId submittedAt }
  }
`;

export const REVIEW_PERFORMANCE_INCIDENT_APPEAL = gql`
  mutation ReviewPerformanceIncidentAppeal($input: ReviewPerformanceIncidentAppealInput!) {
    reviewPerformanceIncidentAppeal(input: $input) { id status decisionReason reviewNote }
  }
`;

export const REVERSE_SCORE_FOR_ACCEPTED_APPEAL = gql`
  mutation ReverseScoreForAcceptedAppeal($input: ReverseScoreForAcceptedAppealInput!) {
    reverseScoreForAcceptedAppeal(input: $input) { id scoreReversalStatus scoreReversalDelta scoreReversedAt }
  }
`;

export const usePerformanceIncidentAppeals = (filter, skip=false) => useQuery(GET_PERFORMANCE_INCIDENT_APPEALS,{variables:{filter}, skip});
export const useCreatePerformanceIncidentAppeal = ()=>useMutation(CREATE_PERFORMANCE_INCIDENT_APPEAL);
export const useReviewPerformanceIncidentAppeal = ()=>useMutation(REVIEW_PERFORMANCE_INCIDENT_APPEAL);
export const useReverseScoreForAcceptedAppeal = ()=>useMutation(REVERSE_SCORE_FOR_ACCEPTED_APPEAL);
