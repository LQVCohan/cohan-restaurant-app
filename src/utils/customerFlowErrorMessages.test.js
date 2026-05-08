import {
  getCartActionErrorMessage,
  getCheckoutActionErrorMessage,
  getCustomerActionErrorMessage,
} from "./customerFlowErrorMessages";

describe("customer flow auth error messages", () => {
  it("cart forbidden/unauth/fallback", () => {
    const f = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const u = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    const b = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    expect(getCartActionErrorMessage(f, "x")).toMatch(/giỏ hàng/i);
    expect(getCartActionErrorMessage(u, "x")).toMatch(/đăng nhập lại/i);
    expect(getCartActionErrorMessage(b, "fallback")).toBe("fallback");
  });

  it("customer/checkout forbidden/unauth", () => {
    const f = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const u = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    expect(getCustomerActionErrorMessage(f, "x")).toMatch(/khách hàng/i);
    expect(getCustomerActionErrorMessage(u, "x")).toMatch(/đăng nhập lại/i);
    expect(getCheckoutActionErrorMessage(f, "x")).toMatch(/checkout/i);
    expect(getCheckoutActionErrorMessage(u, "x")).toMatch(/đăng nhập lại/i);
  });
});
