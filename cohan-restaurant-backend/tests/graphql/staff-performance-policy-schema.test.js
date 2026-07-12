import { buildASTSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import typeDefs from "../../graphql/schema/index.js";

const schema = buildASTSchema(typeDefs);
const validateOperation = (source) => validate(schema, parse(source));

describe("staff performance policy GraphQL schema", () => {
  it("accepts the guarded policy query and update mutation", () => {
    const errors = validateOperation(/* GraphQL */ `
      query PerformancePolicy($restaurantId: ID!) {
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

      mutation UpdatePerformancePolicy(
        $input: UpdateStaffPerformancePolicyInput!
      ) {
        updateStaffPerformancePolicy(input: $input) {
          restaurantId
          levelThresholds {
            excellentMin
            goodMin
            averageMin
            needsAttentionMin
          }
        }
      }
    `);

    expect(errors).toEqual([]);
  });

  it("does not expose protected weights in the update input", () => {
    const inputFields = schema
      .getType("UpdateStaffPerformancePolicyInput")
      .getFields();
    const thresholdFields = schema
      .getType("StaffPerformanceLevelThresholdsInput")
      .getFields();

    expect(Object.keys(inputFields)).toEqual([
      "restaurantId",
      "levelThresholds",
    ]);
    expect(Object.keys(thresholdFields)).toEqual([
      "excellentMin",
      "goodMin",
      "averageMin",
      "needsAttentionMin",
    ]);
  });
});
