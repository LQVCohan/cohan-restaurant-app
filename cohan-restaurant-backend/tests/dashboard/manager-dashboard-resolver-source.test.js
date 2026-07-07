import { describe, expect, it } from "vitest";
import resolvers from "../../graphql/resolvers/index.js";
import dashboardResolvers from "../../graphql/resolvers/dashboard/index.js";
import orderResolvers from "../../graphql/resolvers/order/index.js";

describe("manager dashboard resolver source", () => {
  it("uses the dashboard module instead of the legacy order query", () => {
    expect(orderResolvers.Query.managerDashboard).toBeUndefined();
    expect(resolvers.Query.managerDashboard).toBe(
      dashboardResolvers.Query.managerDashboard,
    );
  });
});
