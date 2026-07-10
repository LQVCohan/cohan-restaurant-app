import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTable: vi.fn(),
  updateTable: vi.fn(),
  moveTable: vi.fn(),
  deleteTable: vi.fn(),
  refetchTables: vi.fn(),
  createFloor: vi.fn(),
  refetchFloors: vi.fn(),
  updateFloor: vi.fn(),
  deleteFloor: vi.fn(),
  notify: vi.fn(),
  close: vi.fn(),
  tableRestaurantId: null,
  floorRestaurantId: null,
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: (document) => {
      const operationName = document?.definitions?.find(
        (definition) => definition?.kind === "OperationDefinition",
      )?.name?.value;
      return [
        operationName === "UpdateFloorFromTableSettings"
          ? mocks.updateFloor
          : mocks.deleteFloor,
      ];
    },
  };
});

vi.mock("@/hooks/useTableManagement", () => ({
  default: ({ restaurantId }) => {
    mocks.tableRestaurantId = restaurantId;
    return {
      tables: [
        {
          id: "table-a1",
          code: "A1",
          type: "standard",
          capacity: 4,
          floorId: "floor-1",
          floorLevel: 1,
          status: "available",
          position: { x: 50, y: 50 },
        },
        {
          id: "table-vip-2",
          code: "VIP-02",
          type: "vip",
          capacity: 6,
          floorId: "floor-1",
          floorLevel: 1,
          status: "occupied",
          position: { x: 140, y: 50 },
        },
      ],
      tablesLoading: false,
      tablesError: null,
      createTable: mocks.createTable,
      updateTable: mocks.updateTable,
      moveTable: mocks.moveTable,
      deleteTable: mocks.deleteTable,
      refetchTables: mocks.refetchTables,
    };
  },
}));

vi.mock("@/hooks/useFloorManagement", () => ({
  default: ({ restaurantId }) => {
    mocks.floorRestaurantId = restaurantId;
    return {
      floors: [
        { id: "floor-1", name: "Tầng 1", level: 1 },
        { id: "floor-2", name: "Sân thượng", level: 2 },
      ],
      floorsLoading: false,
      floorsError: null,
      createFloor: mocks.createFloor,
      refetchFloors: mocks.refetchFloors,
    };
  },
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

vi.mock("../../../components/common/Modal", () => {
  const Modal = ({ children, isOpen }) =>
    isOpen ? <div role="dialog">{children}</div> : null;
  Modal.Header = ({ children, onClose }) => (
    <header>
      {children}
      {onClose && (
        <button type="button" aria-label="Đóng modal" onClick={onClose}>
          ×
        </button>
      )}
    </header>
  );
  Modal.Body = ({ children }) => <div>{children}</div>;
  Modal.Footer = ({ children }) => <footer>{children}</footer>;
  return { default: Modal };
});

vi.mock("../../../components/common/Button", () => ({
  default: ({ children, loading: _loading, ...props }) => (
    <button {...props}>{children}</button>
  ),
}));

import TableTypeManagementPage from "./TableTypeManagementPage";

const renderModal = (props = {}) =>
  render(
    <TableTypeManagementPage
      isOpen
      onClose={mocks.close}
      restaurantId="restaurant-1"
      restaurantName="Cơ sở trung tâm"
      {...props}
    />,
  );

describe("TableTypeManagementPage modal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.tableRestaurantId = null;
    mocks.floorRestaurantId = null;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.createTable.mockResolvedValue({ id: "table-new" });
    mocks.updateTable.mockResolvedValue({ id: "table-a1" });
    mocks.moveTable.mockResolvedValue({ id: "table-a1" });
    mocks.deleteTable.mockResolvedValue(true);
    mocks.refetchTables.mockResolvedValue({ data: {} });
    mocks.createFloor.mockResolvedValue({ id: "floor-new", name: "Tầng mới" });
    mocks.refetchFloors.mockResolvedValue({ data: {} });
    mocks.updateFloor.mockResolvedValue({ data: { updateFloor: { id: "floor-2" } } });
    mocks.deleteFloor.mockResolvedValue({ data: { deleteFloor: true } });
  });

  it("stays closed and skips scoped queries until explicitly opened", () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.tableRestaurantId).toBeNull();
    expect(mocks.floorRestaurantId).toBeNull();
  });

  it("opens as a controlled modal for the selected restaurant", () => {
    const { container } = renderModal();

    expect(
      screen.getByRole("heading", { name: "Loại bàn & không gian" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cơ sở trung tâm/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Loại bàn/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(container.querySelectorAll(".ttm-type-card")).toHaveLength(7);
    expect(mocks.tableRestaurantId).toBe("restaurant-1");
    expect(mocks.floorRestaurantId).toBe("restaurant-1");

    fireEvent.click(screen.getByRole("button", { name: "Đóng modal" }));
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("changes a table type and supports adding, editing and deleting a table", async () => {
    renderModal();

    fireEvent.change(screen.getByRole("combobox", { name: "Loại bàn A1" }), {
      target: { value: "vip" },
    });
    await waitFor(() => {
      expect(mocks.updateTable).toHaveBeenCalledWith({ id: "table-a1", type: "vip" });
      expect(mocks.refetchTables).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Thêm bàn" }));
    fireEvent.change(screen.getByLabelText("Mã bàn mới"), {
      target: { value: "A2" },
    });
    fireEvent.change(screen.getByLabelText("Sức chứa bàn mới"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Tầng của bàn mới"), {
      target: { value: "floor-2" },
    });
    fireEvent.change(screen.getByLabelText("Loại của bàn mới"), {
      target: { value: "outdoor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo bàn" }));

    await waitFor(() => {
      expect(mocks.createTable).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "restaurant-1",
          floorId: "floor-2",
          code: "A2",
          capacity: 5,
          type: "outdoor",
          status: "available",
          position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Sửa bàn A1" }));
    fireEvent.change(screen.getByLabelText("Mã bàn A1"), {
      target: { value: "A-01" },
    });
    fireEvent.change(screen.getByLabelText("Không gian bàn A1"), {
      target: { value: "floor-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => {
      expect(mocks.updateTable).toHaveBeenCalledWith({
        id: "table-a1",
        code: "A-01",
        capacity: 4,
        type: "standard",
      });
      expect(mocks.moveTable).toHaveBeenCalledWith(
        expect.objectContaining({ id: "table-a1", floorId: "floor-2" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Xóa bàn A1" }));
    await waitFor(() => {
      expect(mocks.deleteTable).toHaveBeenCalledWith("table-a1");
    });
  });

  it("adds, renames and deletes an empty service space", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("tab", { name: /Không gian/i }));
    fireEvent.change(screen.getByLabelText("Tên không gian mới"), {
      target: { value: "Sân vườn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm không gian" }));

    await waitFor(() => {
      expect(mocks.createFloor).toHaveBeenCalledWith({ name: "Sân vườn" });
      expect(mocks.refetchFloors).toHaveBeenCalled();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Sửa không gian Sân thượng" }),
    );
    fireEvent.change(screen.getByLabelText("Tên không gian Sân thượng"), {
      target: { value: "Rooftop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => {
      expect(mocks.updateFloor).toHaveBeenCalledWith({
        variables: { input: { id: "floor-2", name: "Rooftop" } },
      });
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Xóa không gian Sân thượng" }),
    );
    await waitFor(() => {
      expect(mocks.deleteFloor).toHaveBeenCalledWith({
        variables: { id: "floor-2" },
      });
    });
  });
});
