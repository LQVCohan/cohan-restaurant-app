import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AiChatbotAnalyticsPage from "./AiChatbotAnalyticsPage";
import { AuthContext } from "@/context/AuthContext";

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: (...args) => useQueryMock(...args) };
});

const wrap = (ui) => render(<AuthContext.Provider value={{ restaurants: [{ id: "r1", name: "R1" }] }}>{ui}</AuthContext.Provider>);

describe("AiChatbotAnalyticsPage", () => {
  it("renders loading", () => {
    useQueryMock.mockReturnValue({ loading: true, error: null, data: null, refetch: vi.fn() });
    wrap(<AiChatbotAnalyticsPage />);
    expect(screen.getByText(/đang tải dữ liệu ai chatbot/i)).toBeInTheDocument();
  });

  it("renders analytics cards and sections", () => {
    useQueryMock.mockReturnValue({
      loading: false,
      error: null,
      refetch: vi.fn(),
      data: { aiChatbotAnalytics: { totalConversations: 1, totalMessages: 2, openConversations: 1, handoffRequested: 0, resolvedHandoffs: 0, fallbackResponses: 0, lowConfidenceResponses: 0, handoffConversionRate: 0, averageMessagesPerConversation: 2, averageHandoffResolutionMinutes: null, topIntents: [{ intent: "menu", count: 1 }], messagesByRole: [{ role: "assistant", count: 1 }], rateLimitStatus: [{ action: "askAiChatbot", max: 20, windowMs: 1000 }] } },
    });
    wrap(<AiChatbotAnalyticsPage />);
    expect(screen.getByText("Top intents")).toBeInTheDocument();
    expect(screen.getByText("Rate-limit policy/config")).toBeInTheDocument();
    expect(screen.getByText(/Cuộc trò chuyện AI/)).toBeInTheDocument();
  });

  it("changes range filter", () => {
    useQueryMock.mockReturnValue({ loading: false, error: null, data: { aiChatbotAnalytics: { totalConversations: 0, totalMessages: 0, openConversations: 0, handoffRequested: 0, resolvedHandoffs: 0, fallbackResponses: 0, lowConfidenceResponses: 0, handoffConversionRate: 0, averageMessagesPerConversation: 0, averageHandoffResolutionMinutes: null, topIntents: [], messagesByRole: [], rateLimitStatus: [] } }, refetch: vi.fn() });
    wrap(<AiChatbotAnalyticsPage />);
    fireEvent.change(screen.getByDisplayValue("7 ngày"), { target: { value: "30" } });
    expect(screen.getByDisplayValue("30 ngày")).toBeInTheDocument();
  });
});
