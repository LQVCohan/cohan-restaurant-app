import { describe, expect, it, vi } from "vitest";
import {
  SCHEDULE_PUBLICATION_POINT_LOOKUP_SORT,
  applySchedulePublicationPointLookupSort,
  isSchedulePublicationPointLookup,
} from "../../models/schedule-publication.model.js";

describe("SchedulePublication point lookup ordering", () => {
  it("detects a publication lookup that contains one shift time", () => {
    expect(
      isSchedulePublicationPointLookup({
        restaurantId: "restaurant-1",
        periodStart: { $lte: new Date("2026-07-20T08:00:00.000Z") },
        periodEnd: { $gte: new Date("2026-07-20T08:00:00.000Z") },
      }),
    ).toBe(true);
  });

  it("prioritizes the narrowest and most recently updated containing window", () => {
    const sort = vi.fn();
    const query = {
      getFilter: () => ({
        periodStart: { $lte: new Date("2026-07-20T08:00:00.000Z") },
        periodEnd: { $gte: new Date("2026-07-20T08:00:00.000Z") },
      }),
      getOptions: () => ({}),
      sort,
    };

    expect(applySchedulePublicationPointLookupSort(query)).toBe(true);
    expect(sort).toHaveBeenCalledWith(SCHEDULE_PUBLICATION_POINT_LOOKUP_SORT);
  });

  it("does not replace an explicit caller sort", () => {
    const sort = vi.fn();
    const query = {
      getFilter: () => ({
        periodStart: { $lte: new Date("2026-07-20T08:00:00.000Z") },
        periodEnd: { $gte: new Date("2026-07-20T08:00:00.000Z") },
      }),
      getOptions: () => ({ sort: { createdAt: -1 } }),
      sort,
    };

    expect(applySchedulePublicationPointLookupSort(query)).toBe(false);
    expect(sort).not.toHaveBeenCalled();
  });
});
