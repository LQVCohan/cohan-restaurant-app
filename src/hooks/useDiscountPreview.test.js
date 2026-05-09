import { describe, expect, it } from "vitest";
import { getDiscountPreviewErrorMessage } from "./useDiscountPreview";

const gqlError = (code, message = "GraphQL error") => ({
  message,
  graphQLErrors: [
    {
      message,
      extensions: { code },
    },
  ],
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
