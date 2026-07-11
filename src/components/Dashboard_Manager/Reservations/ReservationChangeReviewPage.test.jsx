import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import ReservationChangeReviewPage from "./ReservationChangeReviewPage";

const apolloMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@apollo/client/react", () => apolloMocks);
vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

const reservation = {
  id: "reservation-1",
  orderCode: "RES-001",
  restaurantId: "restaurant-1",
  tableId: "table-1",
  timeTo: "2026-07-12T12:00:00.000Z",
  customerName: "Khách thử nghiệm",
  customerPhone: "0900000000",
  changeRequestType: "time",
  changeRequestFee: 0,
  requestedTimeTo: "2026-07-12T13:00:00.000Z",
};

const renderPage = (permissions = []) =>
  render(
    <AuthContext.Provider
      value={{
        user: {
          id: "staff-1",
          roleName: "server",
          effectivePermissionCodes: permissions,
        },
        restaurants: [{ id: "restaurant-1", name: "Cohan Test" }],
      }}
    >
      <ReservationChangeReviewPage />
    </AuthContext.Provider>,
  );

describe("ReservationChangeReviewPage permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apolloMocks.useQuery.mockReturnValue({
      data: { pendingReservationChanges: [reservation] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    apolloMocks.useMutation.mockImplementation(() => [vi.fn(), { loading: false }]);
  });

  it("skips the query and shows a clear state without reservation.read", () => {
    renderPage();

    expect(apolloMocks.useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bạn chưa được cấp quyền xem yêu cầu đổi đặt bàn.",
    );
    expect(screen.queryByText("Khách thử nghiệm")).not.toBeInTheDocument();
  });

  it("shows request details without mutation controls for read-only staff", () => {
    renderPage(["reservation.read"]);

    expect(apolloMocks.useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: false }),
    );
    expect(screen.getByText(/Khách thử nghiệm/)).toBeInTheDocument();
    expect(screen.getByText(/chỉ có quyền xem yêu cầu/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duyệt thay đổi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
  });

  it("shows approve and reject controls with reservation.update", () => {
    renderPage(["reservation.read", "reservation.update"]);

    expect(screen.getByRole("button", { name: "Duyệt thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ghi chú xử lý" })).toBeInTheDocument();
  });
});
