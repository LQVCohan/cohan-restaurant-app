import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import TodayMealWizard from "./TodayMealWizard";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";

vi.mock("@/utils/aiChatbotEvents", () => ({
  openAiMenuAssistant: vi.fn(),
}));

const renderWizard = ({ route = "/restaurants", user = { id: "customer-1", fullName: "Linh" } } = {}) =>
  render(
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user) }}>
      <MemoryRouter initialEntries={[route]}>
        <TodayMealWizard />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("TodayMealWizard", () => {
  it("renders on customer browsing pages", () => {
    renderWizard({ route: "/restaurants" });

    expect(screen.getByRole("region", { name: /wizard hỗ trợ chọn món hôm nay/i })).toBeInTheDocument();
    expect(screen.getByText("Hôm nay ăn gì?")).toBeInTheDocument();
    expect(screen.getByText("Hôm nay bạn muốn ăn kiểu gì?")).toBeInTheDocument();
  });

  it("does not render on checkout and manager pages", () => {
    const { rerender } = renderWizard({ route: "/checkout" });
    expect(screen.queryByText("Hôm nay ăn gì?")).not.toBeInTheDocument();

    rerender(
      <AuthContext.Provider value={{ user: { id: "manager-1", fullName: "Manager" }, isAuthenticated: true }}>
        <MemoryRouter initialEntries={["/manager"]}>
          <TodayMealWizard />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByText("Hôm nay ăn gì?")).not.toBeInTheDocument();
  });

  it("minimizes and restores from launcher", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /thu nhỏ wizard/i }));
    expect(screen.getByRole("button", { name: /mở wizard hôm nay ăn gì/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mở wizard hôm nay ăn gì/i }));
    expect(screen.getByRole("region", { name: /wizard hỗ trợ chọn món hôm nay/i })).toBeInTheDocument();
  });

  it("builds a personalized AI prompt after completing all steps", async () => {
    renderWizard({ route: "/restaurant/restaurant-1" });

    fireEvent.click(screen.getByRole("button", { name: /nhanh gọn/i }));
    await waitFor(() => expect(screen.getByText("Ngân sách khoảng bao nhiêu?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /100k - 200k/i }));
    await waitFor(() => expect(screen.getByText("Khẩu vị hôm nay?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /ít cay/i }));
    await waitFor(() => expect(screen.getByText("Ăn cho mấy người?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /2 người/i }));
    fireEvent.click(screen.getByRole("button", { name: /hỏi ai/i }));

    expect(openAiMenuAssistant).toHaveBeenCalledTimes(1);
    const payload = openAiMenuAssistant.mock.calls[0][0];
    expect(payload.restaurantId).toBe("restaurant-1");
    expect(payload.autoSend).toBe(true);
    expect(payload.message).toContain("Linh");
    expect(payload.message).toContain("100k đến 200k");
    expect(payload.message).toContain("ít cay");
    expect(payload.message).toContain("2 người");
  });
});
