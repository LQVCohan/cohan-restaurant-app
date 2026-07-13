import { describe, expect, it } from "vitest";
import { mergePublicReservationIntervals } from "../../graphql/resolvers/reservation/query.js";

describe("mergePublicReservationIntervals", () => {
  it("merges overlapping and adjacent busy intervals", () => {
    const result = mergePublicReservationIntervals([
      {
        start: "2026-07-14T05:30:00.000Z",
        end: "2026-07-14T06:30:00.000Z",
      },
      {
        start: "2026-07-14T06:00:00.000Z",
        end: "2026-07-14T07:00:00.000Z",
      },
      {
        start: "2026-07-14T07:00:00.000Z",
        end: "2026-07-14T07:30:00.000Z",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe("2026-07-14T05:30:00.000Z");
    expect(result[0].end.toISOString()).toBe("2026-07-14T07:30:00.000Z");
  });

  it("keeps separated intervals independent", () => {
    const result = mergePublicReservationIntervals([
      {
        start: "2026-07-14T08:00:00.000Z",
        end: "2026-07-14T09:00:00.000Z",
      },
      {
        start: "2026-07-14T10:00:00.000Z",
        end: "2026-07-14T11:00:00.000Z",
      },
    ]);

    expect(result).toHaveLength(2);
  });

  it("drops malformed intervals", () => {
    const result = mergePublicReservationIntervals([
      { start: "invalid", end: "2026-07-14T09:00:00.000Z" },
      {
        start: "2026-07-14T10:00:00.000Z",
        end: "2026-07-14T09:00:00.000Z",
      },
    ]);

    expect(result).toEqual([]);
  });
});
