import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AiChatbotKnowledgePage from "./AiChatbotKnowledgePage";

const approveMutation = vi.fn();
const dismissMutation = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (s) => s,
  useQuery: (q) => ({
    data: String(q).includes("restaurantAiChatbotKnowledgeSuggestions")
      ? { restaurantAiChatbotKnowledgeSuggestions: [{ id: "s1", question: "Q1", triggerType: "fallback", confidence: 0.2, occurrenceCount: 2, lastAskedAt: null, suggestedTitle: "T1", suggestedContent: "", category: "", tags: [], status: "pending" }] }
      : { restaurantAiChatbotKnowledge: [] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: (q) => {
    const text = String(q);
    if (text.includes("approveRestaurantAiChatbotKnowledgeSuggestion")) return [approveMutation, { loading: false }];
    if (text.includes("dismissRestaurantAiChatbotKnowledgeSuggestion")) return [dismissMutation, { loading: false }];
    return [vi.fn(), { loading: false }];
  },
}));

vi.mock("@/context/AuthContext", () => ({ AuthContext: React.createContext({ restaurants: [{ id: "r1", name: "R1" }] }) }));

beforeEach(() => {
  approveMutation.mockReset();
  dismissMutation.mockReset();
  window.confirm = vi.fn(() => true);
  window.alert = vi.fn();
});

describe("AiChatbotKnowledgePage", () => {
  it("renders suggestions section", () => {
    render(<AiChatbotKnowledgePage />);
    expect(screen.getByText("AI Chatbot Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Gap Suggestions")).toBeInTheDocument();
  });

  it("approve requires content and does not submit empty content", async () => {
    window.prompt = vi.fn()
      .mockReturnValueOnce("Title ok")
      .mockReturnValueOnce("   ");
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByText("Approve"));
    expect(window.alert).toHaveBeenCalled();
    expect(approveMutation).not.toHaveBeenCalled();
  });

  it("dismiss button calls mutation for pending suggestion", async () => {
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(dismissMutation).toHaveBeenCalled();
  });
});
