import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { useState } from "react";
import OrderManagement, { RejectOrderDialog } from "./OrderManagement";
import { AuthContext } from "@/context/AuthContext";

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings.join(""),
  useLazyQuery: () => [
    vi.fn(() => Promise.resolve()),
    {
      data: {
        ordersByRestaurantNow: {
          edges: [],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
      loading: false,
      error: null,
    },
  ],
  useMutation: () => [vi.fn(() => Promise.resolve({ data: {} }))],
  useQuery: () => ({
    data: { myBrands: [] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useOrderManagement", () => ({
  default: () => ({
    updateItemStatus: vi.fn(),
    reviewOrderItemVoid: vi.fn(),
    requestOrderItemReturn: vi.fn(),
    reviewOrderItemReturn: vi.fn(),
  }),
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock("@/hooks/useSocketOrder", () => ({
  default: vi.fn(),
}));

vi.mock("./components/OrderCard", () => ({
  default: () => <article>Order card</article>,
}));
vi.mock("./components/OrderModal", () => ({
  default: () => <div>Order modal</div>,
}));
vi.mock("./components/ItemModal", () => ({
  default: () => <div>Item modal</div>,
}));
vi.mock("./components/HistoryModal", () => ({
  default: () => <div>History modal</div>,
}));
vi.mock("./components/NewOrderModal", () => ({
  default: () => <div>New order modal</div>,
}));
vi.mock("./components/OrderSettingsModal", () => ({
  default: () => <div>Order settings modal</div>,
}));
vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ title, primaryAction }) => (
    <section>
      <h1>{title}</h1>
      {primaryAction ? (
        <button type="button" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
      ) : null}
    </section>
  ),
}));

const RejectDialogHarness = ({ onConfirm = vi.fn() }) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  return (
    <RejectOrderDialog
      open
      orderLabel="ORD-2026-0007"
      reason={reason}
      error={error}
      onReasonChange={(value) => {
        setReason(value);
        setError("");
      }}
      onCancel={vi.fn()}
      onConfirm={() => {
        if (!reason.trim()) {
          setError("Vui lòng nhập lý do từ chối đơn.");
          return;
        }
        onConfirm(reason.trim());
      }}
    />
  );
};

const renderOrderManagement = () =>
  render(
    <AuthContext.Provider
      value={{
        restaurants: [{ id: "restaurant-1", name: "Cohan Test" }],
        user: { id: "manager-1", role: { name: "Manager" } },
      }}
    >
      <OrderManagement />
    </AuthContext.Provider>,
  );

afterEach(() => {
  document.body.style.overflow = "";
});

describe("RejectOrderDialog", () => {
  it("shows validation when the reject reason is empty", () => {
    render(<RejectDialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: /xác nhận từ chối/i }));

    expect(screen.getByText("Vui lòng nhập lý do từ chối đơn.")).toBeInTheDocument();
  });

  it("accepts a reject reason and calls confirm", () => {
    const onConfirm = vi.fn();
    render(<RejectDialogHarness onConfirm={onConfirm} />);

    fireEvent.change(screen.getByRole("textbox", { name: /lý do từ chối/i }), {
      target: { value: "Món đã hết" },
    });
    fireEvent.click(screen.getByRole("button", { name: /xác nhận từ chối/i }));

    expect(onConfirm).toHaveBeenCalledWith("Món đã hết");
  });
});

describe("OrderManagement kitchen display", () => {
  it("renders fullscreen kitchen display and locks body scroll when focus mode is enabled", () => {
    renderOrderManagement();

    fireEvent.click(screen.getByRole("button", { name: /chế độ bếp/i }));

    expect(screen.getByRole("heading", { name: /màn hình bếp/i })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("switches from the kitchen queue to the bar queue", () => {
    renderOrderManagement();

    fireEvent.click(screen.getByRole("button", { name: /chế độ bếp/i }));
    const barButton = screen.getByRole("button", {
      name: /quầy bar, 0 món cần xử lý/i,
    });

    fireEvent.click(barButton);

    expect(
      screen.getByRole("heading", { name: /màn hình quầy bar/i }),
    ).toBeInTheDocument();
    expect(barButton).toHaveAttribute("aria-pressed", "true");
  });

  it("exits focus mode with Escape and restores body overflow", () => {
    renderOrderManagement();

    fireEvent.click(screen.getByRole("button", { name: /chế độ bếp/i }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("heading", { name: /màn hình bếp/i })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the F shortcut for toggling kitchen focus mode", () => {
    renderOrderManagement();

    fireEvent.keyDown(window, { key: "f" });
    expect(screen.getByRole("heading", { name: /màn hình bếp/i })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "F" });
    expect(screen.queryByRole("heading", { name: /màn hình bếp/i })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("restores body overflow when unmounting from focus mode", () => {
    document.body.style.overflow = "auto";
    const { unmount } = renderOrderManagement();

    fireEvent.click(screen.getByRole("button", { name: /chế độ bếp/i }));
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
