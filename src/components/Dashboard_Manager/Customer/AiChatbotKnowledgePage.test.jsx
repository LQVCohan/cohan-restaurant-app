import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AiChatbotKnowledgePage from "./AiChatbotKnowledgePage";

const approveMutation = vi.fn();
const dismissMutation = vi.fn();
const reviewMutation = vi.fn();
const ignoreMutation = vi.fn();
const convertMutation = vi.fn();

const createSafetyMutation = vi.fn();
const updateSafetyMutation = vi.fn();
const deleteSafetyMutation = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (s) => s,
  useQuery: (q) => ({
    data: String(q).includes("restaurantAiChatbotKnowledgeSuggestions")
      ? { restaurantAiChatbotKnowledgeSuggestions: [{ id: "s1", question: "Q1", triggerType: "fallback", confidence: 0.2, occurrenceCount: 2, lastAskedAt: null, suggestedTitle: "T1", suggestedContent: "", category: "", tags: [], status: "pending" }] }
      : String(q).includes("restaurantAiChatbotAnswerFeedback")
        ? { restaurantAiChatbotAnswerFeedback: [{ id: "f1", question: "Bad answer?", answer: "A", reason: "No", confidence: 0.2, rating: "not_helpful", status: "new", createdAt: null }] }
        : String(q).includes("restaurantAiChatbotSafetyRules") ? { restaurantAiChatbotSafetyRules: [{ id: "sr1", restaurantId: "r1", ruleType: "blocked_topic", pattern: "abc", responseMessage: "blocked", enabled: true, priority: 1 }] } : { restaurantAiChatbotKnowledge: [] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: (q) => {
    const text = String(q);
    if (text.includes("approveRestaurantAiChatbotKnowledgeSuggestion")) return [approveMutation, { loading: false }];
    if (text.includes("dismissRestaurantAiChatbotKnowledgeSuggestion")) return [dismissMutation, { loading: false }];
    if (text.includes("markAiChatbotAnswerFeedbackReviewed")) return [reviewMutation, { loading: false }];
    if (text.includes("ignoreAiChatbotAnswerFeedback")) return [ignoreMutation, { loading: false }];
    if (text.includes("convertAiChatbotFeedbackToSuggestion")) return [convertMutation, { loading: false }];
    if (text.includes("createRestaurantAiChatbotSafetyRule")) return [createSafetyMutation, { loading: false }];
    if (text.includes("updateRestaurantAiChatbotSafetyRule")) return [updateSafetyMutation, { loading: false }];
    if (text.includes("deleteRestaurantAiChatbotSafetyRule")) return [deleteSafetyMutation, { loading: false }];
    return [vi.fn(), { loading: false }];
  },
}));

vi.mock("@/context/AuthContext", () => ({ AuthContext: React.createContext({ restaurants: [{ id: "r1", name: "R1" }] }) }));

beforeEach(() => {
  approveMutation.mockReset(); dismissMutation.mockReset(); reviewMutation.mockReset(); ignoreMutation.mockReset(); convertMutation.mockReset(); createSafetyMutation.mockReset(); updateSafetyMutation.mockReset(); deleteSafetyMutation.mockReset();
  window.confirm = vi.fn(() => true);
  window.alert = vi.fn();
});

describe("AiChatbotKnowledgePage", () => {
  it("renders suggestions and feedback sections", () => {
    render(<AiChatbotKnowledgePage />);
    expect(screen.getByText("AI Chatbot Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Gap Suggestions")).toBeInTheDocument();
    expect(screen.getByText("Answer Feedback Review")).toBeInTheDocument();
    expect(screen.getByText("Safety Rules")).toBeInTheDocument();
  });

  it("approve requires content and does not submit empty content", async () => {
    window.prompt = vi.fn().mockReturnValueOnce("Title ok").mockReturnValueOnce("   ");
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByText("Approve"));
    expect(window.alert).toHaveBeenCalled();
    expect(approveMutation).not.toHaveBeenCalled();
  });

  it("feedback actions call review/ignore/convert mutations", async () => {
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByText("Mark reviewed"));
    fireEvent.click(screen.getByText("Ignore"));
    fireEvent.click(screen.getByText("Convert to suggestion"));
    expect(reviewMutation).toHaveBeenCalled();
    expect(ignoreMutation).toHaveBeenCalled();
    expect(convertMutation).toHaveBeenCalled();
  });
  it("safety create/update/delete call correct mutations", async () => {
    render(<AiChatbotKnowledgePage />);
    fireEvent.change(screen.getByPlaceholderText("Pattern"), { target: { value: "medical" } });
    fireEvent.click(screen.getByText("Lưu safety"));
    expect(createSafetyMutation).toHaveBeenCalled();

    fireEvent.click(screen.getAllByText("Sửa")[0]);
    fireEvent.click(screen.getByText("Lưu safety"));
    expect(updateSafetyMutation).toHaveBeenCalled();

    fireEvent.click(screen.getAllByText("Xóa")[0]);
    expect(deleteSafetyMutation).toHaveBeenCalled();
  });
});
