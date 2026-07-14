import { describe, expect, it } from "vitest";
import { getStaffCartCheckoutReadiness } from "./staffCartCheckout";

describe("getStaffCartCheckoutReadiness", () => {
  it("requires a draft order to be submitted before payment", () => {
    expect(
      getStaffCartCheckoutReadiness([
        { id: "draft-1", status: "pending", persisted: false },
      ]),
    ).toMatchObject({
      enabled: false,
      label: "Gửi đơn trước",
    });
  });

  it("waits for persisted items to be served", () => {
    expect(
      getStaffCartCheckoutReadiness([
        {
          id: "item-1",
          orderId: "order-1",
          persisted: true,
          status: "preparing",
        },
      ]),
    ).toMatchObject({
      enabled: false,
      label: "Chờ phục vụ",
    });
  });

  it("allows checkout after every persisted item is served", () => {
    expect(
      getStaffCartCheckoutReadiness([
        {
          id: "item-1",
          orderId: "order-1",
          persisted: true,
          status: "served",
        },
      ]),
    ).toEqual({
      enabled: true,
      label: "Thanh toán",
      reason: "",
    });
  });

  it("blocks checkout while a void request is pending", () => {
    expect(
      getStaffCartCheckoutReadiness([
        {
          id: "item-1",
          orderId: "order-1",
          persisted: true,
          status: "served",
          voidRequests: [{ status: "pending" }],
        },
      ]),
    ).toMatchObject({
      enabled: false,
      label: "Chờ xử lý",
    });
  });
});
