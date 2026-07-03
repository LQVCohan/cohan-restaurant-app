import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const managerRestaurantSelectionState = vi.hoisted(() => ({
  initialRestaurantId: "restaurant-1",
  setSelectedRestaurantId: null,
  restaurantOptions: [
    { id: "restaurant-1", name: "Cơ sở trung tâm" },
    { id: "restaurant-2", name: "Chi nhánh 2" },
  ],
}));

const tableManagementState = vi.hoisted(() => ({
  restaurantId: "",
  tables: [],
  tablesLoading: false,
  tablesError: null,
}));

const floorManagementState = vi.hoisted(() => ({
  restaurantId: "",
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

vi.mock("@/hooks/useManagerRestaurantSelection", async () => {
  const ReactModule = await vi.importActual("react");
  return {
    default: () => {
      const [selectedRestaurantId, setSelectedRestaurantId] = ReactModule.useState(
        managerRestaurantSelectionState.initialRestaurantId,
      );
      managerRestaurantSelectionState.setSelectedRestaurantId = setSelectedRestaurantId;
      return {
        selectedRestaurantId,
        setSelectedRestaurantId,
        restaurantOptions: managerRestaurantSelectionState.restaurantOptions,
      };
    },
  };
});

vi.mock("@/hooks/useTableManagement", () => ({
  default: ({ restaurantId } = {}) => {
    tableManagementState.restaurantId = restaurantId;
    return {
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
    };
  },
}));

vi.mock("@/hooks/useFloorManagement", () => ({
  default: ({ restaurantId } = {}) => {
    floorManagementState.restaurantId = restaurantId;
    return {
      floors: floorManagementState.floors,
      floorsLoading: floorManagementState.floorsLoading,
      floorsError: floorManagementState.floorsError,
      setActiveLevel: floorManagementState.setActiveLevel,
      getIdFromLevel: floorManagementState.getIdFromLevel,
      getLevelFromId: floorManagementState.getLevelFromId,
      createFloor: vi.fn(),
    };
  },
}));

vi.mock("@/hooks/useRestaurant", () => ({
  useRestaurant: (restaurantId) => ({
    restaurant: { id: restaurantId, vrTourUrl: "" },
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
  default: () => null,
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
      <TableManagement />
    </MemoryRouter>,
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
  managerRestaurantSelectionState.initialRestaurantId = "restaurant-1";
  managerRestaurantSelectionState.setSelectedRestaurantId = null;
  tableActionsModalState.renderCount = 0;
  tableActionsModalState.lastTable = null;
  tableManagementState.restaurantId = "";
  tableManagementState.tablesLoading = false;
  tableManagementState.tablesError = null;
  floorManagementState.restaurantId = "";
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

  it("reloads table and floor data when the manager restaurant scope changes", async () => {
    await renderTableManagement();

    expect(tableManagementState.restaurantId).toBe("restaurant-1");
    expect(floorManagementState.restaurantId).toBe("restaurant-1");

    act(() => {
      managerRestaurantSelectionState.setSelectedRestaurantId("restaurant-2");
    });

    await waitFor(() => {
      expect(tableManagementState.restaurantId).toBe("restaurant-2");
      expect(floorManagementState.restaurantId).toBe("restaurant-2");
    });
    expect(screen.getByDisplayValue("Chi nhánh 2")).toBeInTheDocument();
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

  it("disables POS-managed quick actions with the guard reason", async () => {
    await renderTableManagement();

    const occupiedCard = screen.getByText("VIP-02").closest("article");
    const paymentAction = within(occupiedCard).getByRole("button", { name: "Thanh toán" });

    expect(paymentAction).toBeDisabled();
    expect(paymentAction).toHaveAttribute(
      "title",
      "Vui lòng thao tác tại POS để đồng bộ order và phiên bàn.",
    );
  });
});
