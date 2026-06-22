import { buildASTSchema } from "graphql";
import { describe, expect, it } from "vitest";
import typeDefs from "../../graphql/schema/index.js";

describe("runtime GraphQL schema for manager analyst", () => {
  it("loads every field queried by the manager analyst page", () => {
    const schema = buildASTSchema(typeDefs);
    const queryFields = schema.getQueryType()?.getFields() || {};
    const managerDashboardFields = schema.getType("ManagerDashboard")?.getFields() || {};

    expect(managerDashboardFields).toEqual(
      expect.objectContaining({
        feedbackSummary: expect.any(Object),
        feedbackItems: expect.any(Object),
        occupancyHeatmap: expect.any(Object),
        staffPerformance: expect.any(Object),
      }),
    );

    expect(queryFields).toEqual(
      expect.objectContaining({
        demandForecast: expect.any(Object),
        menuEngineeringAssistant: expect.any(Object),
        smartPromotionEngine: expect.any(Object),
      }),
    );
  });
});
