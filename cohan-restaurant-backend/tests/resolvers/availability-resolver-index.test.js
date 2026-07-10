import { describe, expect, it } from "vitest";
import resolvers from "../../graphql/resolvers/index.js";

describe("resolver index availability type wiring", () => {
  it("exposes computed AvailabilityWindow fields through the root resolver map", () => {
    expect(
      resolvers.AvailabilityWindow.effectiveStatus({
        status: "open",
        registrationModeSnapshot: "manual",
      }),
    ).toBe("open");
    expect(
      resolvers.AvailabilityWindow.registrationMode({
        registrationModeSnapshot: "auto",
      }),
    ).toBe("auto");
  });
});
