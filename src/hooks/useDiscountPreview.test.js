import { describe, expect, it } from "vitest";
import {
  getDiscountPreviewErrorMessage,
  PREVIEW_ORDER_DISCOUNT,
} from "./useDiscountPreview";

const previewOrderDiscountSource =
  PREVIEW_ORDER_DISCOUNT?.loc?.source?.body || "";

const gqlError = (code, message = "GraphQL error") => ({
  message,
  graphQLErrors: [
    {
      message,
      extensions: { code },
    },
  ],
});

describe("PREVIEW_ORDER_DISCOUNT", () => {
  it("requests line-level promotion breakdown fields", () => {
    expect(previewOrderDiscountSource).toContain("promotionLines");

    [
      "lineId",
      "dishId",
      "menuId",
      "categoryId",
      "name",
      "promotionId",
      "promotionName",
      "promotionScope",
      "discountType",
      "discountValue",
      "discount",
    ].forEach((field) => {
      expect(previewOrderDiscountSource).toContain(field);
    });
  });
});

describe("getDiscountPreviewErrorMessage", () => {
  it("maps unauthenticated error", () => {
    expect(getDiscountPreviewErrorMessage(gqlError("UNAUTHENTICATED"))).toMatch(
      /đăng nhập/i,
    );
  });

  it("maps forbidden error", () => {
    expect(getDiscountPreviewErrorMessage(gqlError("FORBIDDEN"))).toMatch(
      /không có quyền/i,
    );
  });

  it("keeps bad user input message", () => {
    expect(
      getDiscountPreviewErrorMessage(
        gqlError("BAD_USER_INPUT", "Invalid voucher: usage limit reached"),
      ),
    ).toMatch(/usage limit/i);
  });

  it("maps minimum order message", () => {
    expect(
      getDiscountPreviewErrorMessage({
        message: "Invalid voucher: minimum order value not met",
      }),
    ).toMatch(/giá trị tối thiểu/i);
  });

  it("falls back to generic message", () => {
    expect(getDiscountPreviewErrorMessage({})).toMatch(
      /Không thể tính ưu đãi/i,
    );
  });
});
