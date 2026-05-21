import { describe, expect, it } from "vitest";
import { buildReturnReasonFromForm } from "./OrderModal";

describe("OrderModal return reason preset builder", () => {
  it("uses selected preset reason (Món nguội)", () => {
    expect(buildReturnReasonFromForm({ reasonPreset: "Món nguội", reason: "" })).toContain("Món nguội");
  });

  it("requires custom reason when preset is Khác", () => {
    expect(() => buildReturnReasonFromForm({ reasonPreset: "Khác", reason: "" })).toThrow(
      "Vui lòng nhập lý do trả lại món.",
    );
  });

  it("uses customer preset reason (Khách đổi ý)", () => {
    expect(buildReturnReasonFromForm({ reasonPreset: "Khách đổi ý", reason: "" })).toContain("Khách đổi ý");
  });

  it("requires reason when missing both preset and custom text", () => {
    expect(() => buildReturnReasonFromForm({ reasonPreset: "", reason: "" })).toThrow(
      "Vui lòng chọn hoặc nhập lý do trả lại món.",
    );
  });
});
