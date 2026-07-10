import { describe, expect, it } from "vitest";
import {
  getFinanceRangeError,
  getMonthDateRange,
  toLocalDateInputValue,
} from "./useFinance";

describe("useFinance date helpers", () => {
  it("keeps local calendar dates instead of shifting through UTC", () => {
    expect(toLocalDateInputValue(new Date(2026, 6, 1, 0, 30))).toBe(
      "2026-07-01",
    );
    expect(getMonthDateRange(new Date(2026, 1, 15))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("accepts preset ranges and validates custom ranges", () => {
    expect(
      getFinanceRangeError({ range: "month", dateFrom: "", dateTo: "" }),
    ).toBe("");
    expect(
      getFinanceRangeError({
        range: "custom",
        dateFrom: "2026-07-01",
        dateTo: "",
      }),
    ).toBe("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
    expect(
      getFinanceRangeError({
        range: "custom",
        dateFrom: "2026-07-11",
        dateTo: "2026-07-10",
      }),
    ).toBe("Ngày bắt đầu không được sau ngày kết thúc.");
    expect(
      getFinanceRangeError({
        range: "custom",
        dateFrom: "2026-07-01",
        dateTo: "2026-07-10",
      }),
    ).toBe("");
  });
});
