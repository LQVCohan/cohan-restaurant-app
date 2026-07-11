import { describe, expect, it, vi } from "vitest";
import {
  hasValidCheckoutContact,
  withCheckoutContactGuard,
} from "../graphql/resolvers/order/checkoutContactGuard.js";

describe("checkout contact guard", () => {
  it("accepts email-only checkout", () => {
    expect(
      hasValidCheckoutContact({
        shipping: { email: "khach@example.com", phone: "" },
      }),
    ).toBe(true);
  });

  it("accepts phone-only checkout", () => {
    expect(
      hasValidCheckoutContact({
        shipping: { phone: "0901234567", email: "" },
      }),
    ).toBe(true);
  });

  it("rejects invalid or missing contact before calling checkout", async () => {
    const createCheckoutOrders = vi.fn();
    const guarded = withCheckoutContactGuard({ createCheckoutOrders });

    await expect(
      guarded.createCheckoutOrders(
        null,
        { input: { shipping: { phone: "123", email: "sai" } } },
        {},
        null,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "CHECKOUT_CONTACT_REQUIRED" },
    });
    expect(createCheckoutOrders).not.toHaveBeenCalled();
  });

  it("delegates to canonical checkout when one contact is valid", async () => {
    const createCheckoutOrders = vi.fn(async () => ({ ok: true }));
    const guarded = withCheckoutContactGuard({ createCheckoutOrders });

    await expect(
      guarded.createCheckoutOrders(
        null,
        { input: { shipping: { phone: "", email: "khach@example.com" } } },
        {},
        null,
      ),
    ).resolves.toEqual({ ok: true });
    expect(createCheckoutOrders).toHaveBeenCalledOnce();
  });
});
