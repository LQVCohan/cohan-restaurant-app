import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import HelpPage from "./HelpPage";

const comm = vi.hoisted(() => ({
  openThread: vi.fn(),
  loadThread: vi.fn(),
  sendMessage: vi.fn(),
  markThreadRead: vi.fn(),
  args: [],
}));

vi.mock("@/hooks/useCommunication", () => ({
  default: (args) => {
    comm.args.push(args);
    return {
      thread: { messages: [] },
      loadThread: comm.loadThread,
      openThread: comm.openThread,
      sendMessage: comm.sendMessage,
      sendMessageState: { loading: false },
      markThreadRead: comm.markThreadRead,
    };
  },
}));

const renderHelp = (authValue, route = "/help") => render(
  <MemoryRouter initialEntries={[route]}>
    <AuthContext.Provider value={authValue}>
      <HelpPage />
    </AuthContext.Provider>
  </MemoryRouter>,
);

describe("HelpPage customer support restaurant context", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.clearAllMocks();
    comm.args = [];
    comm.openThread.mockResolvedValue({ data: { openChatThread: { id: "thread-1" } } });
    comm.markThreadRead.mockResolvedValue({ data: true });
    comm.loadThread.mockResolvedValue({ data: {} });
  });

  it("opens support thread from customer's recent restaurant", async () => {
    renderHelp({ user: { id: "customer-1", roleName: "customer" }, refRestaurant: [{ id: "restaurant-recent" }] });

    fireEvent.click(screen.getByRole("button", { name: /chat với hỗ trợ ngay/i }));

    await waitFor(() => expect(comm.openThread).toHaveBeenCalledWith(expect.objectContaining({
      variables: { input: expect.objectContaining({ restaurantId: "restaurant-recent" }) },
    })));
  });

  it("guides customer to choose a restaurant when context is missing", async () => {
    renderHelp({ user: { id: "customer-1", roleName: "customer" }, refRestaurant: [] });

    fireEvent.click(screen.getByRole("button", { name: /chat với hỗ trợ ngay/i }));

    expect(await screen.findByText("Vui lòng chọn một nhà hàng trước khi bắt đầu trò chuyện hỗ trợ.")).toBeInTheDocument();
    expect(comm.openThread).not.toHaveBeenCalled();
  });

  it("does not use restaurantForStaff as customer support context", async () => {
    renderHelp({ user: { id: "customer-1", roleName: "customer", restaurantForStaff: "staff-restaurant" }, refRestaurant: [] });

    fireEvent.click(screen.getByRole("button", { name: /chat với hỗ trợ ngay/i }));

    expect(await screen.findByText("Vui lòng chọn một nhà hàng trước khi bắt đầu trò chuyện hỗ trợ.")).toBeInTheDocument();
    expect(comm.openThread).not.toHaveBeenCalled();
    expect(comm.args.at(-1)?.restaurantId).toBeNull();
  });
});
