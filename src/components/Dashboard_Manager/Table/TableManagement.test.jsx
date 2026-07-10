import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";

const tableManagementState = vi.hoisted(() => ({
  restaurantId: null,
  tables: [],
  tablesLoading: false,
  tablesError: null,
  createTable: vi.fn(),
  refetchTables: vi.fn(),
}));

const floorManagementState = vi.hoisted(() => ({
  restaurantId: null,
  floors: [],
  floorsLoading: false,
  floorsError: null,
  setActiveLevel: vi.fn(),
  getIdFromLevel: vi.fn(),
  getLevelFromId: vi.fn((floorId) => (floorId === "floor-1" ? 1 : 2)),
  createFloor: vi.fn(),
}));

const tableActionsModalState = vi.hoisted(() => ({
  renderCount: 0,
  lastTable: null,
}));

vi.mock("@/hooks/useTableManagement", () => ({
  default: ({ restaurantId }) => {
    tableManagementState.restaurantId = restaurantId;
    return {
      tables: tableManagementState.tables,
      tablesLoading: tableManagementState.tablesLoading,
      tablesError: tableManagementState.tablesError,
      setTableStatus: vi.fn(),
      createTable: tableManagementState.createTable,
      updateTable: vi.fn(),
      refetchTables: tableManagementState.refetchTables,
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
  default: ({ restaurantId }) => {
    floorManagementState.restaurantId = restaurantId;
    return {
      floors: floorManagementState.floors,
      floorsLoading: floorManagementState.floorsLoading,
      floorsError: floorManagementState.floorsError,
      setActiveLevel: floorManagementState.setActiveLevel,
      getIdFromLevel: floorManagementState.getIdFromLevel,
      getLevelFromId: floorManagementState.getLevelFromId,
      createFloor: floorManagementState.createFloor,
    };
  },
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

vi.mock("./TableActionsLiteModal", () => ({
  default: ({ table }) => {
    tableActionsModalState.renderCount += 1;
    tableActionsModalState.lastTable = table;
    return <div data-testid="table-actions-lite-modal">Chi tiết {table?.code}</div>;
  },
}));

const renderTableManagement = async () => {
  const module = await import("./TableManagement.jsx");
  const TableManagement = module.default;
  const renderTree = () => (
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          restaurants: [
            { id: "restaurant-1", name: "Cơ sở trung tâm" },
            { id: "restaurant-2", name: "Cơ sở quận 2" },
          ],
        }}
      >
        <TableManagement />
      </AuthContext.Provider>
    </MemoryRouter>
  );

  const view = render(renderTree());
  return {
    ...view,
    rerenderTableManagement: () => view.rerender(renderTree()),
  };
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
      position: { x: 50, y: 50 },
    },
    {
      id: "table-id-raw-2",
      code: "VIP-02",
      capacity: 6,
      status: "occupied",
      floorId: "floor-2",
      type: "vip",
      deposit: 200000,
      vrUrl: "/vr/table/table-id-raw-2",
      position: { x: 130, y: 50 },
    },
  ];
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  tableActionsModalState.renderCount = 0;
  tableActionsModalState.lastTable = null;
  tableManagementState.restaurantId = null;
  tableManagementState.tablesLoading = false;
  tableManagementState.tablesError = null;
  tableManagementState.createTable.mockReset();
  tableManagementState.createTable.mockResolvedValue({ id: "table-new" });
  tableManagementState.refetchTables.mockReset();
  tableManagementState.refetchTables.mockResolvedValue({ data: { tables: [] } });
  floorManagementState.restaurantId = null;
  floorManagementState.floorsLoading = false;
  floorManagementState.floorsError = null;
  floorManagementState.setActiveLevel.mockClear();
  floorManagementState.getIdFromLevel.mockClear();
  floorManagementState.getLevelFromId.mockClear();
  floorManagementState.createFloor.mockReset();
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

  it("passes the shared manager branch to table and floor queries", async () => {
    await renderTableManagement();

    await waitFor(() => {
      expect(tableManagementState.restaurantId).toBe("restaurant-1");
      expect(floorManagementState.restaurantId).toBe("restaurant-1");
    });

    window.dispatchEvent(
      new CustomEvent("manager:scope-selection", {
        detail: {
          key: "manager.selectedRestaurantId",
          value: "restaurant-2",
        },
      }),
    );

    await waitFor(() => {
      expect(tableManagementState.restaurantId).toBe("restaurant-2");
      expect(floorManagementState.restaurantId).toBe("restaurant-2");
    });
  });

  it("renders table codes instead of exposing raw ids", async () => {
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

    expect(
      screen.getByText("Không có bàn phù hợp với bộ lọc hiện tại."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("opens the detail modal from the normal detail action", async () => {
    await renderTableManagement();

    const tableCard = screen.getByText("A1").closest("article");
    fireEvent.click(
      within(tableCard).getByRole("button", {
        name: /Mở cấu hình bàn A1/i,
      }),
    );

    expect(screen.getByTestId("table-actions-lite-modal")).toBeInTheDocument();
    expect(tableActionsModalState.lastTable?.code).toBe("A1");
  });

  it("opens table details to add a panorama when the table has no 360 content", async () => {
    await renderTableManagement();

    const tableCard = screen.getByText("A1").closest("article");
    const panoramaButton = within(tableCard).getByRole("button", {
      name: /Thêm ảnh 360 cho bàn A1/i,
    });
    expect(panoramaButton).toHaveTextContent("Thêm ảnh 360°");
    fireEvent.click(panoramaButton);

    expect(screen.getByTestId("table-actions-lite-modal")).toBeInTheDocument();
    expect(tableActionsModalState.lastTable?.code).toBe("A1");
  });

  it("keeps the open detail modal synchronized after table data refetches", async () => {
    const { rerenderTableManagement } = await renderTableManagement();

    const tableCard = screen.getByText("A1").closest("article");
    fireEvent.click(
      within(tableCard).getByRole("button", { name: /Mở cấu hình bàn A1/i }),
    );

    tableManagementState.tables = tableManagementState.tables.map((item) =>
      item.code === "A1" ? { ...item, joinGroupId: "group-1" } : item,
    );
    rerenderTableManagement();

    expect(tableActionsModalState.lastTable?.joinGroupId).toBe("group-1");
  });

  it("removes all table 3D and AR entry points", async () => {
    await renderTableManagement();

    expect(screen.queryByText("Mô phỏng 3D")).not.toBeInTheDocument();
    expect(screen.queryByText("3D / AR")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Mở 3D và AR/i }),
    ).not.toBeInTheDocument();
  });

  it("creates a table with operational fields only", async () => {
    await renderTableManagement();

    fireEvent.click(screen.getByRole("button", { name: /Thêm bàn/i }));
    expect(screen.getByRole("heading", { name: "Thêm bàn" })).toBeInTheDocument();
    expect(
      screen.getByText("Thêm ảnh không gian sau khi tạo bàn"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mô phỏng 3D/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Số bàn *"), {
      target: { value: "A2" },
    });
    fireEvent.change(screen.getByLabelText("Tầng *"), {
      target: { value: "floor-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo bàn" }));

    await waitFor(() => {
      expect(tableManagementState.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "restaurant-1",
          code: "A2",
          capacity: 4,
          floorId: "floor-1",
          type: "standard",
          status: "available",
          position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        }),
      );
    });
    expect(tableManagementState.createTable.mock.calls[0][0]).not.toHaveProperty(
      "visualConfig",
    );
  });

  it("disables POS-managed quick actions with the guard reason", async () => {
    await renderTableManagement();

    const occupiedCard = screen.getByText("VIP-02").closest("article");
    const paymentAction = within(occupiedCard).getByRole("button", {
      name: "Thanh toán",
    });

    expect(paymentAction).toBeDisabled();
    expect(paymentAction).toHaveAttribute(
      "title",
      "Vui lòng thao tác tại POS để đồng bộ order và phiên bàn.",
    );
  });
});
