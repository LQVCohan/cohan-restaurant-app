import { describe, expect, it } from "vitest";
import {
  isCheckoutContactValid,
  validateCheckoutShipping,
} from "@/components/Customer/BookingDishesModal/OrderSummaryCheckoutModal";

describe("checkout contact validation unit gate", () => {
  const delivery = {
    address: "123 Nguyễn Huệ, Quận 1",
    deliveryMethod: "delivery",
  };

  it("accepts email without phone or full name", () => {
    const shipping = { ...delivery, fullName: "", phone: "", email: "khach@example.com" };
    expect(isCheckoutContactValid(shipping)).toBe(true);
    expect(validateCheckoutShipping(shipping)).toBe("");
  });

  it("accepts phone without email or full name", () => {
    const shipping = { ...delivery, fullName: "", phone: "0901234567", email: "" };
    expect(isCheckoutContactValid(shipping)).toBe(true);
    expect(validateCheckoutShipping(shipping)).toBe("");
  });

  it("rejects missing contact", () => {
    expect(validateCheckoutShipping({ ...delivery, phone: "123", email: "sai" })).toMatch(
      /email hoặc số điện thoại/i,
    );
  });
});
