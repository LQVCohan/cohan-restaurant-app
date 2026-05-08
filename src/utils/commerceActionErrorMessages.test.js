import {
  getOrderActionErrorMessage,
  getPaymentActionErrorMessage,
  getReservationActionErrorMessage,
} from "./commerceActionErrorMessages";

describe("commerce auth error messages", () => {
  it("order forbidden/unauthenticated/fallback", () => {
    const forbidden = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const unauth = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    const bad = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    expect(getOrderActionErrorMessage(forbidden, "f")).toMatch(/đơn hàng/i);
    expect(getOrderActionErrorMessage(unauth, "f")).toMatch(/đăng nhập lại/i);
    expect(getOrderActionErrorMessage(bad, "fallback")).toBe("fallback");
  });
  it("payment forbidden/unauthenticated", () => {
    const forbidden = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const unauth = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    expect(getPaymentActionErrorMessage(forbidden, "f")).toMatch(/thanh toán/i);
    expect(getPaymentActionErrorMessage(unauth, "f")).toMatch(/đăng nhập lại/i);
  });
  it("reservation forbidden/unauthenticated", () => {
    const forbidden = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const unauth = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    expect(getReservationActionErrorMessage(forbidden, "f")).toMatch(/đặt bàn/i);
    expect(getReservationActionErrorMessage(unauth, "f")).toMatch(/đăng nhập lại/i);
  });
});
