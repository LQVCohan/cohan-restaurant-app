import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AiChatbotWidget from "./AiChatbotWidget";

let askMutationSpy;
let handoffMutationSpy;
let guestRepliesSpy;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "resto-1" }),
    useLocation: () => ({ pathname: "/restaurant/resto-1" }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@apollo/client/react", async () => {
  const actual = await vi.importActual("@apollo/client/react");
  return {
    ...actual,
    useMutation: vi.fn((mutation) => {
      const body = mutation?.loc?.source?.body || "";
      if (body.includes("AskAiChatbot")) return [askMutationSpy, { loading: false }];
      if (body.includes("RequestAiChatbotHandoff")) return [handoffMutationSpy, { loading: false }];
      return [vi.fn(), { loading: false }];
    }),
    useLazyQuery: vi.fn(() => [guestRepliesSpy, { loading: false, data: null, error: null }]),
  };
});

describe("AiChatbotWidget phase 5 stabilization", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("cohan_ai_guest_id", "guest-1");
    askMutationSpy = vi.fn().mockResolvedValue({
      data: { askAiChatbot: { answer: "Trợ lý đã tiếp nhận.", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } },
    });
    handoffMutationSpy = vi.fn().mockResolvedValue({
      data: { requestAiChatbotHandoff: { ok: true, handoffRequested: true, message: "Đã gửi yêu cầu gặp nhân viên." } },
    });
    guestRepliesSpy = vi.fn().mockResolvedValue({
      data: {
        aiChatbotGuestReplies: {
          replies: [
            { id: "staff-1", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" },
            { id: "staff-1", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" },
          ],
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps normal AI flow before handoff", async () => {
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Xin chào" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));

    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Trợ lý đã tiếp nhận.")).toBeInTheDocument();
    expect(guestRepliesSpy).not.toHaveBeenCalled();
  });

  it("polls only after handoff prerequisites are met and deduplicates staff replies", async () => {
    render(<AiChatbotWidget />);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(guestRepliesSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(guestRepliesSpy).toHaveBeenCalled());

    expect(screen.getByText("Nhân viên")).toBeInTheDocument();
    expect(screen.getAllByText("Mình là nhân viên hỗ trợ đây.")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Đóng chatbot/i }));
    const beforeClose = guestRepliesSpy.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 6200));
    expect(guestRepliesSpy.mock.calls.length).toBe(beforeClose);
  }, 12000);
});
