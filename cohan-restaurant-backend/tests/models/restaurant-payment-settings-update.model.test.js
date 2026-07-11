import { describe, expect, it } from "vitest";
import { protectPaymentSettingsUpdate } from "../../models/restaurant.model.js";

describe("restaurant payment settings update guard", () => {
  it("removes payment settings from mixed profile updates", () => {
    expect(
      protectPaymentSettingsUpdate({
        $set: {
          name: "Nhà hàng mới",
          paymentSettings: {
            providers: [{ provider: "vnpay", mode: "production" }],
          },
        },
      }),
    ).toEqual({ $set: { name: "Nhà hàng mới" } });
  });

  it("keeps the dedicated payment settings update", () => {
    const update = {
      $set: {
        paymentSettings: {
          defaultProvider: "vnpay",
          providers: [{ provider: "vnpay", mode: "sandbox" }],
        },
      },
    };

    expect(protectPaymentSettingsUpdate(update)).toEqual(update);
  });

  it("removes nested payment settings paths from mixed updates", () => {
    expect(
      protectPaymentSettingsUpdate({
        $set: {
          description: "Mô tả mới",
          "paymentSettings.providers.1.mode": "production",
        },
      }),
    ).toEqual({ $set: { description: "Mô tả mới" } });
  });
});
