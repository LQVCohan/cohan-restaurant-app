import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiChatbotWidget from "./AiChatbotWidget";

let askMutationSpy, handoffMutationSpy, guestRepliesSpy, guestMessageMutationSpy, publicSettingsQuerySpy;
const navigateSpy = vi.fn();
const addToCartSpy = vi.fn();

vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useParams: () => ({ id: "resto-1" }), useLocation: () => ({ pathname: "/restaurant/resto-1" }), useNavigate: () => navigateSpy }));
vi.mock("@/context/CartProvider", () => ({ useCart: () => ({ addToCart: addToCartSpy }) }));
vi.mock("socket.io-client", () => ({ io: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })) }));
vi.mock("@apollo/client/react", async () => ({ ...(await vi.importActual("@apollo/client/react")), useMutation: vi.fn((m) => {
  const b = m?.loc?.source?.body || "";
  if (b.includes("AskAiChatbot")) return [askMutationSpy, { loading: false }];
  if (b.includes("RequestAiChatbotHandoff")) return [handoffMutationSpy, { loading: false }];
  if (b.includes("SendAiChatbotGuestMessage")) return [guestMessageMutationSpy, { loading: false }];
  return [vi.fn(), { loading: false }];
}), useLazyQuery: vi.fn(() => [guestRepliesSpy, {}]), useQuery: vi.fn(() => publicSettingsQuerySpy()) }));

const open = () => fireEvent.click(screen.getByRole("button", { name: /Mở ChatBot A.I/i }));
const send = (t) => { fireEvent.change(screen.getByPlaceholderText(/Hỏi về món ăn/i), { target: { value: t } }); fireEvent.click(screen.getByRole("button", { name: /Gửi tin nhắn/i })); };

beforeEach(() => {
  navigateSpy.mockReset();
  addToCartSpy.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("cohan_ai_guest_id", "guest-1");
  askMutationSpy = vi.fn();
  handoffMutationSpy = vi.fn().mockResolvedValue({ data: { requestAiChatbotHandoff: { ok: true, handoffRequested: true } } });
  guestMessageMutationSpy = vi.fn();
  guestRepliesSpy = vi.fn();
  publicSettingsQuerySpy = vi.fn(() => ({ data: { publicAiChatbotSettings: { enabled: true, welcomeMessage: "Xin chào", starterQuickReplies: ["Gợi ý món bán chạy cho tôi"], handoffEnabled: true } } }));
});
afterEach(() => cleanup());

describe("AiChatbotWidget menu card CTA", () => {
  it("renders menu card and add safely", async () => {
    askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "Gợi ý", intent: "menu", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1", sources: [{ type: "menuItem", id: "food-1", label: "Phở bò", formattedPrice: "90.000đ", isAvailable: true, restaurantId: "resto-1", currentPrice: 90000 }] } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open(); send("gợi ý món");
    await waitFor(() => expect(screen.getByText("Phở bò")).toBeInTheDocument());
    expect(screen.getByText("90.000đ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    expect(addToCartSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "food-1", quantity: 1, price: 90000 }));
    expect(screen.getAllByText(/Đã thêm Phở bò vào giỏ/)).toHaveLength(1);
  });

  it("hides add button for unavailable/optioned items", async () => {
    askMutationSpy.mockResolvedValueOnce({ data: { askAiChatbot: { answer: "Gợi ý", intent: "menu", quickReplies: [], actions: [], contextSummary: null, conversationId: "conv-1", sources: [{ type: "menuItem", id: "food-1", label: "A", isAvailable: false, restaurantId: "resto-1", currentPrice: 90000 }, { type: "menuItem", id: "food-2", label: "B", isAvailable: true, restaurantId: "resto-1", currentPrice: 90000, hasOptions: true }] } } });
    render(<AiChatbotWidget testOverrides={{ disableSocket: true, disablePolling: true }} />);
    open(); send("gợi ý món");
    await waitFor(() => expect(screen.getByText("A")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();
  });
});
