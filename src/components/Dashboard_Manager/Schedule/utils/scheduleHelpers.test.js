import { describe, expect, it } from "vitest";

import {
  resizeShiftRules,
  shiftTemplatesToRules,
  validateShiftRules,
} from "./scheduleHelpers";

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

    expect(result).toEqual({ ok: true, errors: [], message: "" });
  });

  it("allows a cross-day template and still rejects identical times", () => {
    const crossDay = validateShiftRules([
      {
        type: "morning",
        label: "Ca sáng",
        startTime: "07:00",
        endTime: "15:00",
      },
      {
        type: "night",
        label: "Ca đêm",
        startTime: "23:00",
        endTime: "07:00",
      },
    ]);

    expect(crossDay).toEqual({ ok: true, errors: [], message: "" });

    const invalid = validateShiftRules([
      {
        type: "morning",
        label: "Ca rỗng",
        startTime: "07:00",
        endTime: "07:00",
      },
      {
        type: "evening",
        label: "Ca tối",
        startTime: "15:00",
        endTime: "23:00",
      },
    ]);

    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toContain(
      "Ca rỗng: giờ kết thúc phải khác giờ bắt đầu.",
    );
  });

  it("rejects duplicated shift types", () => {
    const result = validateShiftRules([
      {
        type: "morning",
        label: "Ca 1",
        startTime: "06:00",
        endTime: "12:00",
      },
      {
        type: "morning",
        label: "Ca 2",
        startTime: "12:00",
        endTime: "18:00",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("bị trùng");
  });
});

describe("resizeShiftRules", () => {
  it("preserves edited morning and evening times when adding a third shift", () => {
    const result = resizeShiftRules(
      [
        {
          type: "morning",
          label: "Ca Sáng",
          startTime: "07:30",
          endTime: "15:30",
        },
        {
          type: "evening",
          label: "Ca Tối",
          startTime: "15:30",
          endTime: "23:30",
        },
      ],
      3,
    );

    expect(result.map((rule) => rule.type)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
    expect(result[0]).toMatchObject({ startTime: "07:30", endTime: "15:30" });
    expect(result[2]).toMatchObject({ startTime: "15:30", endTime: "23:30" });
  });

  it("preserves morning and evening when reducing from three shifts", () => {
    const result = resizeShiftRules(
      [
        {
          type: "morning",
          label: "Sáng",
          startTime: "05:00",
          endTime: "13:00",
        },
        {
          type: "afternoon",
          label: "Chiều",
          startTime: "13:00",
          endTime: "18:00",
        },
        {
          type: "evening",
          label: "Tối",
          startTime: "18:00",
          endTime: "01:00",
        },
      ],
      2,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: "morning", startTime: "05:00" });
    expect(result[1]).toMatchObject({ type: "evening", endTime: "01:00" });
  });
});

describe("shiftTemplatesToRules", () => {
  it("uses enabled backend templates as the modal source of truth", () => {
    const result = shiftTemplatesToRules([
      {
        key: "morning",
        label: "Ca mở cửa",
        startTime: "05:30",
        endTime: "13:30",
        enabled: true,
      },
      {
        key: "afternoon",
        label: "Tắt",
        startTime: "13:30",
        endTime: "18:00",
        enabled: false,
      },
      {
        key: "night",
        label: "Ca đóng cửa",
        startTime: "22:00",
        endTime: "06:00",
        enabled: true,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: "morning",
      startTime: "05:30",
      endTime: "13:30",
    });
    expect(result[1]).toMatchObject({
      type: "night",
      startTime: "22:00",
      endTime: "06:00",
    });
  });
});
