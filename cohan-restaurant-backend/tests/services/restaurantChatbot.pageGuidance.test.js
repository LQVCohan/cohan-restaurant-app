import { describe, expect, it } from "vitest";
import { __testables } from "../../src/services/ai/restaurantChatbot.service.js";

const {
  applyPageAwareGuidance,
  buildRoleNavigationActions,
  enrichPageAwareOptions,
  filterRoleAwareActions,
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

const staffPages = [
  ["/staff", "Tổng quan nhân viên"],
  ["/staff/dashboard", "Tổng quan nhân viên"],
  ["/staff/orders", "Xử lý đơn hàng"],
  ["/staff/reservation-changes", "Yêu cầu đổi đặt bàn"],
  ["/staff/kitchen", "Màn hình bếp"],
  ["/staff/performance", "Hiệu suất làm việc"],
  ["/staff/schedule", "Lịch làm việc"],
  ["/staff/attendance", "Chấm công"],
  ["/staff/leave", "Đơn nghỉ phép"],
  ["/staff/profile", "Hồ sơ nhân viên"],
  ["/staff/notifications", "Thông báo nhân viên"],
  ["/staff/contacts", "Liên lạc nội bộ"],
  ["/staff/ai-handoff", "Hỗ trợ khách từ chatbot"],
  ["/staff/payslips", "Phiếu lương"],
  ["/staff/settings", "Cài đặt nhân viên"],
];

describe("restaurant chatbot app page context", () => {
  it.each(customerPages)("recognizes customer route %s as %s", (pathname, label) => {
    expect(resolveCustomerPage(pathname)).toMatchObject({ pathname, label });
  });

  it.each(staffPages)("recognizes staff route %s as %s", (pathname, label) => {
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

  it("adds staff current-page context without trusting a client role", () => {
    const enriched = enrichPageAwareOptions({
      message: "tôi cần làm gì tiếp theo",
      user: { roleName: "server" },
      pageContext: {
        pathname: "/staff/orders",
        userRole: "customer",
      },
    });

    expect(enriched.page).toMatchObject({
      key: "staff-orders",
      label: "Xử lý đơn hàng",
    });
    expect(enriched.options.pageContext.featureMatches[0]).toMatchObject({
      key: "current-page-staff-orders",
      path: "/staff/orders",
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

describe("restaurant chatbot role-aware navigation actions", () => {
  it("returns order shortcuts for order staff but not kitchen shortcuts", () => {
    const actions = buildRoleNavigationActions({
      message: "bạn có thể giúp gì",
      user: { roleName: "server" },
      page: resolveCustomerPage("/staff/dashboard"),
    });
    const hrefs = actions.map((action) => action.href);

    expect(hrefs).toContain("/staff/orders");
    expect(hrefs).toContain("/staff/reservation-changes");
    expect(hrefs).not.toContain("/staff/kitchen");
  });

  it("returns the kitchen button only to a kitchen role", () => {
    expect(
      buildRoleNavigationActions({
        message: "mở màn hình bếp",
        user: { roleName: "chef" },
        page: resolveCustomerPage("/staff/dashboard"),
      }),
    ).toEqual([
      expect.objectContaining({
        type: "link",
        label: "Mở màn hình bếp",
        href: "/staff/kitchen",
      }),
    ]);

    expect(
      buildRoleNavigationActions({
        message: "mở màn hình bếp",
        user: { roleName: "customer" },
        page: resolveCustomerPage("/"),
      }),
    ).toEqual([]);
  });

  it("returns direct leave and customer checkout buttons", () => {
    expect(
      buildRoleNavigationActions({
        message: "tôi muốn xin nghỉ phép",
        user: { roleName: "server" },
        page: resolveCustomerPage("/staff/schedule"),
      }),
    ).toEqual([
      expect.objectContaining({ href: "/staff/leave", label: "Mở đơn nghỉ phép" }),
    ]);

    expect(
      buildRoleNavigationActions({
        message: "cách thanh toán",
        user: { roleName: "customer" },
        page: resolveCustomerPage("/cart"),
      }),
    ).toEqual([
      expect.objectContaining({ href: "/checkout", label: "Đi tới thanh toán" }),
    ]);
  });

  it("returns generic customer shortcuts without staff routes", () => {
    const actions = buildRoleNavigationActions({
      message: "bạn có thể giúp gì",
      user: { roleName: "customer" },
      page: resolveCustomerPage("/"),
    });

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/restaurants" }),
        expect.objectContaining({ type: "openCart" }),
        expect.objectContaining({ href: "/orders" }),
      ]),
    );
    expect(actions.some((action) => String(action.href).startsWith("/staff"))).toBe(false);
  });

  it("filters forged staff, manager and admin actions using the authenticated role", () => {
    const forged = {
      ...response,
      actions: [
        { type: "link", label: "Orders", href: "/staff/orders" },
        { type: "link", label: "Kitchen", href: "/staff/kitchen" },
        { type: "link", label: "Manager", href: "/manager" },
        { type: "link", label: "Admin", href: "/admin/dashboard" },
        { type: "link", label: "Restaurants", href: "/restaurants" },
      ],
    };

    expect(
      filterRoleAwareActions(forged, { roleName: "customer" }).actions,
    ).toEqual([
      { type: "link", label: "Restaurants", href: "/restaurants" },
    ]);

    const serverHrefs = filterRoleAwareActions(forged, {
      roleName: "server",
    }).actions.map((action) => action.href);
    expect(serverHrefs).toContain("/staff/orders");
    expect(serverHrefs).not.toContain("/staff/kitchen");
    expect(serverHrefs).not.toContain("/manager");

    const chefHrefs = filterRoleAwareActions(forged, {
      roleName: "chef",
    }).actions.map((action) => action.href);
    expect(chefHrefs).toContain("/staff/kitchen");
    expect(chefHrefs).not.toContain("/staff/orders");
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

  it("anchors staff how-to answers to the current staff page", () => {
    const result = guide(
      "/staff/leave",
      "tôi cần làm gì tiếp theo",
      {
        ...response,
        answer: "Điền thời gian nghỉ và lý do rồi gửi đơn.",
        intent: "navigation",
      },
    );

    expect(result.answer).toBe(
      "Bạn đang ở trang Đơn nghỉ phép. Tiếp tục từ đây:\nĐiền thời gian nghỉ và lý do rồi gửi đơn.",
    );
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
