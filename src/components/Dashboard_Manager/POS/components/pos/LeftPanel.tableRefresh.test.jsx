import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import { usePos } from "../../../../../context/PosContext";
import LeftPanel from "./LeftPanel";

const mocks = vi.hoisted(() => ({
  mergeTables: vi.fn(),
  refetchTables: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("../../../../../context/PosContext", () => ({
  usePos: vi.fn(),
}));

vi.mock("../modals/TableActionsModal", () => ({
  TableActionsModal: ({ isOpen, onUpdated }) =>
    isOpen ? (
      <button type="button" data-testid="table-modal-updated" onClick={onUpdated}>
        Refresh modal tables
      </button>
    ) : null,
}));

vi.mock("../modals/RegularCustomerModal", () => ({
  default: () => null,
}));

vi.mock("./TableReservationRealtimeBadge", () => ({
  default: () => null,
}));

vi.mock("@/hooks/useSocketReservation", () => ({
  RESERVATION_EVENT_TYPES: {
    CONFIRMED: "confirmed",
    CANCELLED: "cancelled",
    PAYMENT_EXPIRED: "payment_expired",
    CHECKED_IN: "checked_in",
  },
  RESERVATION_SOCKET_EVENT: "reservation:test",
}));

vi.mock("@/utils/posPaymentRequests", () => ({
  POS_PAYMENT_REQUESTS_QUERY: {},
  normalizePosPaymentRequests: () => [],
  buildTablePaymentRequestMap: () => new Map(),
}));

const buildPosContext = () => ({
  floors: [],
  restaurantId: "restaurant-1",
  resetPosOrderSession: vi.fn(),
  switchOffPremiseMode: vi.fn(),
  ensureOffPremiseSession: vi.fn(),
  createNewOffPremiseOrder: vi.fn(),
  tables: [
    {
      id: "table-a1",
      code: "A1",
      capacity: 4,
      status: "available",
      floorId: "floor-1",
    },
    {
      id: "table-a2",
      code: "A2",
      capacity: 4,
      status: "available",
      floorId: "floor-1",
    },
  ],
  currentTable: null,
  currentOrder: [],
  refetchTables: mocks.refetchTables,
  mergeTables: mocks.mergeTables,
  currentOrderType: "dine_in",
  setCurrentOrderType: vi.fn(),
  startDeliveryOrder: vi.fn(),
  startTakeawayOrder: vi.fn(),
  selectTableForOrder: vi.fn(),
  currentOrderId: null,
  currentOrderCode: null,
  setCurrentOrderId: vi.fn(),
  setCurrentTable: vi.fn(),
  setCurrentOrder: vi.fn(),
  setCurrentOrderCode: vi.fn(),
  fetchOrderById: vi.fn(),
  loadOrdersNow: vi.fn(),
  ordersNow: [],
  ordersLoading: false,
  deliveryCustomer: null,
  setDeliveryCustomer: vi.fn(),
  shippingInfo: {},
  setShippingInfo: vi.fn(),
});

describe("LeftPanel table refresh wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockReturnValue({ data: null });
    usePos.mockReturnValue(buildPosContext());
    mocks.mergeTables.mockResolvedValue({ mergedTableId: "merged-1" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("refreshes after a successful drag-drop merge without showing failure", async () => {
    render(<LeftPanel />);

    const cards = screen.getAllByTitle("Kéo thả để gộp bàn");
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => "table-a1"),
      effectAllowed: "move",
    };

    fireEvent.dragStart(cards[0], { dataTransfer });
    fireEvent.drop(cards[1], { dataTransfer });

    await waitFor(() => {
      expect(mocks.mergeTables).toHaveBeenCalledWith({
        tableIds: ["table-a1", "table-a2"],
        anchorId: "table-a2",
      });
      expect(mocks.refetchTables).toHaveBeenCalledTimes(1);
    });
    expect(window.alert).not.toHaveBeenCalledWith("Gộp bàn thất bại.");
  });

  it("passes refetchTables to the table action modal for split refresh", () => {
    render(<LeftPanel />);

    const firstCard = screen.getByText("A1").closest('[title="Kéo thả để gộp bàn"]');
    fireEvent.click(within(firstCard).getByRole("button"));
    fireEvent.click(screen.getByTestId("table-modal-updated"));

    expect(mocks.refetchTables).toHaveBeenCalledTimes(1);
  });
});
