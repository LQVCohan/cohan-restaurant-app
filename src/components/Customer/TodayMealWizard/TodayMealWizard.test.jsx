import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import TodayMealWizard from "./TodayMealWizard";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";

const mocks = vi.hoisted(() => ({
  askAiChatbot: vi.fn(),
}));

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [mocks.askAiChatbot, { loading: false }],
}));

vi.mock("@/utils/aiChatbotEvents", () => ({
  openAiMenuAssistant: vi.fn(),
}));

const renderWizard = ({ route = "/restaurants", user = { id: "customer-1", fullName: "Linh" } } = {}) =>
  render(
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user) }}>
      <MemoryRouter initialEntries={[route]}>
        <TodayMealWizard />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

const openMealWizard = () => {
  fireEvent.click(screen.getByRole("button", { name: /mở tiện ích nhanh/i }));
  fireEvent.click(screen.getByRole("button", { name: /chọn món nhanh/i }));
};

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  mocks.askAiChatbot.mockResolvedValue({
    data: {
      askAiChatbot: {
        answer: "Nên chọn combo 2 người, ít cay, giá vừa phải.",
        intent: "menu",
        confidence: 0.86,
        quickReplies: [],
        isFallback: false,
        conversationId: "conv-1",
        answerMessageId: "msg-1",
        actions: [],
        sources: [
          {
            type: "menuItem",
            id: "dish-1",
            label: "Combo no nhanh",
            formattedPrice: "129.000đ",
            restaurantId: "restaurant-1",
            currentPrice: 129000,
          },
        ],
        contextSummary: { restaurantCount: 1, menuItemCount: 1, couponCount: 0, orderCount: 0, reservationCount: 0 },
        handoffSuggested: false,
        handoffReason: null,
        handoffMessage: null,
      },
    },
  });
});

describe("TodayMealWizard", () => {
  it("starts as a compact utility launcher on customer browsing pages", () => {
    renderWizard({ route: "/restaurants" });

    expect(screen.getByRole("button", { name: /mở tiện ích nhanh/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /wizard hỗ trợ chọn món hôm nay/i })).not.toBeInTheDocument();
  });

  it("opens the utility palette before entering the meal wizard", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /mở tiện ích nhanh/i }));
    expect(screen.getByRole("navigation", { name: /tiện ích nhanh/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /kho coupon/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /combo tiết kiệm/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /chọn món nhanh/i }));
    expect(screen.getByRole("region", { name: /wizard hỗ trợ chọn món hôm nay/i })).toBeInTheDocument();
    expect(screen.getByText("Bạn muốn bữa ăn kiểu nào?")).toBeInTheDocument();
  });

  it("does not render on checkout and manager pages", () => {
    const { rerender } = renderWizard({ route: "/checkout" });
    expect(screen.queryByRole("button", { name: /mở tiện ích nhanh/i })).not.toBeInTheDocument();

    rerender(
      <AuthContext.Provider value={{ user: { id: "manager-1", fullName: "Manager" }, isAuthenticated: true }}>
        <MemoryRouter initialEntries={["/manager"]}>
          <TodayMealWizard />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole("button", { name: /mở tiện ích nhanh/i })).not.toBeInTheDocument();
  });

  it("minimizes back to the utility launcher", () => {
    renderWizard();
    openMealWizard();

    fireEvent.click(screen.getByRole("button", { name: /thu nhỏ wizard/i }));
    expect(screen.getByRole("button", { name: /mở tiện ích nhanh/i })).toBeInTheDocument();
  });

  it("automatically calls backend AI and renders meal suggestions after completing all steps", async () => {
    renderWizard({ route: "/restaurant/restaurant-1" });
    openMealWizard();

    fireEvent.click(screen.getByRole("button", { name: /nhanh gọn/i }));
    await waitFor(() => expect(screen.getByText("Bạn muốn chi khoảng bao nhiêu?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /100k - 200k/i }));
    await waitFor(() => expect(screen.getByText("Khẩu vị hôm nay là gì?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /ít cay/i }));
    await waitFor(() => expect(screen.getByText("Bữa này dành cho mấy người?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /2 người/i }));

    await waitFor(() => expect(mocks.askAiChatbot).toHaveBeenCalledTimes(1));
    const variables = mocks.askAiChatbot.mock.calls[0][0].variables;
    expect(variables.input.restaurantId).toBe("restaurant-1");
    expect(variables.input.pageContext.source).toBe("todayMealWizard");
    expect(variables.input.pageContext.trigger).toBe("wizard_complete_or_click");
    expect(variables.input.message).toContain("Linh");
    expect(variables.input.message).toContain("100k-200k");
    expect(variables.input.message).toContain("ít cay");
    expect(variables.input.message).toContain("2 người");

    expect(await screen.findByText("Gợi ý từ AI")).toBeInTheDocument();
    expect(screen.getByText(/combo 2 người/i)).toBeInTheDocument();
    expect(screen.getByText("Combo no nhanh")).toBeInTheDocument();
  });

  it("can hand off the same prompt to the full chatbot after backend AI result", async () => {
    renderWizard({ route: "/restaurant/restaurant-1" });
    openMealWizard();

    fireEvent.click(screen.getByRole("button", { name: /nhanh gọn/i }));
    await waitFor(() => expect(screen.getByText("Bạn muốn chi khoảng bao nhiêu?")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /100k - 200k/i }));
    await waitFor(() => expect(screen.getByText("Khẩu vị hôm nay là gì?")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /ít cay/i }));
    await waitFor(() => expect(screen.getByText("Bữa này dành cho mấy người?")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /2 người/i }));

    await screen.findByText("Gợi ý từ AI");
    fireEvent.click(screen.getByRole("button", { name: /hỏi thêm trong chat ai/i }));

    expect(openAiMenuAssistant).toHaveBeenCalledTimes(1);
    const payload = openAiMenuAssistant.mock.calls[0][0];
    expect(payload.restaurantId).toBe("restaurant-1");
    expect(payload.autoSend).toBe(true);
    expect(payload.message).toContain("100k-200k");
  });
});
