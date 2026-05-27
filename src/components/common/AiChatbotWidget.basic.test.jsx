import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiChatbotWidget from "./AiChatbotWidget";

let askMutationSpy, handoffMutationSpy, guestRepliesSpy, guestMessageMutationSpy, publicSettingsQuerySpy, guestSendLoadingState;
const navigateSpy = vi.fn();
const addToCartSpy = vi.fn();

vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useParams: () => ({ id: "resto-1" }), useLocation: () => ({ pathname: "/restaurant/resto-1" }), useNavigate: () => navigateSpy }));
vi.mock("@/context/CartProvider", () => ({ useCart: () => ({ addToCart: addToCartSpy }) }));
vi.mock("socket.io-client", () => ({ io: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })) }));
vi.mock("@apollo/client/react", async () => ({ ...(await vi.importActual("@apollo/client/react")), useMutation: vi.fn((m) => {
  const b = m?.loc?.source?.body || "";
  if (b.includes("AskAiChatbot")) return [askMutationSpy, { loading: false }];
  if (b.includes("RequestAiChatbotHandoff")) return [handoffMutationSpy, { loading: false }];
  if (b.includes("SendAiChatbotGuestMessage")) return [guestMessageMutationSpy, { loading: guestSendLoadingState }];
  return [vi.fn(), { loading: false }];
}), useLazyQuery: vi.fn(() => [guestRepliesSpy, {}]), useQuery: vi.fn(() => publicSettingsQuerySpy()) }));

const open = () => fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
const send = (t) => { fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: t } }); fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i })); };

beforeEach(() => {
  navigateSpy.mockReset(); addToCartSpy.mockReset();
  window.localStorage.clear(); window.localStorage.setItem("cohan_ai_guest_id", "guest-1");
  guestSendLoadingState = false;
  askMutationSpy = vi.fn().mockResolvedValue({ data: { askAiChatbot: { answer: "Trợ lý đã tiếp nhận.", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } } });
  handoffMutationSpy = vi.fn().mockResolvedValue({ data: { requestAiChatbotHandoff: { ok: true, handoffRequested: true, message: "Đã gửi yêu cầu gặp nhân viên." } } });
  guestMessageMutationSpy = vi.fn().mockResolvedValue({ data: { sendAiChatbotGuestMessage: { ok: true, conversationId: "conv-1", message: { id: "g1", content: "ok" } } } });
  guestRepliesSpy = vi.fn();
  publicSettingsQuerySpy = vi.fn(() => ({ data: { publicAiChatbotSettings: { enabled: true, welcomeMessage: "Xin chào", starterQuickReplies: ["Gợi ý món bán chạy cho tôi"], handoffEnabled: true, handoffUnavailableMessage: "Không hỗ trợ" } } }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AiChatbotWidget basic", () => {
  it("normal AI flow before handoff", async () => {
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />); open(); send("Xin chào");
    await waitFor(() => expect(askMutationSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Trợ lý đã tiếp nhận.")).toBeInTheDocument();
  });

  it("shows friendly message when ask is rate limited", async () => {
    askMutationSpy.mockRejectedValueOnce({ graphQLErrors: [{ message: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.", extensions: { code: "RATE_LIMITED" } }] });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />); open(); send("Xin chào");
    await waitFor(() => expect(screen.getByText("Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.")).toBeInTheDocument());
  });

  it("prevents rapid quick-reply double submit while in flight", async () => {
    let release; askMutationSpy.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />); open();
    const quick = screen.getByRole("button", { name: "Gợi ý món bán chạy cho tôi" });
    fireEvent.click(quick); fireEvent.click(quick);
    expect(askMutationSpy).toHaveBeenCalledTimes(1);
    await act(async () => release({ data: { askAiChatbot: { answer: "ok", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1" } } }));
  });

  it("disables input while guest send is loading", () => {
    guestSendLoadingState = true;
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />); open();
    expect(screen.getByPlaceholderText(/Hỏi về món ăn/i)).toBeDisabled();
  });

  it("hides handoff action when handoffEnabled=false", async () => {
    publicSettingsQuerySpy = vi.fn(() => ({ data: { publicAiChatbotSettings: { enabled: true, welcomeMessage: "Xin chào", starterQuickReplies: ["Gợi ý món bán chạy cho tôi"], handoffEnabled: false, handoffUnavailableMessage: "Không hỗ trợ" } } }));
    askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "ok", quickReplies: [], actions: [{ type: "navigate", label: "Mở menu", href: "/menu" }, { type: "handoff", label: "Gặp nhân viên", href: "/support" }], contextSummary: null, conversationId: "conv-1" } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />); open(); send("Xin chào");
    await waitFor(() => expect(screen.getByRole("button", { name: "Mở menu" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Gặp nhân viên" })).not.toBeInTheDocument();
  });

  it("menu card renders and safe add-to-cart", async () => {
    askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "Gợi ý", intent: "menu", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1", sources: [{ type: "menuItem", id: "food-1", label: "Phở bò", formattedPrice: "90.000đ", isAvailable: true, restaurantId: "resto-1", currentPrice: 90000 }] } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />); open(); send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    expect(addToCartSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "food-1", quantity: 1, price: 90000 }));
    expect(screen.getAllByText(/Đã thêm Phở bò vào giỏ/)).toHaveLength(1);
  });

  it("unavailable/optioned items do not show add button", async () => {
    askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "Gợi ý", intent: "menu", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1", sources: [{ type: "menuItem", id: "food-1", label: "A", isAvailable: false, restaurantId: "resto-1", currentPrice: 90000 }, { type: "menuItem", id: "food-2", label: "B", isAvailable: true, restaurantId: "resto-1", currentPrice: 90000, hasOptions: true }] } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />); open(); send("gợi ý món");
    await waitFor(() => expect(screen.getByText("A")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();
  });
});
