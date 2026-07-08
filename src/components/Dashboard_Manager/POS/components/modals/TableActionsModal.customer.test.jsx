import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLazyQuery, useMutation } from "@apollo/client";
import { usePos } from "../../../../../context/PosContext";
import useOrderManagement from "../../../../../hooks/useOrderManagement";
import { useReservation } from "../../../../../hooks/useReservation";
import { useNotification } from "../../../../../hooks/useNotification";
import { TableActionsModal } from "./TableActionsModal";

const mocks = vi.hoisted(() => ({
  upsertTableCustomer: vi.fn(),
  findConfirmedByTable: vi.fn(),
  fetchOrderByTable: vi.fn(),
  onUpdated: vi.fn(),
  showNotification: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useLazyQuery: vi.fn(),
    useMutation: vi.fn(),
  };
});

vi.mock("../../../../../context/PosContext", () => ({
  usePos: vi.fn(),
}));

vi.mock("../../../../../hooks/useOrderManagement", () => ({
  default: vi.fn(),
}));

vi.mock("../../../../../hooks/useReservation", () => ({
  useReservation: vi.fn(),
}));

vi.mock("../../../../../hooks/useNotification", () => ({
  useNotification: vi.fn(),
}));

const table = {
  id: "table-v101",
  code: "V101",
  capacity: 4,
  type: "standard",
  tags: [],
  status: "reserved",
  floorId: "floor-1",
  floorLevel: 1,
  joinGroupId: null,
};

const buildPosContext = () => ({
  restaurantId: "restaurant-1",
  floors: [{ id: "floor-1", level: 1 }],
  getIdFromLevel: vi.fn(() => "floor-1"),
  refetchTables: vi.fn(),
  updateTable: vi.fn().mockResolvedValue(table),
  setTableStatus: vi.fn(),
  moveTable: vi.fn(),
  swapTableCodes: vi.fn(),
  mergeTables: vi.fn(),
  splitTables: vi.fn(),
  deleteTable: vi.fn(),
  fetchTableByCode: vi.fn(),
  fetchOrderByTable: mocks.fetchOrderByTable,
});

describe("TableActionsModal customer snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const timeFrom = new Date(2026, 7, 7, 18, 0, 0, 0).toISOString();
    const timeTo = new Date(2026, 7, 7, 20, 0, 0, 0).toISOString();
    const savedCustomer = {
      id: "table-customer-1",
      restaurantId: "restaurant-1",
      tableId: table.id,
      tableCode: table.code,
      customerName: "Toàn",
      customerPhone: "0900809090",
      customerEmail: "toan@cohan.local",
      note: "Khách cần ghế gần cửa sổ",
      partySize: 3,
      timeFrom,
      timeTo,
    };

    usePos.mockReturnValue(buildPosContext());
    useOrderManagement.mockReturnValue({
      updateOrderCustomerByCode: vi.fn(),
    });
    useReservation.mockReturnValue({
      findConfirmedByTable: mocks.findConfirmedByTable,
      checkInReservation: vi.fn(),
      approveReservationChange: vi.fn(),
      rejectReservationChange: vi.fn(),
    });
    useNotification.mockReturnValue({
      showNotification: mocks.showNotification,
    });

    mocks.findConfirmedByTable.mockResolvedValue({ success: true, data: null });
    mocks.fetchOrderByTable.mockResolvedValue({ data: [] });
    mocks.upsertTableCustomer.mockResolvedValue({
      data: { upsertTableCustomer: savedCustomer },
    });
    mocks.onUpdated.mockResolvedValue(undefined);

    useMutation.mockReturnValue([mocks.upsertTableCustomer, { loading: false }]);
    useLazyQuery.mockImplementation((document) => {
      const body = document?.loc?.source?.body || "";
      if (body.includes("query TableCustomer")) {
        const [data, setData] = React.useState(null);
        const run = React.useCallback(async () => {
          const next = { tableCustomer: savedCustomer };
          setData(next);
          return { data: next };
        }, []);
        const refetch = React.useCallback(
          async () => ({ data: { tableCustomer: savedCustomer } }),
          [],
        );
        return [run, { data, loading: false, error: null, refetch }];
      }
      return [
        vi.fn().mockResolvedValue({ data: { customers: [] } }),
        { data: null, loading: false, error: null },
      ];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores a reserved table customer without an active reservation", async () => {
    render(
      <TableActionsModal
        isOpen
        table={table}
        onClose={vi.fn()}
        onUpdated={mocks.onUpdated}
      />,
    );

    expect(await screen.findByLabelText("Tên khách")).toHaveValue("Toàn");
    expect(screen.getByLabelText("Số điện thoại")).toHaveValue("0900809090");
    expect(screen.getByLabelText("Email")).toHaveValue("toan@cohan.local");
    expect(screen.getByLabelText("Số khách")).toHaveValue(3);
    expect(screen.getByLabelText("Ngày đặt")).toHaveValue("2026-08-07");
    expect(screen.getByLabelText("Giờ vào")).toHaveValue("18:00");
    expect(screen.getByLabelText("Giờ kết thúc")).toHaveValue("20:00");
    expect(screen.getByLabelText("Ghi chú")).toHaveValue(
      "Khách cần ghế gần cửa sổ",
    );
    expect(screen.getByText("Sức chứa bàn: 4")).toBeInTheDocument();
  });

  it("persists both schedule times and refreshes the POS table list after save", async () => {
    render(
      <TableActionsModal
        isOpen
        table={table}
        onClose={vi.fn()}
        onUpdated={mocks.onUpdated}
      />,
    );

    const note = await screen.findByLabelText("Ghi chú");
    fireEvent.change(note, { target: { value: "Cập nhật ghi chú" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin khách" }));

    await waitFor(() => {
      expect(mocks.upsertTableCustomer).toHaveBeenCalledTimes(1);
      expect(mocks.onUpdated).toHaveBeenCalledTimes(1);
    });

    const input = mocks.upsertTableCustomer.mock.calls[0][0].variables.input;
    expect(input).toEqual(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        tableId: table.id,
        tableCode: table.code,
        customerName: "Toàn",
        customerPhone: "0900809090",
        customerEmail: "toan@cohan.local",
        partySize: 3,
        note: "Cập nhật ghi chú",
      }),
    );
    expect(new Date(input.timeFrom).getHours()).toBe(18);
    expect(new Date(input.timeTo).getHours()).toBe(20);
    expect(mocks.showNotification).toHaveBeenCalledWith(
      "Đã lưu thông tin khách.",
      "success",
    );
  });
});
