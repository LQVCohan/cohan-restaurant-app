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
let guestSendLoadingState;

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({ on: socketOn, off: socketOff, emit: socketEmit, disconnect: socketDisconnect })),
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

const openWidget = () => fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
const sendMessage = (text) => {
  fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
};

describe("AiChatbotWidget stabilization", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("cohan_ai_guest_id", "guest-1");

    guestSendLoadingState = false;
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
      data: { sendAiChatbotGuestMessage: { ok: true, conversationId: "conv-1", message: { id: "g1", content: "ok" } } },
    });
    guestRepliesSpy = vi.fn().mockResolvedValue({
      data: { aiChatbotGuestReplies: { handoffClosed: false, conversationStatus: "handoff_requested", replies: [{ id: "2026-05-25T10:00:00.000Z_0", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" }] } },
    });
    publicSettingsQuerySpy = vi.fn(() => ({
      data: { publicAiChatbotSettings: { enabled: true, welcomeMessage: "Xin chào", starterQuickReplies: ["Gợi ý món bán chạy cho tôi"], handoffEnabled: true, handoffUnavailableMessage: "Không hỗ trợ" } },
      loading: false,
      error: null,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("normal AI flow before handoff", async () => {
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    openWidget();
    sendMessage("Xin chào");
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(screen.getByText("Trợ lý đã tiếp nhận.")).toBeInTheDocument();
    expect(guestRepliesSpy).not.toHaveBeenCalled();
  });

  it("shows friendly message when ask is rate limited", async () => {
    askMutationSpy.mockRejectedValueOnce({ graphQLErrors: [{ message: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.", extensions: { code: "RATE_LIMITED" } }] });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    openWidget();
    sendMessage("Xin chào");
    await waitFor(() => expect(screen.getByText("Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.")).toBeInTheDocument(), { timeout: 1500 });
  });

  it("prevents rapid quick-reply double submit while in flight", async () => {
    let release;
    askMutationSpy.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    openWidget();
    const quick = screen.getByRole("button", { name: "Gợi ý món bán chạy cho tôi" });
    fireEvent.click(quick);
    fireEvent.click(quick);
    expect(askMutationSpy).toHaveBeenCalledTimes(1);
    await act(async () => release({ data: { askAiChatbot: { answer: "ok", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } } }));
  });

  it("uses sendAiChatbotGuestMessage after handoff", async () => {
    render(<AiChatbotWidget testOverrides={{ disablePolling: true }} />);
    openWidget();
    sendMessage("Cần hỗ trợ");
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    sendMessage("Sau handoff");
    await waitFor(() => expect(guestMessageMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(askMutationSpy).toHaveBeenCalledTimes(1);
  });

  it("shows clear error when guest post-handoff send returns ok=false", async () => {
    guestMessageMutationSpy.mockResolvedValueOnce({
      data: { sendAiChatbotGuestMessage: { ok: false, conversationId: "conv-1", message: { content: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút." } } },
    });
    render(<AiChatbotWidget testOverrides={{ disablePolling: true }} />);
    openWidget();
    sendMessage("Cần hỗ trợ");
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    sendMessage("Tin mới");
    await waitFor(() => expect(screen.getByText("Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.")).toBeInTheDocument(), { timeout: 1500 });
  });

  it("disables input while guest send is loading", () => {
    guestSendLoadingState = true;
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    openWidget();
    expect(screen.getByPlaceholderText(/Hỏi về món ăn/i)).toBeDisabled();
  });

  it("hides handoff action when handoffEnabled=false", async () => {
    publicSettingsQuerySpy = vi.fn(() => ({
      data: { publicAiChatbotSettings: { enabled: true, welcomeMessage: "Xin chào", starterQuickReplies: ["Gợi ý món bán chạy cho tôi"], handoffEnabled: false, handoffUnavailableMessage: "Không hỗ trợ" } },
      loading: false,
      error: null,
    }));
    askMutationSpy.mockResolvedValueOnce({
      data: { askAiChatbot: { answer: "ok", quickReplies: [], actions: [{ type: "navigate", label: "Mở menu", href: "/menu" }, { type: "handoff", label: "Gặp nhân viên", href: "/support" }], contextSummary: null, conversationId: "conv-1" } },
    });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    openWidget();
    sendMessage("Xin chào");
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(screen.getByRole("button", { name: "Mở menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gặp nhân viên" })).not.toBeInTheDocument();
  });

  it("close widget leaves room and disconnects", async () => {
    render(<AiChatbotWidget testOverrides={{ disablePolling: true }} />);
    openWidget();
    sendMessage("Cần hỗ trợ");
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    await act(async () => connectHandler?.());
    fireEvent.click(screen.getByRole("button", { name: /Đóng chatbot/i }));
    expect(socketEmit).toHaveBeenCalledWith("leaveAiChatbotConversation", { conversationId: "conv-1", guestId: "guest-1" });
    expect(socketDisconnect).toHaveBeenCalled();
  });

  it("dedupes staff reply via socket and polling", async () => {
    render(<AiChatbotWidget testOverrides={{ disablePolling: true }} />);
    openWidget();
    sendMessage("Cần hỗ trợ");
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    await act(async () => staffReplyHandler?.({ id: "2026-05-25T10:00:00.000Z_0", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" }));
    expect(screen.getAllByText("Mình là nhân viên hỗ trợ đây.")).toHaveLength(1);
  });
});
