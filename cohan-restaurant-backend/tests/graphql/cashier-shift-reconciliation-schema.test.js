import { buildASTSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import typeDefs from "../../graphql/schema/index.js";

const schema = buildASTSchema(typeDefs);
const validateOperation = (source) => validate(schema, parse(source));

describe("cashier shift reconciliation GraphQL schema", () => {
  it("accepts the full cashier cash-drawer lifecycle", () => {
    const errors = validateOperation(/* GraphQL */ `
      query CashierReconciliations(
        $filter: CashierShiftReconciliationFilterInput!
      ) {
        cashierShiftReconciliations(filter: $filter) {
          id
          cashierId
          cashierName
          status
          openingCash
          cashSalesAmount
          cashRefundAmount
          movementNetAmount
          managerAdjustmentAmount
          expectedCash
          actualCash
          varianceAmount
          varianceRate
          attributableToCashier
          movements {
            id
            type
            amount
            reason
          }
          transactionIds
          refundIds
          auditTrail {
            action
            previousStatus
            nextStatus
            note
          }
        }
      }

      mutation CashierReconciliationLifecycle(
        $open: OpenCashierShiftReconciliationInput!
        $movement: AddCashierShiftCashMovementInput!
        $submit: SubmitCashierShiftReconciliationInput!
        $review: ReviewCashierShiftReconciliationInput!
        $id: ID!
      ) {
        openCashierShiftReconciliation(input: $open) { id status }
        addCashierShiftCashMovement(input: $movement) { id expectedCash }
        refreshCashierShiftReconciliation(id: $id) { id calculatedAt }
        submitCashierShiftReconciliation(input: $submit) { id varianceAmount }
        reviewCashierShiftReconciliation(input: $review) {
          id
          status
          attributableToCashier
          lockedAt
        }
      }
    `);

    expect(errors).toEqual([]);
  });

  it("keeps responsibility attribution behind the manager review input", () => {
    const openFields = schema
      .getType("OpenCashierShiftReconciliationInput")
      .getFields();
    const reviewFields = schema
      .getType("ReviewCashierShiftReconciliationInput")
      .getFields();

    expect(Object.keys(openFields)).not.toContain("attributableToCashier");
    expect(Object.keys(reviewFields)).toEqual([
      "reconciliationId",
      "decision",
      "attributableToCashier",
      "managerAdjustmentAmount",
      "note",
    ]);
  });
});
