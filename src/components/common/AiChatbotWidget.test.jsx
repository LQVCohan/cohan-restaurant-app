import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AiChatbotWidget from "./AiChatbotWidget";

let askMutationSpy;
let handoffMutationSpy;
let guestRepliesSpy;
let guestMessageMutationSpy;
let publicSettingsQuerySpy;
let socketOn;
let socketOff;
let socketEmit;
let socketDisconnect;
let connectHandler;
let staffReplyHandler;
let handoffResolvedHandler;
let guestSendLoadingState;

const createMockSocket = () => ({
  on: socketOn,
  off: socketOff,
  emit: socketEmit,
  disconnect: socketDisconnect,
});


vi.mock("socket.io-client", () => ({
  io: vi.fn(() => createMockSocket()),
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
      if (body.includes("SendAiChatbotGuestMessage")) return [guestMessageMutationSpy, { loading: guestSendLoadingState }];
      return [vi.fn(), { loading: false }];
    }),
    useLazyQuery: vi.fn(() => [guestRepliesSpy, { loading: false, data: null, error: null }]),
    useQuery: vi.fn(() => publicSettingsQuerySpy?.() || { data: null, loading: false, error: null }),
  };
});

describe("AiChatbotWidget phase 5 stabilization", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("cohan_ai_guest_id", "guest-1");

    guestSendLoadingState = false;
    connectHandler = null;
    staffReplyHandler = null;
    handoffResolvedHandler = null;
    socketOn = vi.fn((event, cb) => {
      if (event === "connect") connectHandler = cb;
      if (event === "aiChatbotStaffReplyCreated") staffReplyHandler = cb;
      if (event === "aiChatbotHandoffResolved") handoffResolvedHandler = cb;
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
          handoffClosed: false,
          conversationStatus: "handoff_requested",
          replies: [
            { id: "2026-05-25T10:00:00.000Z_0", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" },
          ],
        },
      },
    });
    publicSettingsQuerySpy = vi.fn(() => ({
      data: {
        publicAiChatbotSettings: {
          enabled: true,
          welcomeMessage: "Xin chào",
          starterQuickReplies: ["Gợi ý món bán chạy cho tôi"],
          handoffEnabled: true,
          handoffUnavailableMessage: "Không hỗ trợ",
        },
      },
      loading: false,
      error: null,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows friendly message when ask is rate limited", async () => {
    askMutationSpy.mockRejectedValueOnce({ graphQLErrors: [{ message: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.", extensions: { code: "RATE_LIMITED" } }] });
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Xin chào" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(screen.getByText("Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.")).toBeInTheDocument(), { timeout: 1500 });
  });

  it("prevents rapid quick-reply double submit while in flight", async () => {
    let release;
    askMutationSpy.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    const quick = screen.getByRole("button", { name: "Gợi ý món bán chạy cho tôi" });
    fireEvent.click(quick);
    fireEvent.click(quick);
    expect(askMutationSpy).toHaveBeenCalledTimes(1);
    await act(async () => release({ data: { askAiChatbot: { answer: "ok", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } } }));
  });

  it("dedupes same staff reply arriving via socket then polling", async () => {
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled(), { timeout: 1500 });

    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });

    await act(async () => connectHandler?.());
    await act(async () => {
      staffReplyHandler?.({ id: "2026-05-25T10:00:00.000Z_0", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" });
    });

    expect(guestRepliesSpy).toHaveBeenCalled();
    expect(screen.getAllByText("Mình là nhân viên hỗ trợ đây.")).toHaveLength(1);
  });

  it("cleans polling/socket when widget unmounts after handoff", async () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalled(), { timeout: 1500 });

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(socketDisconnect).toHaveBeenCalled();
  });

  it("handles aiChatbotHandoffResolved socket event and returns to ask flow", async () => {
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalled(), { timeout: 1500 });

    await act(async () => handoffResolvedHandler?.({ conversationId: "conv-1", status: "closed", message: "Nhân viên đã kết thúc phiên hỗ trợ." }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Sau close" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(2), { timeout: 1500 });
    expect(guestMessageMutationSpy).toHaveBeenCalledTimes(0);
  });
});
