import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AiChatbotKnowledgePage from "./AiChatbotKnowledgePage";

vi.mock("@apollo/client", () => ({
  gql: (s) => s,
  useQuery: () => ({ data: { restaurantAiChatbotKnowledge: [] }, loading: false, error: null, refetch: vi.fn() }),
  useMutation: () => [vi.fn(), { loading: false }],
}));
vi.mock("@/context/AuthContext", () => ({ AuthContext: React.createContext({ restaurants: [{ id: "r1", name: "R1" }] }) }));

describe("AiChatbotKnowledgePage", () => {
  it("renders", () => {
    render(<AiChatbotKnowledgePage />);
    expect(screen.getByText("AI Chatbot Knowledge Base")).toBeInTheDocument();
  });
});
