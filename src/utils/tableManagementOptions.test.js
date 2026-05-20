import { describe, expect, it } from "vitest";
import {
  TABLE_AREA_OPTIONS,
  TABLE_STATUS_OPTIONS,
  getTableAreaLabel,
  getTableStatusConfig,
} from "./tableManagementOptions";

describe("tableManagementOptions", () => {
  it("contains all expected area options", () => {
    expect(TABLE_AREA_OPTIONS.map((item) => item.value)).toEqual([
      "standard",
      "booth",
      "vip",
      "outdoor",
      "bar",
      "private",
    ]);
  });

  it("resolves area labels correctly", () => {
    expect(getTableAreaLabel("standard")).toBe("Trong nhà");
    expect(getTableAreaLabel("booth")).toBe("Booth");
    expect(getTableAreaLabel("bar")).toBe("Bar");
    expect(getTableAreaLabel("private")).toBe("Riêng");
    expect(getTableAreaLabel("unknown")).toBe("unknown");
    expect(getTableAreaLabel("")).toBe("Chưa rõ");
    expect(getTableAreaLabel(null)).toBe("Chưa rõ");
    expect(getTableAreaLabel(undefined)).toBe("Chưa rõ");
  });

  it("contains all expected status options", () => {
    expect(TABLE_STATUS_OPTIONS.map((item) => item.value)).toEqual([
      "available",
      "occupied",
      "payment_pending",
      "reserved",
      "cleaning",
      "offline",
    ]);
  });

  it("resolves status config correctly", () => {
    expect(getTableStatusConfig("available")).toMatchObject({
      text: "Trống",
      color: "success",
    });
    expect(getTableStatusConfig("payment_pending")).toMatchObject({
      text: "Chờ thanh toán",
      color: "warning",
    });
    expect(getTableStatusConfig("offline")).toMatchObject({
      text: "Tạm ngưng",
      color: "secondary",
    });
    expect(getTableStatusConfig("unknown")).toMatchObject({
      text: "unknown",
      color: "secondary",
    });
    expect(getTableStatusConfig("")).toMatchObject({
      text: "Không rõ",
      color: "secondary",
    });
    expect(getTableStatusConfig(null)).toMatchObject({
      text: "Không rõ",
      color: "secondary",
    });
    expect(getTableStatusConfig(undefined)).toMatchObject({
      text: "Không rõ",
      color: "secondary",
    });
  });

  it("does not mutate options after multiple helper calls", () => {
    const areaBefore = JSON.stringify(TABLE_AREA_OPTIONS);
    const statusBefore = JSON.stringify(TABLE_STATUS_OPTIONS);
    const areaLengthBefore = TABLE_AREA_OPTIONS.length;
    const statusLengthBefore = TABLE_STATUS_OPTIONS.length;

    getTableAreaLabel("standard");
    getTableAreaLabel("unknown");
    getTableStatusConfig("available");
    getTableStatusConfig("unknown");
    getTableStatusConfig(null);

    expect(TABLE_AREA_OPTIONS.length).toBe(areaLengthBefore);
    expect(TABLE_STATUS_OPTIONS.length).toBe(statusLengthBefore);
    expect(JSON.stringify(TABLE_AREA_OPTIONS)).toBe(areaBefore);
    expect(JSON.stringify(TABLE_STATUS_OPTIONS)).toBe(statusBefore);
  });
});
