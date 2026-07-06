import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";

const tableManagementState = vi.hoisted(() => ({
  tables: [],
  tablesLoading: false,
  tablesError: null,
}));

const floorManagementState = vi.hoisted(() => ({
  floors: [],
  floorsLoading: false,
  floorsError: null,
  setActiveLevel: vi.fn(),
  getIdFromLevel: vi.fn(),
  getLevelFromId: vi.fn((floorId) => (floorId === "floor-1" ? 1 : 2)),
}));

const tableActionsModalState = vi.hoisted(() => ({
  renderCount: 0,
  lastTable: null,
}));

const table3dModalState = vi.hoisted(() => ({
  open: false,
  table: null,
  floor: null,
}));

vi.mock("@/hooks/useTableManagement", () => ({
  default: () => ({
    tables: tableManagementState.tables,
    tablesLoading: tableManagementState.tablesLoading,
    tablesError: tableManagementState.tablesError,
    setTableStatus: vi.fn(),
    createTable: vi.fn(),
    updateTable: vi.fn(),
    refetchTables: vi.fn(),
    moveTable: vi.fn(),
    deleteTable: vi.fn(),
    fetchTableByCode: vi.fn(),
    swapTableCodes: vi.fn(),
    mergeTables: vi.fn(),
    splitTables: vi.fn(),
  }),
}));

vi.mock("@/hooks/useFloorManagement", () => ({
  default: () => ({
    floors: floorManagementState.floors,
    floorsLoading: floorManagementState.floorsLoading,
    floorsError: floorManagementState.floorsError,
    setActiveLevel: floorManagementState.setActiveLevel,
    getIdFromLevel: floorManagementState.getIdFromLevel,
    getLevelFromId: floorManagementState.getLevelFromId,
    createFloor: vi.fn(),
  }),
}));

vi.mock("@/hooks/useRestaurant", () => ({
  useRestaurant: () => ({
    restaurant: {
      id: "restaurant-1",
      vrTourUrl: "",
      address: { lat: 10.7769, lng: 106.7009 },
    },
    updateRestaurant: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock("@/hooks/useModalDraft", () => ({
  default: () => ({
    didRestore: false,
    clearDraft: vi.fn(),
    requestCloseWithDraft: (close) => close(),
  }),
}));

vi.mock("@/utils/vrStorage", () => ({
  loadTableVrImage: () => "",
}));

vi.mock("./Table3DSimulatorModal", () => ({
  default: ({ open, table, floor }) => {
    table3dModalState.open = open;
    table3dModalState.table = table;
    table3dModalState.floor = floor;
    return open ? <div data-testid="table-3d-modal">3D {table?.code}</div> : null;
  },
}));

vi.mock("./TableActionsLiteModal", () => ({
  default: ({ table }) => {
    tableActionsModalState.renderCount += 1;
    tableActionsModalState.lastTable = table;
    return <div data-testid="table-actions-lite-modal">Chi tiết {table?.code}</div>;
  },
}));

const renderTableManagement = async () => {
  const mod = await import("./TableManagement.jsx");
  const TableManagement = mod.default;

  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          restaurants: [{ id: "restaurant-1", name: "Cơ sở trung tâm" }],
        }}
      >
        <TableManagement />
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

const setDefaultData = () => {
  floorManagementState.floors = [
    { id: "floor-1", name: "Tầng 1", level: 1 },
    { id: "floor-2", name: "Sân thượng", level: 2 },
  ];
  tableManagementState.tables = [
    {
      id: "table-id-raw-1",
      code: "A1",
      capacity: 4,
      status: "available",
      floorId: "floor-1",
      type: "standard",
      deposit: 0,
    },
    {
      id: "table-id-raw-2",
      code: "VIP-02",
      capacity: 6,
      status: "occupied",
      floorId: "floor-2",
      type: "vip",
      deposit: 200000,
      visualConfig: { label: "Round VIP" },
    },
  ];
};

beforeEach(() => {
  vi.resetModules();
  tableActionsModalState.renderCount = 0;
  tableActionsModalState.lastTable = null;
  table3dModalState.open = false;
  table3dModalState.table = null;
  table3dModalState.floor = null;
  tableManagementState.tablesLoading = false;
  tableManagementState.tablesError = null;
  floorManagementState.floorsLoading = false;
  floorManagementState.floorsError = null;
  floorManagementState.setActiveLevel.mockClear();
  floorManagementState.getIdFromLevel.mockClear();
  floorManagementState.getLevelFromId.mockClear();
  setDefaultData();
});

describe("TableManagement operations UI", () => {
  it("renders the manager title and KPI labels from real table/floor data", async () => {
    await renderTableManagement();

    expect(screen.getByRole("heading", { name: /Quản lý bàn/i })).toBeInTheDocument();
    expect(screen.getByText("Tổng bàn")).toBeInTheDocument();
    expect(screen.getAllByText("Trống").length).toBeGreaterThan(0);
    expect(screen.getByText("Đang sử dụng")).toBeInTheDocument();
    expect(screen.getByText("Số tầng")).toBeInTheDocument();
  });

  it("renders the table code instead of exposing the raw table id", async () => {
    await renderTableManagement();

    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("VIP-02")).toBeInTheDocument();
    expect(screen.queryByText("table-id-raw-1")).not.toBeInTheDocument();
  });

  it("shows the filtered empty state and reset action when search has no matches", async () => {
    await renderTableManagement();

    fireEvent.change(screen.getByLabelText("Tìm bàn theo mã hoặc số bàn"), {
      target: { value: "ZZZ" },
    });

    expect(screen.getByText("Không có bàn phù hợp với bộ lọc hiện tại.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("opens the detail modal when the detail button is clicked", async () => {
    await renderTableManagement();

    const tableCard = screen.getByText("A1").closest("article");
    const detailButton = within(tableCard).getByRole("button", {
      name: /Mở cấu hình bàn A1/i,
    });
    fireEvent.click(detailButton);

    expect(screen.getByTestId("table-actions-lite-modal")).toBeInTheDocument();
    expect(tableActionsModalState.lastTable?.code).toBe("A1");
  });

  it("opens 3D and AR with the concrete table and floor", async () => {
    await renderTableManagement();

    const tableCard = screen.getByText("A1").closest("article");
    const arButton = within(tableCard).getByRole("button", {
      name: /Mở 3D và AR cho bàn A1/i,
    });
    fireEvent.click(arButton);

    expect(screen.getByTestId("table-3d-modal")).toBeInTheDocument();
    expect(table3dModalState.open).toBe(true);
    expect(table3dModalState.table?.code).toBe("A1");
    expect(table3dModalState.floor?.id).toBe("floor-1");
  });

  it("disables POS-managed quick actions with the guard reason", async () => {
    await renderTableManagement();

    const occupiedCard = screen.getByText("VIP-02").closest("article");
    const paymentAction = within(occupiedCard).getByRole("button", { name: "Thanh to\u00e1n" });

    expect(paymentAction).toBeDisabled();
    expect(paymentAction).toHaveAttribute(
      "title",
      "Vui lòng thao tác tại POS để đồng bộ order và phiên bàn."
    );
  });
});
