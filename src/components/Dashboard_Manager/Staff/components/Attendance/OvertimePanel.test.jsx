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

  it("returns already reviewed message for overtime re-review attempts", () => {
    const error = {
      graphQLErrors: [{ message: "ATTENDANCE_OVERTIME_ALREADY_REVIEWED" }],
    };

    expect(getOvertimeActionErrorMessage(error, "fallback")).toBe(
      "⚠️ Bản ghi tăng ca này đã được review trước đó. Vui lòng tải lại danh sách.",
    );
  });

  it("returns payroll lock message for locked payroll periods", () => {
    const error = new Error("ATTENDANCE_OVERTIME_PAYROLL_PERIOD_LOCKED");

    expect(getOvertimeActionErrorMessage(error, "fallback")).toBe(
      "⚠️ Kỳ lương đã chốt/khóa/thanh toán, không thể thay đổi tăng ca.",
    );
  });

  it("returns fallback for non-auth graphql errors", () => {
    const error = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    const fallback = "❌ Hành động thất bại";

    expect(getOvertimeActionErrorMessage(error, fallback)).toBe(fallback);
  });
});
