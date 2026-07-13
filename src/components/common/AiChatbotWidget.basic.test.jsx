import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiChatbotWidget from "./AiChatbotWidget";
import { OPEN_AI_CHATBOT_EVENT } from "@/utils/aiChatbotEvents";
import { OPEN_CUSTOMER_CART_EVENT } from "@/utils/cartEvents";

const mocks = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  askMutationSpy: vi.fn(),
  handoffMutationSpy: vi.fn(),
  guestRepliesSpy: vi.fn(),
  guestMessageMutationSpy: vi.fn(),
  submitFeedbackMutationSpy: vi.fn(),
  publicSettingsQuerySpy: vi.fn(),
  customerMenuItemQuerySpy: vi.fn(),
  publicRestaurantQuerySpy: vi.fn(),
  menuItemLiveStateQuerySpy: vi.fn(),
  addCartMutationSpy: vi.fn(),
  addToCartSpy: vi.fn(),
  guestSendLoadingState: false,
  authUser: { id: "user-1" },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "resto-1" }),
  useLocation: () => ({ pathname: "/restaurant/resto-1" }),
  useNavigate: () => mocks.navigateSpy,
}));
vi.mock("@apollo/client/react", () => ({
  useMutation: vi.fn((mutation) => {
    const body = mutation?.loc?.source?.body || "";
    if (body.includes("AskAiChatbot"))
      return [mocks.askMutationSpy, { loading: false }];
    if (body.includes("RequestAiChatbotHandoff"))
      return [mocks.handoffMutationSpy, { loading: false }];
    if (body.includes("SendAiChatbotGuestMessage"))
      return [
        mocks.guestMessageMutationSpy,
        { loading: mocks.guestSendLoadingState },
      ];
    if (body.includes("SubmitAiChatbotAnswerFeedback"))
      return [mocks.submitFeedbackMutationSpy, { loading: false }];
    if (body.includes("AddCartItemFromAiChatbot"))
      return [mocks.addCartMutationSpy, { loading: false }];
    return [vi.fn(), { loading: false }];
  }),
  useLazyQuery: vi.fn(() => [
    mocks.guestRepliesSpy,
    { loading: false, data: null, error: null },
  ]),
  useQuery: vi.fn((query, options) => {
    const body = query?.loc?.source?.body || "";
    if (body.includes("PublicAiChatbotSettings"))
      return mocks.publicSettingsQuerySpy(options);
    if (body.includes("CustomerMenuItemForAiChatbot"))
      return mocks.customerMenuItemQuerySpy(options);
    if (body.includes("PublicRestaurantByIdForAiChatbot"))
      return mocks.publicRestaurantQuerySpy(options);
    if (body.includes("AiMenuItemLiveState"))
      return mocks.menuItemLiveStateQuerySpy(options);
    return { data: null, loading: false, error: null };
  }),
}));
vi.mock("@/context/CartProvider", () => ({
  useCart: () => ({ addToCart: mocks.addToCartSpy }),
}));
vi.mock("@/context/AuthContext", () => ({
  AuthContext: React.createContext({
    get user() {
      return mocks.authUser;
    },
  }),
}));

const open = () =>
  fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
const send = (t) => {
  fireEvent.change(
    screen.getByPlaceholderText(/Hỏi AI gợi ý món|Hỏi về món ăn/i),
    { target: { value: t } },
  );
  fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
};

beforeEach(() => {
  mocks.navigateSpy.mockReset();
  window.localStorage.setItem("cohan_ai_guest_id", "guest-1");
  mocks.guestSendLoadingState = false;
  mocks.askMutationSpy.mockResolvedValue({
    data: {
      askAiChatbot: {
        answer: "Trợ lý đã tiếp nhận.",
        quickReplies: [],
        actions: [],
        contextSummary: null,
        conversationId: "conv-1",
      },
    },
  });
  mocks.handoffMutationSpy.mockResolvedValue({
    data: {
      requestAiChatbotHandoff: {
        ok: true,
        handoffRequested: true,
        message: "Đã gửi yêu cầu gặp nhân viên.",
      },
    },
  });
  mocks.guestMessageMutationSpy.mockResolvedValue({
    data: {
      sendAiChatbotGuestMessage: {
        ok: true,
        conversationId: "conv-1",
        message: { id: "g1", content: "ok" },
      },
    },
  });
  mocks.submitFeedbackMutationSpy.mockResolvedValue({
    data: { submitAiChatbotAnswerFeedback: { id: "f1", rating: "helpful" } },
  });
  mocks.guestRepliesSpy.mockResolvedValue({
    data: { aiChatbotGuestReplies: { replies: [] } },
  });
  mocks.publicSettingsQuerySpy.mockReturnValue({
    data: {
      publicAiChatbotSettings: {
        enabled: true,
        welcomeMessage: "Xin chào",
        starterQuickReplies: ["Gợi ý món bán chạy cho tôi"],
        handoffEnabled: true,
        handoffUnavailableMessage: "Không hỗ trợ",
      },
    },
  });
  mocks.addCartMutationSpy.mockResolvedValue({
    data: {
      addCartItem: {
        id: "cart-1",
        items: [
          {
            id: "line-1",
            menuItemId: "food-1",
            servingVariantKey: "small",
            note: "it cay",
            holdExpiresAt: null,
            holdStatus: null,
          },
        ],
      },
    },
  });
  mocks.customerMenuItemQuerySpy.mockReturnValue({
    loading: false,
    data: {
      customerMenuItem: {
        id: "food-1",
        name: "Phở bò",
        basePrice: 90000,
        thumbImage: "/pho.jpg",
        restaurantId: "resto-1",
        menuId: "menu-1",
        categoryId: "cat-1",
        status: "available",
        inventoryStatus: "in_stock",
        servingVariants: [
          { key: "small", name: "Nhỏ", price: 90000 },
          { key: "large", name: "Lớn", price: 110000 },
        ],
      },
    },
  });
  mocks.publicRestaurantQuerySpy.mockReturnValue({
    loading: false,
    data: {
      publicRestaurant: {
        id: "resto-1",
        name: "Euro Bistro House",
        canOrder: true,
        openingStatus: "open",
      },
    },
  });
  mocks.menuItemLiveStateQuerySpy.mockReturnValue({
    loading: false,
    data: {
      menuItemLiveState: {
        maxAvailableQty: 5,
        outOfStock: false,
        blocked: false,
        reservedCartQty: 0,
      },
    },
  });
  mocks.addToCartSpy.mockReset();
  mocks.authUser = { id: "user-1" };

});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();

});

describe("AiChatbotWidget basic", () => {


  it("sends current route/page context with chatbot request", async () => {
    mocks.authUser = { id: "user-1", roleName: "customer" };
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("đơn hàng ở đâu");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), {
      timeout: 1500,
    });
    const input = mocks.askMutationSpy.mock.calls[0][0].variables.input;
    expect(input.pageContext).toMatchObject({
      pathname: "/restaurant/resto-1",
      restaurantId: "resto-1",
      userRole: "customer",
    });
    expect(input.pageContext.featureMatches.some((entry) => entry.key === "restaurant-detail")).toBe(true);
    expect(input.pageContext.featureMatches.some((entry) => entry.key === "orders")).toBe(true);
  });

  it("feature navigation answer/actions render safely and open cart action still works", async () => {
    const openCartSpy = vi.fn();
    window.addEventListener(OPEN_CUSTOMER_CART_EVENT, openCartSpy);
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Bạn có thể mở giỏ hàng.",
          intent: "cart",
          quickReplies: [],
          actions: [
            { type: "openCart", label: "Mở giỏ hàng", href: "/cart" },
            { type: "link", label: "Mở đơn hàng", href: "/orders" },
            { type: "link", label: "javascript:alert(1)", href: "javascript:alert(1)" },
            { type: "link", label: "data bad", href: "data:text/html,bad" },
            { type: "link", label: "mailto bad", href: "mailto:test@example.com" },
            { type: "link", label: "tel bad", href: "tel:123" },
            { type: "link", label: "protocol bad", href: "//evil.test" },
          ],
          sources: [],
          contextSummary: null,
          conversationId: "conv-1",
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("mở giỏ hàng");
    await waitFor(() => expect(screen.getByRole("button", { name: "Mở giỏ hàng" })).toBeInTheDocument(), { timeout: 1500 });
    expect(screen.getByRole("button", { name: "Mở đơn hàng" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "javascript:alert(1)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "data bad" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "mailto bad" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "tel bad" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "protocol bad" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở giỏ hàng" }));
    expect(openCartSpy).toHaveBeenCalledTimes(1);
    expect(mocks.navigateSpy).not.toHaveBeenCalledWith("javascript:alert(1)");
    window.removeEventListener(OPEN_CUSTOMER_CART_EVENT, openCartSpy);
  });


  it("renders Phase 24 action cards, navigates internal links, and sends search actions safely", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Bạn có thể đặt món theo các bước.",
          quickReplies: [],
          actions: [
            { type: "link", label: "Xem menu", href: "/cus-menu", description: "Mở trang menu", icon: "menu" },
            { type: "search", label: "Tìm phở bò", href: "phở bò", description: "Tìm trong chatbot" },
          ],
          sources: [],
          contextSummary: null,
          conversationId: "conv-1",
        },
      },
    });
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Kết quả tìm kiếm",
          quickReplies: [],
          actions: [],
          sources: [],
          contextSummary: null,
          conversationId: "conv-1",
        },
      },
    });

    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("làm sao đặt món");
    await waitFor(() => expect(screen.getByText("Mở trang menu")).toBeInTheDocument(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Xem menu/i }));
    expect(mocks.navigateSpy).toHaveBeenCalledWith("/cus-menu");

    open();
    fireEvent.click(screen.getByRole("button", { name: /Tìm phở bò/i }));
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(2), { timeout: 1500 });
    expect(mocks.askMutationSpy.mock.calls[1][0].variables.input.message).toBe("phở bò");
  });

  it("renders guided reservation and ordering actions from backend", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "Chọn ngày giờ và số người.", quickReplies: [], actions: [{ type: "link", label: "Mở trang đặt bàn", href: "/restaurant/resto-1/layout" }], sources: [], contextSummary: null, conversationId: "conv-1" } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("tôi muốn đặt bàn");
    await waitFor(() => expect(screen.getByRole("button", { name: "Mở trang đặt bàn" })).toBeInTheDocument(), { timeout: 1500 });
    cleanup();

    mocks.askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "Mở menu rồi kiểm tra giỏ.", quickReplies: [], actions: [{ type: "link", label: "Xem menu", href: "/cus-menu" }, { type: "openCart", label: "Mở giỏ hàng", href: "" }], sources: [], contextSummary: null, conversationId: "conv-1" } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("thanh toán thế nào");
    await waitFor(() => expect(screen.getByRole("button", { name: "Xem menu" })).toBeInTheDocument(), { timeout: 1500 });
    expect(screen.getByRole("button", { name: "Mở giỏ hàng" })).toBeInTheDocument();
  });


  it("Phase 25 renders realistic backend action cards safely", async () => {
    const openCartSpy = vi.fn();
    window.addEventListener(OPEN_CUSTOMER_CART_EVENT, openCartSpy);
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Bạn có thể đặt món, đặt bàn hoặc gặp nhân viên.",
          intent: "checkout",
          quickReplies: [],
          actions: [
            { type: "link", label: "Xem menu", href: "/cus-menu", description: "Bắt đầu đặt món", icon: "menu", priority: 1 },
            { type: "link", label: "Xem menu trùng", href: "/cus-menu", description: "Không render trùng", icon: "menu", priority: 2 },
            { type: "openCart", label: "Mở giỏ hàng", href: "", description: "Kiểm tra giỏ", icon: "cart", priority: 2 },
            { type: "link", label: "Mở trang đặt bàn", href: "/restaurant/resto-1/layout", description: "Đặt bàn", icon: "table", priority: 3 },
            { type: "link", label: "Đơn hàng của tôi", href: "/orders", description: "Theo dõi đơn", icon: "orders", priority: 4 },
            { type: "handoff", label: "Gặp nhân viên", href: "/contact", description: "Nhờ người thật hỗ trợ", icon: "support", priority: 5 },
            { type: "search", label: "Tìm món chay", href: "món chay không cay", description: "Tìm bằng chatbot", icon: "search", priority: 6 },
            { type: "link", label: "Hồ sơ của tôi", href: "/profile", description: "Thông tin tài khoản", icon: "profile", priority: 7 },
            { type: "link", label: "javascript bad", href: "javascript:alert(1)" },
            { type: "link", label: "data bad", href: "data:text/html,bad" },
            { type: "link", label: "mailto bad", href: "mailto:test@example.com" },
            { type: "link", label: "tel bad", href: "tel:123" },
            { type: "link", label: "protocol bad", href: "//evil.test" },
            { type: "delete", label: "Xóa đơn", href: "/orders/1" },
          ],
          sources: [],
          contextSummary: null,
          conversationId: "conv-1",
        },
      },
    });
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Kết quả tìm món chay.",
          quickReplies: [],
          actions: [],
          sources: [],
          contextSummary: null,
          conversationId: "conv-1",
        },
      },
    });

    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("Làm sao đặt món và đặt bàn?");

    await waitFor(() => expect(screen.getByRole("button", { name: /Xem menu/i })).toBeInTheDocument(), { timeout: 1500 });
    const actionRegion = screen.getByLabelText("Hành động gợi ý");
    expect(actionRegion.querySelectorAll("button")).toHaveLength(5);
    expect(actionRegion.querySelector("button strong")?.textContent).toBe("Xem menu");
    expect(screen.queryByRole("button", { name: /Xem menu trùng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /javascript bad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /data bad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mailto bad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tel bad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /protocol bad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xóa đơn/i })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Gọi nhân viên hỗ trợ/i }).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Mở giỏ hàng/i }));
    expect(openCartSpy).toHaveBeenCalledTimes(1);

    open();
    fireEvent.click(screen.getByRole("button", { name: /Đơn hàng của tôi/i }));
    expect(mocks.navigateSpy).toHaveBeenCalledWith("/orders");

    open();
    expect(
      screen.getAllByRole("button", { name: /Gọi nhân viên hỗ trợ/i })[0],
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tìm món chay/i }));
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(2), { timeout: 1500 });
    expect(mocks.askMutationSpy.mock.calls[1][0].variables.input.message).toBe("món chay không cay");

    window.removeEventListener(OPEN_CUSTOMER_CART_EVENT, openCartSpy);
  });


  it("normal AI flow before handoff", async () => {
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("Xin chào");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), {
      timeout: 1500,
    });
    expect(await screen.findByText("Trợ lý đã tiếp nhận.")).toBeInTheDocument();
  });

  it("shows friendly message when ask is rate limited", async () => {
    mocks.askMutationSpy.mockRejectedValueOnce({
      graphQLErrors: [
        {
          message: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.",
          extensions: { code: "RATE_LIMITED" },
        },
      ],
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("Xin chào");
    await waitFor(
      () =>
        expect(
          screen.getByText(
            "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.",
          ),
        ).toBeInTheDocument(),
      { timeout: 1500 },
    );
  });

  it("prevents rapid quick-reply double submit while in flight", async () => {
    let release;
    mocks.askMutationSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    const quick = screen.getByRole("button", {
      name: "Gợi ý món bán chạy cho tôi",
    });
    fireEvent.click(quick);
    fireEvent.click(quick);
    expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1);
    await act(async () =>
      release({
        data: {
          askAiChatbot: {
            answer: "ok",
            quickReplies: [],
            actions: [],
            contextSummary: null,
            conversationId: "conv-1",
          },
        },
      }),
    );
  });

  it("disables input while guest send is loading", () => {
    mocks.guestSendLoadingState = true;
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    expect(
      screen.getByPlaceholderText(/Hỏi AI gợi ý món|Hỏi về món ăn/i),
    ).toBeDisabled();
  });

  it("hides handoff action when handoffEnabled=false", async () => {
    mocks.publicSettingsQuerySpy.mockReturnValue({
      data: {
        publicAiChatbotSettings: {
          enabled: true,
          welcomeMessage: "Xin chào",
          starterQuickReplies: ["Gợi ý món bán chạy cho tôi"],
          handoffEnabled: false,
          handoffUnavailableMessage: "Không hỗ trợ",
        },
      },
    });
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "ok",
          quickReplies: [],
          actions: [
            { type: "link", label: "Mở menu", href: "/cus-menu" },
            { type: "handoff", label: "Gặp nhân viên", href: "/support" },
          ],
          contextSummary: null,
          conversationId: "conv-1",
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("Xin chào");
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Mở menu" }),
        ).toBeInTheDocument(),
      { timeout: 1500 },
    );
    expect(
      screen.queryByRole("button", { name: "Gặp nhân viên" }),
    ).not.toBeInTheDocument();
  });

  it("Xem món uses food detail path with restaurantId", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              formattedPrice: "90.000đ",
              isAvailable: true,
              restaurantId: "resto-1",
              currentPrice: 90000,
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(
      () => expect(screen.getByText("Phở bò")).toBeInTheDocument(),
      { timeout: 1500 },
    );
    fireEvent.click(screen.getByRole("button", { name: "Xem món" }));
    expect(mocks.navigateSpy).toHaveBeenCalledWith(
      "/food/food-1?restaurantId=resto-1",
      expect.objectContaining({
        state: expect.objectContaining({
          restaurantId: "resto-1",
          dish: expect.objectContaining({ id: "food-1", name: "Phở bò" }),
        }),
      }),
    );
  });

  it("menu card shows Chọn món and does not add directly", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              formattedPrice: "90.000đ",
              isAvailable: true,
              restaurantId: "resto-1",
              currentPrice: 90000,
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(
      () => expect(screen.getByText("Phở bò")).toBeInTheDocument(),
      { timeout: 1500 },
    );
    expect(
      screen.queryByRole("button", { name: "Thêm vào giỏ" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Chọn món" }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    expect(
      screen.getByRole("button", { name: "Xem chi tiết món" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Trợ lý A.I hỗ trợ nhà hàng" })
        .className,
    ).toContain("is-expanded");
  });

  it("menu intent uses compact answer and shows menu cards", async () => {
    const longAnswer =
      "1. Phở bò là món bán chạy. 2. Bún chả cũng rất phù hợp. 3. Gỏi cuốn nhẹ bụng.";
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: longAnswer,
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              formattedPrice: "90.000đ",
              isAvailable: true,
              restaurantId: "resto-1",
              currentPrice: 90000,
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món bán chạy");
    await waitFor(
      () =>
        expect(
          screen.getByText(
            "Mình tìm được vài món phù hợp. Bạn bấm Chọn món để chọn tùy chọn trước khi thêm vào giỏ.",
          ),
        ).toBeInTheDocument(),
      { timeout: 1500 },
    );
    expect(screen.queryByText(longAnswer)).not.toBeInTheDocument();
    expect(screen.getByText("Phở bò")).toBeInTheDocument();
  });

  it("selected detail hides duplicate menu cards and quick actions", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: ["Món khác"],
          actions: [{ type: "link", label: "Mở menu", href: "/cus-menu" }],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              restaurantId: "resto-1",
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    expect(
      screen.getByRole("button", { name: "Quay lại gợi ý" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Phở bò")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Món khác" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mở menu" }),
    ).not.toBeInTheDocument();
  });

  it("restaurant cannot order shows clear reason and does not call addCartItem", async () => {
    mocks.publicRestaurantQuerySpy.mockReturnValue({
      loading: false,
      data: {
        publicRestaurant: {
          id: "resto-1",
          name: "Euro Bistro House",
          canOrder: false,
          openingStatus: "closed",
        },
      },
    });
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              restaurantId: "resto-1",
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    expect(
      screen.getByText(/Nhà hàng hiện chưa nhận đặt món/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái: Đã đóng cửa/)).toBeInTheDocument();
    const addBtn = screen.getByRole("button", { name: "Thêm vào giỏ" });
    expect(addBtn).toBeDisabled();
    fireEvent.click(addBtn);
    expect(mocks.addCartMutationSpy).not.toHaveBeenCalled();
  });

  it("quantity unit display explains serving units", async () => {
    mocks.customerMenuItemQuerySpy.mockReturnValue({
      loading: false,
      data: {
        customerMenuItem: {
          id: "food-1",
          name: "Thịt bò",
          basePrice: 45000,
          thumbImage: "/beef.jpg",
          restaurantId: "resto-1",
          menuId: "menu-1",
          categoryId: "cat-1",
          status: "available",
          inventoryStatus: "in_stock",
          servingVariants: [
            {
              key: "100g",
              mode: "weight",
              sellQty: 100,
              sellUnit: "g",
              name: "Gói 100g",
              price: 45000,
            },
          ],
        },
      },
    });
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Thịt bò",
              restaurantId: "resto-1",
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý thịt bò");
    await waitFor(() =>
      expect(screen.getByText("Thịt bò")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    expect(screen.getByText("Số lượng: 1 x 100g")).toBeInTheDocument();
    expect(
      screen.getByText(/Món này đang tính theo đơn vị của tùy chọn/),
    ).toBeInTheDocument();
  });

  it("unavailable/optioned items do not show add button", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "A",
              isAvailable: false,
              restaurantId: "resto-1",
              currentPrice: 90000,
            },
            {
              type: "menuItem",
              id: "food-2",
              label: "B",
              isAvailable: true,
              restaurantId: "resto-1",
              currentPrice: 90000,
              hasOptions: true,
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("A")).toBeInTheDocument(), {
      timeout: 1500,
    });
    expect(
      screen.queryByRole("button", { name: "Thêm vào giỏ" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Chọn món" }).length,
    ).toBeGreaterThan(0);
  });

  it("open event opens chatbot", async () => {
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_AI_CHATBOT_EVENT));
    });
    await waitFor(
      () =>
        expect(
          screen.getByRole("region", {
            name: "Trợ lý A.I hỗ trợ nhà hàng",
          }),
        ).toBeInTheDocument(),
      { timeout: 1500 },
    );
  });

  it("open event with restaurantId autoSend passes restaurantId to ask mutation", async () => {
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_AI_CHATBOT_EVENT, {
          detail: {
            message: "Món dưới 100k",
            autoSend: true,
            restaurantId: "resto-2",
          },
        }),
      );
    });
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), {
      timeout: 1500,
    });
    expect(mocks.askMutationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            message: "Món dưới 100k",
            restaurantId: "resto-2",
          }),
        }),
      }),
    );
  });

  it("open event with restaurantId autoSend false stores context for later send", async () => {
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_AI_CHATBOT_EVENT, {
          detail: {
            message: "Món chay",
            autoSend: false,
            restaurantId: "resto-2",
          },
        }),
      );
    });
    await waitFor(
      () => expect(screen.getByDisplayValue("Món chay")).toBeInTheDocument(),
      { timeout: 1500 },
    );
    expect(mocks.askMutationSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), {
      timeout: 1500,
    });
    expect(mocks.askMutationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({ restaurantId: "resto-2" }),
        }),
      }),
    );
  });

  it("while in-flight, event does not double-send", async () => {
    let release;
    mocks.askMutationSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("Xin chào");
    expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_AI_CHATBOT_EVENT, {
          detail: { message: "Món bán chạy", autoSend: true },
        }),
      );
    });
    expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1);
    await act(async () =>
      release({
        data: {
          askAiChatbot: {
            answer: "ok",
            quickReplies: [],
            actions: [],
            contextSummary: null,
            conversationId: "conv-1",
          },
        },
      }),
    );
  });

  it("expanded detail add-to-cart calls backend and updates cart", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              restaurantId: "resto-1",
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    expect(screen.getByRole("button", { name: "Nhỏ" })).toBeInTheDocument();
    fireEvent.change(
      screen.getByPlaceholderText("Ví dụ: ít cay, không hành..."),
      { target: { value: "it cay" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    await waitFor(() => expect(mocks.addCartMutationSpy).toHaveBeenCalled());
    expect(mocks.addCartMutationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: expect.objectContaining({
            userId: "user-1",
            restaurantId: "resto-1",
            menuItemId: "food-1",
            servingVariantKey: "small",
            quantity: 1,
            note: "it cay",
          }),
        },
      }),
    );
    expect(mocks.addToCartSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dishId: "food-1",
        restaurantId: "resto-1",
        backendCartId: "cart-1",
        backendCartItemId: "line-1",
        servingVariantKey: "small",
        note: "it cay",
      }),
    );
    expect(
      screen.getByText("Đã thêm Phở bò vào giỏ hàng."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Xem giỏ hàng" }),
    ).toBeInTheDocument();
  });

  it("does not add while live state is loading", async () => {
    mocks.menuItemLiveStateQuerySpy.mockImplementation(() => ({
      loading: true,
      data: null,
    }));
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              restaurantId: "resto-1",
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    const addBtn = screen.getByRole("button", { name: "Thêm vào giỏ" });
    expect(addBtn).toBeDisabled();
    fireEvent.click(addBtn);
    expect(mocks.addCartMutationSpy).not.toHaveBeenCalled();
    mocks.menuItemLiveStateQuerySpy.mockReset();
  });

  it("does not add when quantity exceeds available", async () => {
    mocks.menuItemLiveStateQuerySpy.mockReturnValue({
      loading: false,
      data: {
        menuItemLiveState: {
          maxAvailableQty: 1,
          outOfStock: false,
          blocked: false,
          reservedCartQty: 0,
        },
      },
    });
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              restaurantId: "resto-1",
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    const plusBtn = screen.getAllByRole("button", { name: "+" })[0];
    fireEvent.click(plusBtn);
    expect(screen.getByText("Số lượng: 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Thêm vào giỏ" }),
    ).not.toBeDisabled();
  });

  it("does not add if missing login", async () => {
    mocks.authUser = null;
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: null,
          conversationId: "conv-1",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Phở bò",
              restaurantId: "resto-1",
            },
          ],
        },
      },
    });
    render(
      <AiChatbotWidget
        testOverrides={{ disableSocket: true, disablePolling: true }}
      />,
    );
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    expect(
      screen.getByText("Vui lòng đăng nhập để thêm món vào giỏ."),
    ).toBeInTheDocument();
    expect(mocks.addCartMutationSpy).not.toHaveBeenCalled();
  });


  it("custom event override keeps input, pageContext, and conversation storage scoped", async () => {
    window.localStorage.setItem("cohan_ai_conversation_id:resto-2", "conv-resto-2-old");
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Đã hiểu nhà hàng 2.",
          intent: "general",
          quickReplies: [],
          actions: [],
          sources: [],
          contextSummary: null,
          scopeMode: "restaurant",
          resolvedRestaurantId: "resto-2",
          scopeCandidates: [{ restaurantId: "resto-2", restaurantName: "Nhà hàng 2", reason: "event" }],
          conversationId: "conv-resto-2-new",
        },
      },
    });

    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_AI_CHATBOT_EVENT, {
          detail: { message: "Mở nhà hàng 2", restaurantId: "resto-2", autoSend: true },
        }),
      );
    });

    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    const input = mocks.askMutationSpy.mock.calls[0][0].variables.input;
    expect(input.restaurantId).toBe("resto-2");
    expect(input.pageContext.restaurantId).toBe("resto-2");
    expect(input.conversationId).toBe("conv-resto-2-old");
    await waitFor(() => expect(window.localStorage.getItem("cohan_ai_conversation_id:resto-2")).toBe("conv-resto-2-new"));
  });

  it("renders global menu card restaurant names from scoped sources", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Gợi ý",
          intent: "menu",
          quickReplies: [],
          actions: [],
          contextSummary: { menuItemCount: 1, couponCount: 0, orderCount: 0 },
          scopeMode: "global",
          resolvedRestaurantId: null,
          scopeCandidates: [],
          conversationId: "conv-global",
          sources: [
            {
              type: "menuItem",
              id: "food-1",
              label: "Bún bò",
              restaurantId: "resto-2",
              restaurantName: "Huế Kitchen",
              formattedPrice: "80.000đ",
            },
          ],
        },
      },
    });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("Nhà hàng nào có bún bò?");
    await waitFor(() => expect(screen.getByText("Bún bò")).toBeInTheDocument(), { timeout: 1500 });
    expect(screen.getByText("Huế Kitchen")).toBeInTheDocument();
  });

  it("submits inline helpful feedback with resolved restaurant scope", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "Câu trả lời có thể đánh giá.",
          intent: "general",
          quickReplies: [],
          actions: [],
          sources: [],
          contextSummary: null,
          scopeMode: "restaurant",
          resolvedRestaurantId: "resto-2",
          scopeCandidates: [],
          conversationId: "conv-feedback",
          answerMessageId: "msg-feedback",
        },
      },
    });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("xin chào");
    await waitFor(() => expect(screen.getByRole("button", { name: "Hữu ích" })).toBeInTheDocument(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: "Hữu ích" }));
    await waitFor(() => expect(mocks.submitFeedbackMutationSpy).toHaveBeenCalledTimes(1));
    expect(mocks.submitFeedbackMutationSpy.mock.calls[0][0].variables.input).toMatchObject({
      restaurantId: "resto-2",
      conversationId: "conv-feedback",
      messageId: "msg-feedback",
      rating: "helpful",
    });
  });

});
