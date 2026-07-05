import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import Header from "./Header";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));
vi.mock("../SearchBox/SearchBox", () => ({ default: () => null }));
vi.mock("./Account/ManagerAccountCenter", () => ({ default: () => null }));

describe("Manager Header notification navigation", () => {
  let navigationDetail;
  const handleManagerNavigate = (event) => {
    navigationDetail = event.detail;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    navigationDetail = null;
    window.addEventListener("manager:navigate", handleManagerNavigate);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener("manager:navigate", handleManagerNavigate);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("syncs a handoff notification URL with React Router before opening the manager page", () => {
    const actionUrl = "/manager?restaurantId=r1&threadId=t1#ai-handoff";

    render(
      <AuthContext.Provider
        value={{
          user: {
            id: "manager-1",
            fullName: "Quản lý Test",
            email: "manager@example.com",
            roleName: "manager",
          },
        }}
      >
        <Header
          notifications={[
            {
              id: "n1",
              type: "info",
              title: "Khách cần hỗ trợ",
              message: "Mở hội thoại bàn giao",
              time: "Vừa xong",
              read: false,
              actionUrl,
            },
          ]}
        />
      </AuthContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở thông báo" }));
    fireEvent.click(screen.getByRole("button", { name: /Khách cần hỗ trợ/i }));

    expect(navigateMock).toHaveBeenCalledWith(actionUrl, { replace: true });
    expect(navigationDetail).toEqual({
      page: "ai-handoff",
      query: { restaurantId: "r1", threadId: "t1" },
      source: "notification",
    });
  });
});
