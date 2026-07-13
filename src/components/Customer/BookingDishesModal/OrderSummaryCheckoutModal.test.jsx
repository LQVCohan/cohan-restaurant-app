import { describe, expect, it } from "vitest";
import {
  getCheckoutLocationErrorMessage,
  isCheckoutContactValid,
  validateCheckoutShipping,
} from "./OrderSummaryCheckoutModal";

describe("checkout contact validation", () => {
  it("accepts a valid email without phone or full name", () => {
    const shipping = {
      fullName: "",
      phone: "",
      email: "khach@example.com",
      address: "123 Nguyễn Huệ, Quận 1",
      deliveryMethod: "delivery",
    };

    expect(isCheckoutContactValid(shipping)).toBe(true);
    expect(validateCheckoutShipping(shipping)).toBe("");
  });

  it("accepts a valid phone without email or full name", () => {
    const shipping = {
      fullName: "",
      phone: "0901234567",
      email: "",
      address: "123 Nguyễn Huệ, Quận 1",
      deliveryMethod: "delivery",
    };

    expect(isCheckoutContactValid(shipping)).toBe(true);
    expect(validateCheckoutShipping(shipping)).toBe("");
  });

  it("rejects checkout when neither contact channel is valid", () => {
    expect(
      validateCheckoutShipping({
        phone: "123",
        email: "khong-hop-le",
        address: "123 Nguyễn Huệ, Quận 1",
        deliveryMethod: "delivery",
      }),
    ).toMatch(/email hoặc số điện thoại/i);
  });

  it("still requires an address for delivery", () => {
    expect(
      validateCheckoutShipping({
        phone: "0901234567",
        email: "",
        address: "",
        deliveryMethod: "delivery",
      }),
    ).toMatch(/địa chỉ giao hàng/i);
  });
});

describe("checkout current location feedback", () => {
  it("explains when location permission is denied", () => {
    expect(getCheckoutLocationErrorMessage({ code: 1 })).toMatch(/chưa cấp quyền/i);
  });

  it("explains when geolocation times out", () => {
    expect(getCheckoutLocationErrorMessage({ code: 3 })).toMatch(/quá thời gian/i);
  });

  it("returns a safe fallback for unknown errors", () => {
    expect(getCheckoutLocationErrorMessage({ code: 99 })).toMatch(/không thể lấy địa chỉ/i);
  });
});
