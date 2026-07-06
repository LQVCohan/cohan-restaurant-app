import { describe, expect, it } from "vitest";
import { normalizeScheduleGraphqlVariables } from "./client";

describe("normalizeScheduleGraphqlVariables", () => {
  it("normalizes the declined acknowledgement enum before transport", () => {
    expect(
      normalizeScheduleGraphqlVariables("ShiftAcknowledgements", {
        restaurantId: "restaurant-1",
        status: "declined",
      }),
    ).toEqual({
      restaurantId: "restaurant-1",
      status: "DECLINED",
    });
  });

  it("leaves unrelated operations unchanged", () => {
    const variables = { status: "declined" };

    expect(normalizeScheduleGraphqlVariables("StaffShifts", variables)).toBe(
      variables,
    );
  });
});
