import { describe, expect, it } from "vitest";

import { validateShiftRules } from "./scheduleHelpers";

describe("validateShiftRules", () => {
  it("allows overlapping templates for different employee groups", () => {
    const result = validateShiftRules([
      {
        type: "morning",
        label: "Full-time sáng",
        startTime: "07:00",
        endTime: "15:00",
      },
      {
        type: "afternoon",
        label: "Part-time cao điểm",
        startTime: "11:00",
        endTime: "15:00",
      },
      {
        type: "evening",
        label: "Full-time tối",
        startTime: "15:00",
        endTime: "23:00",
      },
    ]);

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("still rejects invalid and cross-day template values", () => {
    const result = validateShiftRules([
      {
        type: "morning",
        label: "Ca rỗng",
        startTime: "07:00",
        endTime: "07:00",
      },
      {
        type: "evening",
        label: "Ca qua ngày",
        startTime: "23:00",
        endTime: "07:00",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Ca rỗng: giờ kết thúc phải khác giờ bắt đầu.");
    expect(result.errors).toContain("Ca qua ngày: cấu hình quy tắc ca không hỗ trợ qua ngày.");
  });
});
