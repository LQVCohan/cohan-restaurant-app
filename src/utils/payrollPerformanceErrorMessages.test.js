import {
  getPayrollActionErrorMessage,
  getPerformanceActionErrorMessage,
} from "./payrollPerformanceErrorMessages";

describe("payroll/performance auth error messages", () => {
  it("returns permission message for FORBIDDEN", () => {
    const error = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    expect(getPayrollActionErrorMessage(error, "fallback")).toMatch(/không có quyền/i);
    expect(getPerformanceActionErrorMessage(error, "fallback")).toMatch(/không có quyền/i);
  });

  it("returns session message for UNAUTHENTICATED", () => {
    const error = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    expect(getPayrollActionErrorMessage(error, "fallback")).toMatch(/đăng nhập lại/i);
    expect(getPerformanceActionErrorMessage(error, "fallback")).toMatch(/đăng nhập lại/i);
  });

  it("returns fallback for non-auth errors", () => {
    const error = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    expect(getPayrollActionErrorMessage(error, "fallback payroll")).toBe("fallback payroll");
    expect(getPerformanceActionErrorMessage(error, "fallback performance")).toBe("fallback performance");
  });
});
