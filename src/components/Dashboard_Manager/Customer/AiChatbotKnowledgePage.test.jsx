import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AiChatbotKnowledgePage from "./AiChatbotKnowledgePage";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const useLazyQueryMock = vi.fn();

const m = {
  bulkKnowledgeEnabled: vi.fn(async () => ({})), bulkKnowledgeDelete: vi.fn(async () => ({})), importKnowledge: vi.fn(async () => ({ data: { importRestaurantAiChatbotKnowledge: { imported: 1, skipped: 0, errors: [] } } })),
  bulkDismissSuggestion: vi.fn(async () => ({})), bulkDeleteSuggestion: vi.fn(async () => ({})),
  bulkFeedbackReviewed: vi.fn(async () => ({})), bulkFeedbackIgnore: vi.fn(async () => ({})), bulkFeedbackConvert: vi.fn(async () => ({})),
  bulkSafetyEnabled: vi.fn(async () => ({})), bulkSafetyDelete: vi.fn(async () => ({})),
  createEvalCase: vi.fn(async () => ({})),
};
const exportFn = vi.fn(async () => ({ data: { exportRestaurantAiChatbotKnowledge: "[]" } }));
const evalFn = vi.fn(async () => ({ data: { evaluateRestaurantAiChatbotPrompt: { answer: "ok", intent: "menu", confidence: 0.9, isFallback: false, handoffSuggested: false, knowledgeMatches: [], safetyResult: { blocked: false, outOfScope: false, disclaimers: [], handoffSuggested: false, matchedRuleIds: [] } } } }));
const runSetFn = vi.fn(async () => ({ data: { runRestaurantAiChatbotEvaluationSet: [{ caseId: "c1", question: "q1", answer: "a1", confidence: 0.7, isFallback: false, handoffSuggested: false, safetyResult: { blocked: false } }] } }));

vi.mock("@apollo/client", () => ({
  gql: (s) => s,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
  useLazyQuery: (...args) => useLazyQueryMock(...args),
}));
vi.mock("@/context/AuthContext", () => ({ AuthContext: React.createContext({ restaurants: [{ id: "r1", name: "R1" }] }) }));

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);

  useQueryMock.mockImplementation((q) => {
    const t = String(q);
    if (t.includes("restaurantAiChatbotKnowledgeSuggestions")) return { data: { restaurantAiChatbotKnowledgeSuggestions: [{ id: "s1", question: "sq" }] }, loading: false, error: null, refetch: vi.fn(async () => ({})) };
    if (t.includes("restaurantAiChatbotAnswerFeedback")) return { data: { restaurantAiChatbotAnswerFeedback: [{ id: "f1", question: "fq" }] }, loading: false, error: null, refetch: vi.fn(async () => ({})) };
    if (t.includes("restaurantAiChatbotSafetyRules")) return { data: { restaurantAiChatbotSafetyRules: [{ id: "sa1", ruleType: "blocked_topic", pattern: "x" }] }, loading: false, error: null, refetch: vi.fn(async () => ({})) };
    if (t.includes("restaurantAiChatbotEvaluationCases")) return { data: { restaurantAiChatbotEvaluationCases: [{ id: "ec1", question: "test case", enabled: true }] }, loading: false, error: null, refetch: vi.fn(async () => ({})) };
    return { data: { restaurantAiChatbotKnowledge: [{ id: "k1", title: "kt", content: "kc", enabled: true, tags: [] }] }, loading: false, error: null, refetch: vi.fn(async () => ({})) };
  });

  useLazyQueryMock.mockImplementation((q) => {
    const t = String(q);
    if (t.includes("exportRestaurantAiChatbotKnowledge")) return [exportFn, { loading: false }];
    if (t.includes("evaluateRestaurantAiChatbotPrompt")) return [evalFn, { loading: false }];
    if (t.includes("runRestaurantAiChatbotEvaluationSet")) return [runSetFn, { loading: false }];
    return [vi.fn(async () => ({})), { loading: false }];
  });

  useMutationMock.mockImplementation((q) => {
    const t = String(q);
    if (t.includes("bulkUpdateRestaurantAiChatbotKnowledgeEnabled")) return [m.bulkKnowledgeEnabled, {}];
    if (t.includes("bulkDeleteRestaurantAiChatbotKnowledge(")) return [m.bulkKnowledgeDelete, {}];
    if (t.includes("importRestaurantAiChatbotKnowledge")) return [m.importKnowledge, {}];
    if (t.includes("bulkDismissRestaurantAiChatbotKnowledgeSuggestions")) return [m.bulkDismissSuggestion, {}];
    if (t.includes("bulkDeleteRestaurantAiChatbotKnowledgeSuggestions")) return [m.bulkDeleteSuggestion, {}];
    if (t.includes("bulkMarkAiChatbotAnswerFeedbackReviewed")) return [m.bulkFeedbackReviewed, {}];
    if (t.includes("bulkIgnoreAiChatbotAnswerFeedback")) return [m.bulkFeedbackIgnore, {}];
    if (t.includes("bulkConvertAiChatbotFeedbackToSuggestion")) return [m.bulkFeedbackConvert, {}];
    if (t.includes("bulkUpdateRestaurantAiChatbotSafetyRuleEnabled")) return [m.bulkSafetyEnabled, {}];
    if (t.includes("bulkDeleteRestaurantAiChatbotSafetyRules")) return [m.bulkSafetyDelete, {}];
    if (t.includes("createRestaurantAiChatbotEvaluationCase")) return [m.createEvalCase, {}];
    return [vi.fn(async () => ({})), {}];
  });
});

describe("AiChatbotKnowledgePage phase 18 UI", () => {
  it("renders import/export controls and calls export+import", async () => {
    render(<AiChatbotKnowledgePage />);
    expect(screen.getByLabelText("Export format")).toBeInTheDocument();
    expect(screen.getByLabelText("Import format")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Export"));
    expect(exportFn).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Import payload"), { target: { value: "[]" } });
    fireEvent.click(screen.getByText("Import"));
    expect(m.importKnowledge).toHaveBeenCalled();
  });

  it("knowledge bulk actions call mutations", () => {
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByLabelText("knowledge-k1"));
    fireEvent.click(screen.getByText("Enable selected"));
    fireEvent.click(screen.getByText("Disable selected"));
    fireEvent.click(screen.getByText("Delete selected"));
    expect(m.bulkKnowledgeEnabled).toHaveBeenCalledTimes(2);
    expect(m.bulkKnowledgeDelete).toHaveBeenCalledTimes(1);
  });

  it("suggestions bulk actions call mutations", () => {
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByText("suggestions"));
    fireEvent.click(screen.getByLabelText("suggestion-s1"));
    fireEvent.click(screen.getByText("Dismiss selected"));
    fireEvent.click(screen.getByText("Delete selected"));
    expect(m.bulkDismissSuggestion).toHaveBeenCalled();
    expect(m.bulkDeleteSuggestion).toHaveBeenCalled();
  });

  it("feedback bulk actions call mutations", () => {
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByText("feedback"));
    fireEvent.click(screen.getByLabelText("feedback-f1"));
    fireEvent.click(screen.getByText("Mark reviewed selected"));
    fireEvent.click(screen.getByText("Ignore selected"));
    fireEvent.click(screen.getByText("Convert selected to suggestions"));
    expect(m.bulkFeedbackReviewed).toHaveBeenCalled();
    expect(m.bulkFeedbackIgnore).toHaveBeenCalled();
    expect(m.bulkFeedbackConvert).toHaveBeenCalled();
  });

  it("safety bulk actions call mutations", () => {
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByText("safety"));
    fireEvent.click(screen.getByLabelText("safety-sa1"));
    fireEvent.click(screen.getByText("Enable selected"));
    fireEvent.click(screen.getByText("Disable selected"));
    fireEvent.click(screen.getByText("Delete selected"));
    expect(m.bulkSafetyEnabled).toHaveBeenCalledTimes(2);
    expect(m.bulkSafetyDelete).toHaveBeenCalledTimes(1);
  });

  it("evaluation tab renders and run/save/set actions call GraphQL operations", () => {
    render(<AiChatbotKnowledgePage />);
    fireEvent.click(screen.getByText("evaluation"));
    expect(screen.getByText("Evaluation Playground")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Evaluation message"), { target: { value: "How is menu?" } });
    fireEvent.click(screen.getByText("Run test"));
    fireEvent.click(screen.getByText("Save case"));
    fireEvent.click(screen.getByText("Run enabled set"));
    expect(evalFn).toHaveBeenCalled();
    expect(m.createEvalCase).toHaveBeenCalled();
    expect(runSetFn).toHaveBeenCalled();
  });
});
