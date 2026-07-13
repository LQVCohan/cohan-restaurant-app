import { describe, expect, it } from "vitest";
import { toLeaveDateTime } from "./useLeaveManagement";

describe("toLeaveDateTime", () => {
  it("serializes a date-only form value for the GraphQL DateTime scalar", () => {
    expect(toLeaveDateTime("2026-07-13")).toBe("2026-07-13T00:00:00.000Z");
  });

  it("keeps an existing timestamp unchanged", () => {
    expect(toLeaveDateTime("2026-07-13T08:30:00.000Z")).toBe(
      "2026-07-13T08:30:00.000Z",
    );
  });
});
