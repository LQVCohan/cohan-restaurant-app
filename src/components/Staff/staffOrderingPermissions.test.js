import { describe, expect, it } from "vitest";
import { getStaffOrderingPermissions } from "./staffOrderingPermissions";

describe("getStaffOrderingPermissions", () => {
  it("allows a server to create and update dine-in orders", () => {
    const permissions = getStaffOrderingPermissions({ roleName: "server" });

    expect(permissions.canCreateOrder).toBe(true);
    expect(permissions.canRequestPayment).toBe(true);
    expect(permissions.canAdjustItemQuantity).toBe(true);
  });

  it("keeps cashier controls read-only when the role lacks order.update", () => {
    const permissions = getStaffOrderingPermissions({ roleName: "cashier" });

    expect(permissions.isReadOnlyRole).toBe(true);
    expect(permissions.canCreateOrder).toBe(false);
    expect(permissions.canRequestPayment).toBe(false);
    expect(permissions.canCheckout).toBe(false);
  });

  it("allows servers and elevated roles to submit staff-assisted remote orders", () => {
    expect(
      getStaffOrderingPermissions(
        { roleName: "server" },
        { isRemoteOrder: true },
      ).canCreateOrder,
    ).toBe(true);
    expect(
      getStaffOrderingPermissions(
        { roleName: "manager" },
        { isRemoteOrder: true },
      ).canCreateOrder,
    ).toBe(true);
  });

  it("keeps remote-order coupon application restricted to elevated roles", () => {
    expect(
      getStaffOrderingPermissions(
        { roleName: "server" },
        { isRemoteOrder: true },
      ).canApplyCoupon,
    ).toBe(false);
    expect(
      getStaffOrderingPermissions(
        { roleName: "manager" },
        { isRemoteOrder: true },
      ).canApplyCoupon,
    ).toBe(true);
  });
});
