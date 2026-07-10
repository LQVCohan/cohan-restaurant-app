import { describe, expect, it } from "vitest";
import resolvers from "../../graphql/resolvers/index.js";

describe("resolver index role type wiring", () => {
  it("maps lean ParentRole _id values through the root resolver map", () => {
    expect(resolvers.ParentRole.id({ _id: "parent-staff" })).toBe(
      "parent-staff",
    );
  });
});
