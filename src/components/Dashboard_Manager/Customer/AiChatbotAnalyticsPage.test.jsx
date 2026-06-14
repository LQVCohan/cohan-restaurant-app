import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AiChatbotAnalyticsPage from "./AiChatbotAnalyticsPage";

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: (...args) => useQueryMock(...args) };
});

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: () => ({
    restaurantOptions: [{ id: "r1", name: "R1" }],
    selectedRestaurantId: "r1",
    setSelectedRestaurantId: vi.fn(),
    restaurantsLoading: false,
    hasRestaurants: true,
  }),
}));

const wrap = (ui) => render(ui);

const analyticsData = {
  aiChatbotAnalytics: {
    totalConversations: 1,
    totalMessages: 2,
    openConversations: 1,
    handoffRequested: 0,
    resolvedHandoffs: 0,
    fallbackResponses: 0,
    lowConfidenceResponses: 0,
    handoffConversionRate: 0,
    averageMessagesPerConversation: 2,
    averageHandoffResolutionMinutes: null,
    topIntents: [{ intent: "menu", count: 1 }],
    messagesByRole: [{ role: "assistant", count: 1 }],
    rateLimitStatus: [{ action: "askAiChatbot", max: 20, windowMs: 1000 }],
    pendingSuggestions: 1,
    notHelpfulFeedback: 1,
    activeSafetyRules: 1,
    evaluationCaseCount: 1,
    riskySignals: [{ code: "SAFETY_BLOCK_SPIKE", level: "low", count: 1 }],
    recentQualityQueue: [{ id: "q1", type: "fallback_response", label: "Fallback happened", detail: "", createdAt: new Date().toISOString() }],
  },
};

describe("AiChatbotAnalyticsPage", () => {
  it("renders loading", () => {
    useQueryMock.mockReturnValue({ loading: true, error: null, data: null, refetch: vi.fn() });
    wrap(<AiChatbotAnalyticsPage />);
    expect(screen.getByText(/đang tải dữ liệu chatbot/i)).toBeInTheDocument();
  });

  it("renders analytics cards and sections", () => {
    useQueryMock.mockReturnValue({ loading: false, error: null, refetch: vi.fn(), data: analyticsData });
    wrap(<AiChatbotAnalyticsPage />);
    expect(screen.getByText("Khách hỏi về gì?")).toBeInTheDocument();
    expect(screen.getByText("Giới hạn hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Cần ưu tiên xử lý")).toBeInTheDocument();
    expect(screen.getByText("Việc cần rà soát")).toBeInTheDocument();
    expect(screen.getByText(/Nội dung bị chặn tăng/)).toBeInTheDocument();
    expect(screen.getByText(/Cần bổ sung câu trả lời/)).toBeInTheDocument();
    expect(screen.getByText("Cuộc trò chuyện")).toBeInTheDocument();
  });

  it("changes range filter", () => {
    useQueryMock.mockReturnValue({ loading: false, error: null, data: { aiChatbotAnalytics: { totalConversations: 0, totalMessages: 0, openConversations: 0, handoffRequested: 0, resolvedHandoffs: 0, fallbackResponses: 0, lowConfidenceResponses: 0, handoffConversionRate: 0, averageMessagesPerConversation: 0, averageHandoffResolutionMinutes: null, topIntents: [], messagesByRole: [], rateLimitStatus: [], pendingSuggestions: 0, notHelpfulFeedback: 0, activeSafetyRules: 0, evaluationCaseCount: 0, riskySignals: [], recentQualityQueue: [] } }, refetch: vi.fn() });
    wrap(<AiChatbotAnalyticsPage />);
    fireEvent.change(screen.getByDisplayValue("7 ngày"), { target: { value: "30" } });
    expect(screen.getByDisplayValue("30 ngày")).toBeInTheDocument();
  });
});
