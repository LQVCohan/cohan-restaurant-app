import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiChatbotWidget from "./AiChatbotWidget";
import { OPEN_AI_CHATBOT_EVENT } from "@/utils/aiChatbotEvents";

const mocks = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  addToCartSpy: vi.fn(),
  askMutationSpy: vi.fn(),
  handoffMutationSpy: vi.fn(),
  guestRepliesSpy: vi.fn(),
  guestMessageMutationSpy: vi.fn(),
  submitFeedbackMutationSpy: vi.fn(),
  publicSettingsQuerySpy: vi.fn(),
  guestSendLoadingState: false,
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "resto-1" }),
  useLocation: () => ({ pathname: "/restaurant/resto-1" }),
  useNavigate: () => mocks.navigateSpy,
}));
vi.mock("@/context/CartProvider", () => ({ useCart: () => ({ addToCart: mocks.addToCartSpy }) }));
vi.mock("@apollo/client/react", () => ({
  useMutation: vi.fn((mutation) => {
    const body = mutation?.loc?.source?.body || "";
    if (body.includes("AskAiChatbot")) return [mocks.askMutationSpy, { loading: false }];
    if (body.includes("RequestAiChatbotHandoff")) return [mocks.handoffMutationSpy, { loading: false }];
    if (body.includes("SendAiChatbotGuestMessage")) return [mocks.guestMessageMutationSpy, { loading: mocks.guestSendLoadingState }];
    if (body.includes("SubmitAiChatbotAnswerFeedback")) return [mocks.submitFeedbackMutationSpy, { loading: false }];
    return [vi.fn(), { loading: false }];
  }),
  useLazyQuery: vi.fn(() => [mocks.guestRepliesSpy, { loading: false, data: null, error: null }]),
  useQuery: vi.fn(() => mocks.publicSettingsQuerySpy()),
}));

const open = () => fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
const send = (t) => {
  fireEvent.change(screen.getByPlaceholderText(/Hỏi AI gợi ý món|Hỏi về món ăn/i), { target: { value: t } });
  fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i }));
};

beforeEach(() => {
  mocks.navigateSpy.mockReset();
  mocks.addToCartSpy.mockReset();
  window.localStorage.setItem("cohan_ai_guest_id", "guest-1");
  mocks.guestSendLoadingState = false;
  mocks.askMutationSpy.mockResolvedValue({ data: { askAiChatbot: { answer: "Trợ lý đã tiếp nhận.", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } } });
  mocks.handoffMutationSpy.mockResolvedValue({ data: { requestAiChatbotHandoff: { ok: true, handoffRequested: true, message: "Đã gửi yêu cầu gặp nhân viên." } } });
  mocks.guestMessageMutationSpy.mockResolvedValue({ data: { sendAiChatbotGuestMessage: { ok: true, conversationId: "conv-1", message: { id: "g1", content: "ok" } } } });
  mocks.submitFeedbackMutationSpy.mockResolvedValue({ data: { submitAiChatbotAnswerFeedback: { id: "f1", rating: "helpful" } } });
  mocks.guestRepliesSpy.mockResolvedValue({ data: { aiChatbotGuestReplies: { replies: [] } } });
  mocks.publicSettingsQuerySpy.mockReturnValue({ data: { publicAiChatbotSettings: { enabled: true, welcomeMessage: "Xin chào", starterQuickReplies: ["Gợi ý món bán chạy cho tôi"], handoffEnabled: true, handoffUnavailableMessage: "Không hỗ trợ" } } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("AiChatbotWidget basic", () => {
  it("normal AI flow before handoff", async () => {
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("Xin chào");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(screen.getByText("Trợ lý đã tiếp nhận.")).toBeInTheDocument();
  });

  it("shows friendly message when ask is rate limited", async () => {
    mocks.askMutationSpy.mockRejectedValueOnce({ graphQLErrors: [{ message: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.", extensions: { code: "RATE_LIMITED" } }] });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("Xin chào");
    await waitFor(() => expect(screen.getByText("Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.")).toBeInTheDocument(), { timeout: 1500 });
  });

  it("prevents rapid quick-reply double submit while in flight", async () => {
    let release;
    mocks.askMutationSpy.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    const quick = screen.getByRole("button", { name: "Gợi ý món bán chạy cho tôi" });
    fireEvent.click(quick);
    fireEvent.click(quick);
    expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1);
    await act(async () => release({ data: { askAiChatbot: { answer: "ok", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } } }));
  });

  it("disables input while guest send is loading", () => {
    mocks.guestSendLoadingState = true;
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    expect(screen.getByPlaceholderText(/Hỏi AI gợi ý món|Hỏi về món ăn/i)).toBeDisabled();
  });

  it("hides handoff action when handoffEnabled=false", async () => {
    mocks.publicSettingsQuerySpy.mockReturnValue({ data: { publicAiChatbotSettings: { enabled: true, welcomeMessage: "Xin chào", starterQuickReplies: ["Gợi ý món bán chạy cho tôi"], handoffEnabled: false, handoffUnavailableMessage: "Không hỗ trợ" } } });
    mocks.askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "ok", quickReplies: [], actions: [{ type: "navigate", label: "Mở menu", href: "/menu" }, { type: "handoff", label: "Gặp nhân viên", href: "/support" }], contextSummary: null, conversationId: "conv-1" } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("Xin chào");
    await waitFor(() => expect(screen.getByRole("button", { name: "Mở menu" })).toBeInTheDocument(), { timeout: 1500 });
    expect(screen.queryByRole("button", { name: "Gặp nhân viên" })).not.toBeInTheDocument();
  });

  it("menu card renders and safe add-to-cart", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "Gợi ý", intent: "menu", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1", sources: [{ type: "menuItem", id: "food-1", label: "Phở bò", formattedPrice: "90.000đ", isAvailable: true, restaurantId: "resto-1", currentPrice: 90000 }] } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    expect(mocks.addToCartSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "food-1", quantity: 1, price: 90000 }));
  });

  it("unavailable/optioned items do not show add button", async () => {
    mocks.askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "Gợi ý", intent: "menu", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1", sources: [{ type: "menuItem", id: "food-1", label: "A", isAvailable: false, restaurantId: "resto-1", currentPrice: 90000 }, { type: "menuItem", id: "food-2", label: "B", isAvailable: true, restaurantId: "resto-1", currentPrice: 90000, hasOptions: true }] } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("gợi ý món");
    await waitFor(() => expect(screen.getByText("A")).toBeInTheDocument(), { timeout: 1500 });
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();
  });

  it("open event opens chatbot", async () => {
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_AI_CHATBOT_EVENT));
    });
    await waitFor(() => expect(screen.getByLabelText("ChatBot A.I hỗ trợ nhà hàng")).toBeInTheDocument(), { timeout: 1500 });
  });

  it("open event with autoSend true calls ask once", async () => {
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_AI_CHATBOT_EVENT, { detail: { message: "Món dưới 100k", autoSend: true } }));
    });
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(mocks.askMutationSpy).toHaveBeenCalledWith(expect.objectContaining({ variables: expect.objectContaining({ input: expect.objectContaining({ message: "Món dưới 100k" }) }) }));
  });

  it("open event with autoSend false prefills input", async () => {
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_AI_CHATBOT_EVENT, { detail: { message: "Gợi ý món cho 2 người", autoSend: false } }));
    });
    await waitFor(() => expect(screen.getByDisplayValue("Gợi ý món cho 2 người")).toBeInTheDocument(), { timeout: 1500 });
    expect(mocks.askMutationSpy).not.toHaveBeenCalled();
  });

  it("while in-flight, event does not double-send", async () => {
    let release;
    mocks.askMutationSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open();
    send("Xin chào");
    expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_AI_CHATBOT_EVENT, { detail: { message: "Món bán chạy", autoSend: true } }));
    });
    expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1);
    await act(async () => release({ data: { askAiChatbot: { answer: "ok", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } } }));
  });
});
