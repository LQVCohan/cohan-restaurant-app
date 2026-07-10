import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import WarehouseManagementDialog from "./WarehouseManagementDialog";

const apolloMocks = vi.hoisted(() => ({
  createWarehouse: vi.fn(),
  updateWarehouse: vi.fn(),
  deleteWarehouse: vi.fn(),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  const operationName = (document) => document?.definitions?.find(
    (definition) => definition.kind === "OperationDefinition",
  )?.name?.value;

  return {
    ...actual,
    useMutation: vi.fn((document) => {
      const handlers = {
        CreateWarehouse: apolloMocks.createWarehouse,
        UpdateWarehouse: apolloMocks.updateWarehouse,
        DeleteWarehouse: apolloMocks.deleteWarehouse,
      };
      return [handlers[operationName(document)] || vi.fn(), { loading: false }];
    }),
  };
});

const warehouses = [
  {
    id: "wh-1",
    name: "Kho chính",
    code: "MAIN",
    address: "Tầng trệt",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "wh-2",
    name: "Kho lạnh",
    code: "COLD",
    address: "Khu phía sau",
    createdAt: "2026-07-02T00:00:00.000Z",
  },
];

const writableUser = {
  id: "manager-1",
  permissions: ["inventory.write", "stock.write"],
};

const renderDialog = ({
  user = writableUser,
  rows = warehouses,
  onSelectWarehouse = vi.fn(),
} = {}) => render(
  <AuthContext.Provider value={{ user }}>
    <WarehouseManagementDialog
      open
      onClose={vi.fn()}
      restaurantId="res-1"
      warehouses={rows}
      selectedWarehouseId="wh-1"
      onSelectWarehouse={onSelectWarehouse}
    />
  </AuthContext.Provider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  apolloMocks.createWarehouse.mockResolvedValue({
    data: { createWarehouse: { id: "wh-3", name: "Kho khô" } },
  });
  apolloMocks.updateWarehouse.mockResolvedValue({
    data: { updateWarehouse: { id: "wh-2", name: "Kho đông lạnh" } },
  });
  apolloMocks.deleteWarehouse.mockResolvedValue({
    data: { deleteWarehouse: true },
  });
});

describe("WarehouseManagementDialog", () => {
  it("shows current count and creates another warehouse", async () => {
    const onSelectWarehouse = vi.fn();
    renderDialog({ onSelectWarehouse });

    expect(screen.getByRole("dialog", { name: "Quản lý danh sách kho" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Kho chính")).toBeInTheDocument();
    expect(screen.getByText("Kho lạnh")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thêm kho" }));
    fireEvent.change(screen.getByLabelText("Tên kho *"), {
      target: { value: "Kho khô" },
    });
    fireEvent.change(screen.getByLabelText("Mã kho"), {
      target: { value: "dry" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo kho" }));

    await waitFor(() => expect(apolloMocks.createWarehouse).toHaveBeenCalledOnce());
    expect(apolloMocks.createWarehouse.mock.calls[0][0]).toMatchObject({
      variables: {
        input: {
          restaurantId: "res-1",
          name: "Kho khô",
          code: "DRY",
          address: null,
          isActive: true,
        },
      },
      awaitRefetchQueries: true,
    });
    expect(onSelectWarehouse).toHaveBeenCalledWith("wh-3");
  });

  it("updates an existing warehouse", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Sửa kho Kho lạnh" }));
    const nameInput = screen.getByLabelText("Tên kho *");
    fireEvent.change(nameInput, { target: { value: "Kho đông lạnh" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(apolloMocks.updateWarehouse).toHaveBeenCalledOnce());
    expect(apolloMocks.updateWarehouse.mock.calls[0][0]).toMatchObject({
      variables: {
        input: {
          id: "wh-2",
          name: "Kho đông lạnh",
          code: "COLD",
          address: "Khu phía sau",
        },
      },
    });
  });

  it("protects the final warehouse and keeps read-only users view-only", () => {
    const { rerender } = renderDialog({ rows: [warehouses[0]] });

    expect(screen.getByRole("button", { name: "Xóa kho Kho chính" })).toBeDisabled();

    rerender(
      <AuthContext.Provider value={{ user: { id: "viewer-1", permissions: ["inventory.read"] } }}>
        <WarehouseManagementDialog
          open
          onClose={vi.fn()}
          restaurantId="res-1"
          warehouses={warehouses}
          selectedWarehouseId="wh-1"
          onSelectWarehouse={vi.fn()}
        />
      </AuthContext.Provider>,
    );

    expect(screen.queryByRole("button", { name: "Thêm kho" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sửa kho/i })).not.toBeInTheDocument();
    expect(screen.getByText(/đang xem danh sách kho/i)).toBeInTheDocument();
  });
});
