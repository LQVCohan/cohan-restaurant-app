import { describe, expect, it } from "vitest";
import { getOvertimeActionErrorMessage } from "./OvertimePanel";

describe("getOvertimeActionErrorMessage", () => {
  it("returns permission message for FORBIDDEN", () => {
    const error = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const fallback = "fallback";

    expect(getOvertimeActionErrorMessage(error, fallback)).toBe(
      "❌ Bạn không có quyền thực hiện thao tác này.",
    );
  });

  it("returns session message for UNAUTHENTICATED", () => {
    const error = {
      networkError: {
        result: { errors: [{ extensions: { code: "UNAUTHENTICATED" } }] },
      },
    };
    const fallback = "fallback";

    expect(getOvertimeActionErrorMessage(error, fallback)).toBe(
      "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  });

  it("returns fallback for non-auth graphql errors", () => {
    const error = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    const fallback = "❌ Hành động thất bại";

    expect(getOvertimeActionErrorMessage(error, fallback)).toBe(fallback);
  });
});
