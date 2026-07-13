import { describe, expect, it } from "vitest";
import {
  isTechnicalErrorMessage,
  toUserFacingErrorMessage,
} from "./userFacingError";

describe("userFacingError", () => {
  it("hides GraphQL scalar and internal identifier details", () => {
    const raw =
      'Variable "$input" got invalid value at input.startDate; DateTime cannot represent value ObjectId 64ad4f7b8ac9c32100112233';
    expect(isTechnicalErrorMessage(raw)).toBe(true);
    expect(toUserFacingErrorMessage(raw, "Dữ liệu chưa hợp lệ.")).toBe(
      "Dữ liệu chưa hợp lệ.",
    );
  });

  it("preserves useful business messages", () => {
    expect(toUserFacingErrorMessage("Số điện thoại đã được sử dụng.")).toBe(
      "Số điện thoại đã được sử dụng.",
    );
  });
});
