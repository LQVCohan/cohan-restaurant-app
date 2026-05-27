import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AiChatbotWidget, { buildMenuSourceCards, buildStarterMessages, extractRestaurantId, getInputPlaceholder } from "./AiChatbotWidget";

describe("AiChatbotWidget helpers", () => {
  it("extractRestaurantId from /restaurant/:id", () => {
    expect(extractRestaurantId({ params: { id: "abc" }, pathname: "/restaurant/abc" })).toBe("abc");
  });
  it("restaurant context starter includes Gợi ý món cho 2 người", () => {
    expect(buildStarterMessages({ restaurantId: "r1", publicSettings: null })).toContain("Gợi ý món cho 2 người");
  });
  it("global starter remains general", () => {
    expect(buildStarterMessages({ restaurantId: null, publicSettings: null }).length).toBeGreaterThan(0);
  });
  it("menu source cards only include menuItem sources", () => {
    const cards = buildMenuSourceCards({ intent: "menu", sources: [{ type: "menuItem", id: "1", label: "A" }, { type: "coupon", id: "2", label: "B" }] });
    expect(cards).toHaveLength(1);
  });
  it("placeholder changes when restaurantId exists", () => {
    expect(getInputPlaceholder("r1")).toMatch(/combo/);
    expect(getInputPlaceholder(null)).toMatch(/đặt bàn/);
  });
});

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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });


  it("shows friendly message when ask is rate limited", async () => {
    askMutationSpy.mockRejectedValueOnce({ graphQLErrors: [{ message: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.", extensions: { code: "RATE_LIMITED" } }] });
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Xin chào" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(screen.getByText("Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.")).toBeInTheDocument());
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


  it("shows clear error when guest post-handoff send returns ok=false", async () => {
    guestMessageMutationSpy.mockResolvedValueOnce({
      data: { sendAiChatbotGuestMessage: { ok: false, conversationId: "conv-1", message: { content: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút." } } },
    });

    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Tin mới" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));

    await waitFor(() => expect(guestMessageMutationSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.")).toBeInTheDocument();
    expect(askMutationSpy).toHaveBeenCalledTimes(1);
  });

  it("disables input while guest send is loading", async () => {
    guestSendLoadingState = true;
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    expect(screen.getByPlaceholderText(/Hỏi về món ăn/i)).toBeDisabled();
  });

  it("keeps non-handoff lastActions visible while hiding handoff action when handoffEnabled=false", async () => {
    publicSettingsQuerySpy = vi.fn(() => ({
      data: {
        publicAiChatbotSettings: {
          enabled: true,
          welcomeMessage: "Xin chào",
          starterQuickReplies: ["Gợi ý món bán chạy cho tôi"],
          handoffEnabled: false,
          handoffUnavailableMessage: "Không hỗ trợ handoff",
        },
      },
      loading: false,
      error: null,
    }));
    askMutationSpy.mockResolvedValueOnce({
      data: {
        askAiChatbot: {
          answer: "ok",
          quickReplies: [],
          actions: [
            { type: "navigate", label: "Mở menu", href: "/menu" },
            { type: "handoff", label: "Gặp nhân viên", href: "/support" },
          ],
          contextSummary: null,
          conversationId: "conv-1",
        },
      },
    });
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Xin chào" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Mở menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gặp nhân viên" })).not.toBeInTheDocument();
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

  it("handles aiChatbotHandoffResolved socket event and stops guest thread sending path", async () => {
    render(<AiChatbotWidget />);
    fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Cần hỗ trợ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(handoffMutationSpy).toHaveBeenCalled());

    await waitFor(() => expect(socketOn.mock.calls.some((c) => c[0] === "aiChatbotHandoffResolved")).toBe(true));
    await act(async () => {
      const handoffResolvedCb = socketOn.mock.calls.find((c) => c[0] === "aiChatbotHandoffResolved")?.[1];
      handoffResolvedCb?.({ conversationId: "conv-1", status: "closed", message: "Nhân viên đã kết thúc phiên hỗ trợ." });
    });
    await waitFor(() => expect(screen.getAllByText("Nhân viên đã kết thúc phiên hỗ trợ.").length).toBeGreaterThan(0));
    fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: "Sau close" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(2));
    expect(guestMessageMutationSpy).toHaveBeenCalledTimes(0);
  });
});
