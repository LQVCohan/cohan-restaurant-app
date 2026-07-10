import { describe, expect, it } from "vitest";
import { __testables } from "../../src/services/ai/restaurantChatbot.service.js";

const {
  applyPageAwareGuidance,
  enrichPageAwareOptions,
  removeCurrentPageAction,
  resolveCustomerPage,
} = __testables;

const response = {
  answer: "Quy trình đặt bàn chung.",
  intent: "reservationHelp",
  actions: [{ type: "link", label: "Chọn nhà hàng", href: "/restaurants" }],
  sources: [],
};

const guide = (pathname, message = "làm sao để đặt bàn", customResponse = response) => {
  const enriched = enrichPageAwareOptions({
    message,
    pageContext: { pathname },
  });
  return applyPageAwareGuidance({
    response: customResponse,
    options: enriched.options,
    page: enriched.page,
  });
};

const customerPages = [
  ["/", "Trang chủ"],
  ["/contact", "Trung tâm hỗ trợ"],
  ["/search", "Tìm kiếm"],
  ["/verify-email", "Xác minh tài khoản"],
  ["/verify-email/confirm", "Xác minh tài khoản"],
  ["/verify-phone/confirm", "Xác minh tài khoản"],
  ["/verify-account/confirm", "Xác minh tài khoản"],
  ["/track-order/public-token", "Theo dõi đơn công khai"],
  ["/for-you", "Gợi ý cho tôi"],
  ["/cart", "Giỏ hàng"],
  ["/wallet", "Ví của tôi"],
  ["/orders", "Đơn hàng của tôi"],
  ["/track-delivery/order-1", "Theo dõi giao hàng"],
  ["/restaurants", "Danh sách nhà hàng"],
  ["/combos", "Combo ưu đãi"],
  ["/restaurant/resto-1", "Thông tin nhà hàng"],
  ["/restaurant/resto-1/layout", "Sơ đồ bàn"],
  ["/scan-table", "Quét QR bàn"],
  ["/table/resto-1/table-1", "Phiên phục vụ tại bàn"],
  ["/vr/table/table-1", "Xem bàn 360°"],
  ["/cus-menu", "Thực đơn"],
  ["/checkout", "Thanh toán"],
  ["/food/food-1", "Chi tiết món ăn"],
  ["/coupons", "Kho Coupon"],
  ["/coupons/resto-1", "Kho Coupon"],
  ["/favorites/user-1", "Yêu thích"],
  ["/address-book/user-1", "Sổ địa chỉ"],
  ["/help-center/user-1", "Trợ giúp tài khoản"],
  ["/notifications", "Thông báo"],
  ["/profile", "Hồ sơ của tôi"],
];

describe("restaurant chatbot customer page context", () => {
  it.each(customerPages)("recognizes %s as %s", (pathname, label) => {
    expect(resolveCustomerPage(pathname)).toMatchObject({ pathname, label });
  });

  it("adds the current page as the first safe feature match", () => {
    const enriched = enrichPageAwareOptions({
      message: "cách thanh toán",
      pageContext: {
        pathname: "/cart",
        featureMatches: [
          { key: "checkout", label: "Thanh toán", path: "/checkout" },
        ],
      },
    });

    expect(enriched.page).toMatchObject({ key: "cart", label: "Giỏ hàng" });
    expect(enriched.options.pageContext.featureMatches[0]).toMatchObject({
      key: "current-page-cart",
      label: "Trang hiện tại: Giỏ hàng",
      path: "/cart",
      actionType: "link",
    });
    expect(enriched.options.pageContext.featureMatches[0].description).toContain(
      "bỏ qua các bước điều hướng đã hoàn thành",
    );
    expect(enriched.options.pageContext.featureMatches[1]).toMatchObject({
      key: "checkout",
    });
  });

  it("removes the internal current-page action before returning to the UI", () => {
    const page = resolveCustomerPage("/cart");
    const result = removeCurrentPageAction(
      {
        ...response,
        actions: [
          {
            type: "link",
            label: "Trang hiện tại: Giỏ hàng",
            href: "/cart",
            icon: "current-page-cart",
          },
          { type: "link", label: "Thanh toán", href: "/checkout" },
        ],
      },
      page,
    );

    expect(result.actions).toEqual([
      { type: "link", label: "Thanh toán", href: "/checkout" },
    ]);
  });

  it("derives restaurant scope from customer routes", () => {
    expect(
      enrichPageAwareOptions({
        message: "hướng dẫn đặt bàn",
        pageContext: { pathname: "/restaurant/resto-1/layout" },
      }).options,
    ).toMatchObject({
      restaurantId: "resto-1",
      pageContext: { restaurantId: "resto-1" },
    });

    expect(
      enrichPageAwareOptions({
        message: "coupon dùng sao",
        pageContext: { pathname: "/coupons/resto-2" },
      }).options,
    ).toMatchObject({
      restaurantId: "resto-2",
      pageContext: { restaurantId: "resto-2" },
    });
  });

  it("derives the selected menu item from the food detail URL", () => {
    const enriched = enrichPageAwareOptions({
      message: "cách thêm món này vào giỏ",
      pageContext: { pathname: "/food/food-1" },
    });

    expect(enriched.options.pageContext.selectedMenuItem).toMatchObject({
      id: "food-1",
    });
  });
});

describe("restaurant chatbot page-aware guidance", () => {
  it("continues from the restaurant list instead of restarting navigation", () => {
    const result = guide("/restaurants");

    expect(result.answer).toContain("Bạn đang ở trang Danh sách nhà hàng");
    expect(result.answer).toContain("1. Chọn nhà hàng bạn muốn đặt trong danh sách");
    expect(result.answer).toContain("5. Kiểm tra thông tin và xác nhận đặt bàn");
    expect(result.actions).toEqual(response.actions);
  });

  it("continues from restaurant detail with the booking action", () => {
    const result = guide("/restaurant/resto-1");

    expect(result.answer).toContain("Bạn đang ở trang Thông tin nhà hàng");
    expect(result.answer).toContain("1. Bấm “Đặt bàn” hoặc “Xem sơ đồ bàn”");
    expect(result.answer).not.toContain("Chọn nhà hàng bạn muốn đặt trong danh sách");
  });

  it("continues from the table layout with date, time and party size", () => {
    const result = guide("/restaurant/resto-1/layout?date=2026-07-12");

    expect(result.answer).toContain("Bạn đang ở trang Sơ đồ bàn");
    expect(result.answer).toContain("1. Chọn ngày, giờ và số người");
    expect(result.answer).not.toContain("Bấm “Đặt bàn”");
  });

  it("anchors other how-to answers to the current customer page", () => {
    const result = guide(
      "/cart",
      "cách thanh toán",
      {
        ...response,
        answer: "Kiểm tra món rồi chuyển sang bước xác nhận đơn.",
        intent: "checkout",
      },
    );

    expect(result.answer).toBe(
      "Bạn đang ở trang Giỏ hàng. Tiếp tục từ đây:\nKiểm tra món rồi chuyển sang bước xác nhận đơn.",
    );
    expect(result.intent).toBe("checkout");
  });

  it("does not duplicate a page acknowledgement already returned by AI", () => {
    const customResponse = {
      ...response,
      answer: "Bạn đang ở trang Thanh toán. Hãy kiểm tra địa chỉ nhận hàng.",
      intent: "checkout",
    };

    expect(guide("/checkout", "tôi cần làm gì tiếp theo", customResponse)).toBe(
      customResponse,
    );
  });

  it("keeps unrelated answers unchanged", () => {
    const result = guide("/restaurants", "có món chay không");

    expect(result).toBe(response);
  });
});