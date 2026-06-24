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
  it("renders on customer browsing pages", () => {
    renderWizard({ route: "/restaurants" });

    expect(screen.getByRole("region", { name: /wizard hỗ trợ chọn món hôm nay/i })).toBeInTheDocument();
    expect(screen.getByText("Hôm nay ăn gì?")).toBeInTheDocument();
    expect(screen.getByText("Hôm nay bạn muốn ăn kiểu gì?")).toBeInTheDocument();
  });

  it("does not render on checkout and manager pages", () => {
    const { rerender } = renderWizard({ route: "/checkout" });
    expect(screen.queryByText("Hôm nay ăn gì?")).not.toBeInTheDocument();

    rerender(
      <AuthContext.Provider value={{ user: { id: "manager-1", fullName: "Manager" }, isAuthenticated: true }}>
        <MemoryRouter initialEntries={["/manager"]}>
          <TodayMealWizard />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByText("Hôm nay ăn gì?")).not.toBeInTheDocument();
  });

  it("minimizes and restores from launcher", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /thu nhỏ wizard/i }));
    expect(screen.getByRole("button", { name: /mở wizard chọn món nhanh/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mở wizard chọn món nhanh/i }));
    expect(screen.getByRole("region", { name: /wizard hỗ trợ chọn món hôm nay/i })).toBeInTheDocument();
  });

  it("calls backend AI and renders meal suggestions after completing all steps", async () => {
    renderWizard({ route: "/restaurant/restaurant-1" });

    fireEvent.click(screen.getByRole("button", { name: /nhanh gọn/i }));
    await waitFor(() => expect(screen.getByText("Ngân sách khoảng bao nhiêu?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /100k - 200k/i }));
    await waitFor(() => expect(screen.getByText("Khẩu vị hôm nay?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /ít cay/i }));
    await waitFor(() => expect(screen.getByText("Ăn cho mấy người?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /2 người/i }));
    fireEvent.click(screen.getByRole("button", { name: /hỏi ai/i }));

    await waitFor(() => expect(mocks.askAiChatbot).toHaveBeenCalledTimes(1));
    const variables = mocks.askAiChatbot.mock.calls[0][0].variables;
    expect(variables.input.restaurantId).toBe("restaurant-1");
    expect(variables.input.pageContext.source).toBe("todayMealWizard");
    expect(variables.input.message).toContain("Linh");
    expect(variables.input.message).toContain("100k đến 200k");
    expect(variables.input.message).toContain("ít cay");
    expect(variables.input.message).toContain("2 người");

    expect(await screen.findByText("Gợi ý từ AI")).toBeInTheDocument();
    expect(screen.getByText(/combo 2 người/i)).toBeInTheDocument();
    expect(screen.getByText("Combo no nhanh")).toBeInTheDocument();
  });

  it("can hand off the same prompt to the full chatbot after backend AI result", async () => {
    renderWizard({ route: "/restaurant/restaurant-1" });

    fireEvent.click(screen.getByRole("button", { name: /nhanh gọn/i }));
    await waitFor(() => expect(screen.getByText("Ngân sách khoảng bao nhiêu?")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /100k - 200k/i }));
    await waitFor(() => expect(screen.getByText("Khẩu vị hôm nay?")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /ít cay/i }));
    await waitFor(() => expect(screen.getByText("Ăn cho mấy người?")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /2 người/i }));
    fireEvent.click(screen.getByRole("button", { name: /hỏi ai/i }));

    await screen.findByText("Gợi ý từ AI");
    fireEvent.click(screen.getByRole("button", { name: /hỏi tiếp trong chat ai/i }));

    expect(openAiMenuAssistant).toHaveBeenCalledTimes(1);
    const payload = openAiMenuAssistant.mock.calls[0][0];
    expect(payload.restaurantId).toBe("restaurant-1");
    expect(payload.autoSend).toBe(true);
    expect(payload.message).toContain("100k đến 200k");
  });
});
