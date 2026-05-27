import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiChatbotWidget from "./AiChatbotWidget";

const mocks = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  askMutationSpy: vi.fn(),
  handoffMutationSpy: vi.fn(),
  guestRepliesSpy: vi.fn(),
  guestMessageMutationSpy: vi.fn(),
  submitFeedbackMutationSpy: vi.fn(),
  publicSettingsQuerySpy: vi.fn(),
  guestSendLoadingState: false,
  connectHandler: null,
  staffReplyHandler: null,
  handoffResolvedHandler: null,
  socketOff: vi.fn(),
  socketEmit: vi.fn(),
  socketDisconnect: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "resto-1" }),
  useLocation: () => ({ pathname: "/restaurant/resto-1" }),
  useNavigate: () => mocks.navigateSpy,
}));
vi.mock("@/context/CartProvider", () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
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
const send = (t) => { fireEvent.change(screen.getByPlaceholderText(/Hỏi AI gợi ý món|Hỏi về món ăn/i), { target: { value: t } }); fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i })); };
const makeSocketFactory = () => ({
  on: (event, cb) => {
    if (event === "connect") mocks.connectHandler = cb;
    if (event === "aiChatbotStaffReplyCreated") mocks.staffReplyHandler = cb;
    if (event === "aiChatbotHandoffResolved") mocks.handoffResolvedHandler = cb;
  },
  off: mocks.socketOff,
  emit: mocks.socketEmit,
  disconnect: mocks.socketDisconnect,
});

beforeEach(() => {
  window.localStorage.setItem("cohan_ai_guest_id", "guest-1");
  mocks.connectHandler = null; mocks.staffReplyHandler = null; mocks.handoffResolvedHandler = null;
  mocks.socketOff.mockReset(); mocks.socketEmit.mockReset(); mocks.socketDisconnect.mockReset();
  mocks.socketEmit.mockImplementation((event, payload, ack) => { if (event === "joinAiChatbotConversation" && ack) ack({ ok: true }); });
  mocks.askMutationSpy.mockResolvedValue({ data: { askAiChatbot: { answer: "Trợ lý đã tiếp nhận.", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } } });
  mocks.handoffMutationSpy.mockResolvedValue({ data: { requestAiChatbotHandoff: { ok: true, handoffRequested: true, message: "Đã gửi yêu cầu gặp nhân viên." } } });
  mocks.guestMessageMutationSpy.mockResolvedValue({ data: { sendAiChatbotGuestMessage: { ok: true, conversationId: "conv-1", message: { id: "g1", content: "ok" } } } });
  mocks.submitFeedbackMutationSpy.mockResolvedValue({ data: { submitAiChatbotAnswerFeedback: { id: "f1", rating: "helpful" } } });
  mocks.guestRepliesSpy.mockResolvedValue({ data: { aiChatbotGuestReplies: { handoffClosed: false, conversationStatus: "handoff_requested", replies: [{ id: "2026-05-25T10:00:00.000Z_0", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" }] } } });
  mocks.publicSettingsQuerySpy.mockReturnValue({ data: { publicAiChatbotSettings: { enabled: true, welcomeMessage: "Xin chào", starterQuickReplies: ["Gợi ý món bán chạy cho tôi"], handoffEnabled: true, handoffUnavailableMessage: "Không hỗ trợ" } } });
});

afterEach(() => {
  cleanup(); vi.clearAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); window.localStorage.clear(); window.sessionStorage.clear();
});

describe("handoff", () => {
  it("uses sendAiChatbotGuestMessage after handoff", async () => {
    render(<AiChatbotWidget testOverrides={{ disablePolling: true, socketFactory: makeSocketFactory }} />);
    open(); send("Cần hỗ trợ");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(mocks.handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    send("Sau handoff");
    await waitFor(() => expect(mocks.guestMessageMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
  });

  it("shows clear error when guest post-handoff send returns ok=false", async () => {
    mocks.guestMessageMutationSpy.mockResolvedValueOnce({ data: { sendAiChatbotGuestMessage: { ok: false, conversationId: "conv-1", message: { content: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút." } } } });
    render(<AiChatbotWidget testOverrides={{ disablePolling: true, socketFactory: makeSocketFactory }} />);
    open(); send("Cần hỗ trợ");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(mocks.handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    send("Tin mới");
    await waitFor(() => expect(screen.getByText("Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.")).toBeInTheDocument(), { timeout: 1500 });
  });

  it("close widget leaves room", async () => {
    render(<AiChatbotWidget testOverrides={{ disablePolling: true, socketFactory: makeSocketFactory }} />);
    open(); send("Cần hỗ trợ");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalled(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(mocks.handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    await act(async () => mocks.connectHandler?.());
    fireEvent.click(screen.getByRole("button", { name: /Đóng chatbot/i }));
    expect(mocks.socketEmit).toHaveBeenCalledWith("leaveAiChatbotConversation", { conversationId: "conv-1", guestId: "guest-1" });
    expect(mocks.socketDisconnect).toHaveBeenCalled();
  });

  it("dedupes staff reply received via socket", async () => {
    render(<AiChatbotWidget testOverrides={{ disablePolling: true, socketFactory: makeSocketFactory }} />);
    open(); send("Cần hỗ trợ");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalled(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(mocks.handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    await act(async () => mocks.staffReplyHandler?.({ id: "2026-05-25T10:00:00.000Z_0", content: "Mình là nhân viên hỗ trợ đây.", senderLabel: "Nhân viên", createdAt: "2026-05-25T10:00:00.000Z" }));
    expect(screen.getAllByText("Mình là nhân viên hỗ trợ đây.")).toHaveLength(1);
  });

  it("handoffResolved returns to ask flow", async () => {
    render(<AiChatbotWidget testOverrides={{ disablePolling: true, socketFactory: makeSocketFactory }} />);
    open(); send("Cần hỗ trợ");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /Gặp nhân viên/i }));
    await waitFor(() => expect(mocks.handoffMutationSpy).toHaveBeenCalledTimes(1), { timeout: 1500 });
    await waitFor(() => expect(typeof mocks.handoffResolvedHandler).toBe("function"), { timeout: 1500 });
    await act(async () => mocks.handoffResolvedHandler?.({ conversationId: "conv-1", status: "closed", message: "Nhân viên đã kết thúc phiên hỗ trợ." }));
    send("Sau close");
    await waitFor(() => expect(mocks.askMutationSpy).toHaveBeenCalledTimes(2), { timeout: 1500 });
  });
});
