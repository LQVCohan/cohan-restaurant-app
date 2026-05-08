import {
  getInventoryActionErrorMessage,
  getPrintSettingActionErrorMessage,
  getSupplierActionErrorMessage,
  getSupplyActionErrorMessage,
} from "./inventorySupplySupplierPrintErrorMessages";

describe("inventory/supply/supplier/print auth error messages", () => {
  it("inventory & supply forbidden/unauthenticated + fallback", () => {
    const forbidden = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const unauth = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    const bad = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    expect(getInventoryActionErrorMessage(forbidden, "f")).toMatch(/không có quyền/i);
    expect(getSupplyActionErrorMessage(forbidden, "f")).toMatch(/không có quyền/i);
    expect(getInventoryActionErrorMessage(unauth, "f")).toMatch(/đăng nhập lại/i);
    expect(getSupplyActionErrorMessage(unauth, "f")).toMatch(/đăng nhập lại/i);
    expect(getInventoryActionErrorMessage(bad, "fallback inventory")).toBe("fallback inventory");
    expect(getSupplyActionErrorMessage(bad, "fallback supply")).toBe("fallback supply");
  });

  it("supplier forbidden/unauthenticated", () => {
    const forbidden = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const unauth = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    expect(getSupplierActionErrorMessage(forbidden, "f")).toMatch(/nhà cung cấp/i);
    expect(getSupplierActionErrorMessage(unauth, "f")).toMatch(/đăng nhập lại/i);
  });

  it("print setting forbidden/unauthenticated", () => {
    const forbidden = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const unauth = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    expect(getPrintSettingActionErrorMessage(forbidden, "f")).toMatch(/thiết lập in/i);
    expect(getPrintSettingActionErrorMessage(unauth, "f")).toMatch(/đăng nhập lại/i);
  });
});
