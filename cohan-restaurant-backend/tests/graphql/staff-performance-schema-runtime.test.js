import { buildASTSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import typeDefs from "../../graphql/schema/index.js";

const schema = buildASTSchema(typeDefs);
const validateOperation = (source) => validate(schema, parse(source));

describe("runtime GraphQL schema for staff performance", () => {
  it("accepts the manager review and recalculation operations", () => {
    const errors = validateOperation(/* GraphQL */ `
      mutation SaveStaffPerformanceReview(
        $reviewInput: UpsertStaffPerformanceReviewInput!
        $recalculateInput: RecalculateStaffPerformanceInput!
      ) {
        upsertStaffPerformanceReview(input: $reviewInput) {
          id
          employeeId
          managerRatingScore
          attitudeScore
          teamworkScore
          skillScore
          note
        }
        recalculateStaffPerformanceSnapshots(input: $recalculateInput) {
          id
          employeeId
          finalPerformanceScore
          performanceLevel
        }
      }
    `);

    expect(errors).toEqual([]);
  });

  it("accepts the staff summary, timeline, adjustment and incident query", () => {
    const errors = validateOperation(/* GraphQL */ `
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
    `);

    expect(errors).toEqual([]);
  });

  it("accepts the manager performance dashboard operation", () => {
    const errors = validateOperation(/* GraphQL */ `
      query ManagerPerformanceDashboard(
        $input: ManagerPerformanceDashboardInput!
      ) {
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
    `);

    expect(errors).toEqual([]);
  });

  it("accepts appeal evidence, review decision and score reversal inputs", () => {
    const errors = validateOperation(/* GraphQL */ `
      mutation StaffPerformanceAppealFlow(
        $createInput: CreatePerformanceIncidentAppealInput!
        $reviewInput: ReviewPerformanceIncidentAppealInput!
        $reverseInput: ReverseScoreForAcceptedAppealInput!
      ) {
        createPerformanceIncidentAppeal(input: $createInput) {
          id
          incidentId
          status
          submittedAt
          evidenceNote
          evidenceUrls
        }
        reviewPerformanceIncidentAppeal(input: $reviewInput) {
          id
          status
          decisionReason
          reviewNote
        }
        reverseScoreForAcceptedAppeal(input: $reverseInput) {
          id
          scoreReversalStatus
          scoreReversalDelta
          scoreReversedAt
        }
      }
    `);

    expect(errors).toEqual([]);
  });
});
