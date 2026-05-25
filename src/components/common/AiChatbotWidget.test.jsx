import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AiChatbotWidget from "./AiChatbotWidget";

let askMutationSpy;
let handoffMutationSpy;
let guestRepliesSpy;
let guestMessageMutationSpy;
let socketOn;
let socketOff;
let socketEmit;
let socketDisconnect;
let connectHandler;
let staffReplyHandler;

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: socketOn,
    off: socketOff,
    emit: socketEmit,
    disconnect: socketDisconnect,
  })),
}));

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
      if (body.includes("SendAiChatbotGuestMessage")) return [guestMessageMutationSpy, { loading: false }];
      return [vi.fn(), { loading: false }];
    }),
    useLazyQuery: vi.fn(() => [guestRepliesSpy, { loading: false, data: null, error: null }]),
  };
});

describe("AiChatbotWidget phase 5 stabilization", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("cohan_ai_guest_id", "guest-1");

    connectHandler = null;
    staffReplyHandler = null;
    socketOn = vi.fn((event, cb) => {
      if (event === "connect") connectHandler = cb;
      if (event === "aiChatbotStaffReplyCreated") staffReplyHandler = cb;
    });
    socketOff = vi.fn();
    socketEmit = vi.fn((event, payload, ack) => {
      if (event === "joinAiChatbotConversation" && typeof ack === "function") ack({ ok: true });
    });
    socketDisconnect = vi.fn();

    askMutationSpy = vi.fn().mockResolvedValue({
      data: { askAiChatbot: { answer: "Trợ lý đã tiếp nhận.", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } },
    });
    handoffMutationSpy = vi.fn().mockResolvedValue({
      data: { requestAiChatbotHandoff: { ok: true, handoffRequested: true, message: "Đã gửi yêu cầu gặp nhân viên." } },
    });
    guestMessageMutationSpy = vi.fn().mockResolvedValue({
      data: {
        sendAiChatbotGuestMessage: {
          ok: true,
          conversationId: "conv-1",
          message: { id: "g1", role: "guest", senderLabel: "Khách hàng", content: "Sau handoff", createdAt: "2026-05-25T10:01:00.000Z" },
        },
      },
    });
    guestRepliesSpy = vi.fn().mockResolvedValue({
      data: {
        aiChatbotGuestReplies: {
          replies: [
            { id: "2026-05-25T10:00:00.000Z_0", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" },
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

  it("dedupes same staff reply arriving via socket then polling", async () => {
    render(<AiChatbotWidget />);

    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(connectHandler).toBeTypeOf("function"));
    await act(async () => { connectHandler?.(); });
    expect(socketEmit).toHaveBeenCalledWith("joinAiChatbotConversation", { conversationId: "conv-1", guestId: "guest-1" }, expect.any(Function));

    await waitFor(() => expect(staffReplyHandler).toBeTypeOf("function"));
    await act(async () => {
      staffReplyHandler?.({ id: "2026-05-25T10:00:00.000Z_0", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" });
    });

    await waitFor(() => expect(guestRepliesSpy).toHaveBeenCalled());
    expect(screen.getAllByText("Mình là nhân viên hỗ trợ đây.")).toHaveLength(1);
  });


  it("uses sendAiChatbotGuestMessage after handoff", async () => {
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Sau handoff" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));

    await waitFor(() => expect(guestMessageMutationSpy).toHaveBeenCalledTimes(1));
    expect(askMutationSpy).toHaveBeenCalledTimes(1);
  });

  it("closes widget and leaves room", async () => {
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Đóng chatbot/i }));
    expect(socketEmit).toHaveBeenCalledWith("leaveAiChatbotConversation", { conversationId: "conv-1", guestId: "guest-1" });
    expect(socketDisconnect).toHaveBeenCalled();
  });
});
