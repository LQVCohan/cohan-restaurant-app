import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SupplyList from "./SupplyList";

const refresh = vi.fn(async () => undefined);
const restoreSupply = vi.fn(async () => ({ data: {} }));
const refetchTrash = vi.fn(async () => ({ data: { supplyTrash: [] } }));
const showNotification = vi.fn();
const supplyRows = [];

vi.mock("../../../../../utils/debounce", () => ({
  debounce: (fn) => fn,
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: { supplyTrash: [] },
      loading: false,
      error: null,
      refetch: refetchTrash,
    })),
    useMutation: vi.fn(() => [restoreSupply, {}]),
  };
});

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification }),
}));

vi.mock("../../../../../hooks/useSupply", () => ({
  default: () => ({
    supplies: supplyRows,
    supplyCategories: ["drink", "tissue", "other"],
    getStockItem: vi.fn(() => null),
    loading: false,
    error: null,
    handleCreate: vi.fn(async () => undefined),
    handleUpdate: vi.fn(async () => undefined),
    handleDelete: vi.fn(async () => undefined),
    handleInbound: vi.fn(async () => undefined),
    handleOutbound: vi.fn(async () => undefined),
    handleTransfer: vi.fn(async () => undefined),
    refresh,
  }),
}));

vi.mock("./SupplyCard", () => ({
  default: ({ supply, onDelete, onTransferClick }) => (
    <article>
      <h3>{supply.name}</h3>
      <button type="button" onClick={onDelete}>Xóa vật tư</button>
      {onTransferClick && <button type="button" onClick={() => onTransferClick(supply)}>Chuyển kho</button>}
    </article>
  ),
}));

vi.mock("./SupplyModal", () => ({
  default: ({ isOpen, onClose }) => (isOpen ? <div role="dialog" aria-label="Modal vật tư"><button onClick={onClose}>Đóng</button></div> : null),
}));

vi.mock("../modals/StockOutModal", () => ({ default: () => null }));
vi.mock("../modals/StockTransferModal", () => ({ default: () => null }));
vi.mock("../ingredients/QuickStockModal", () => ({ default: () => null }));

vi.mock("./supplyImportExport", () => ({
  buildSupplyReportFiles: vi.fn(() => []),
  downloadSupplyImportErrors: vi.fn(),
  downloadSupplyReportsZip: vi.fn(),
  downloadSupplyTemplate: vi.fn(),
  exportSuppliesFile: vi.fn(),
  parseSupplyImportFile: vi.fn(async () => []),
  validateAndNormalizeSupplyRow: vi.fn((row) => ({ normalized: row, errors: [] })),
}));

vi.mock("@/utils/inventorySupplySupplierPrintErrorMessages", () => ({
  getSupplyActionErrorMessage: vi.fn((_, fallback) => fallback),
}));

describe("SupplyList inventory regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supplyRows.splice(0);
  });

  it("shows the active supply toolbar and switches to an empty trash state", () => {
    render(<SupplyList restaurantId="res-1" warehouseId="wh-1" warehouses={[{ id: "wh-1", name: "Kho Việt" }]} />);

    expect(screen.getByPlaceholderText("Tìm kiếm vật tư...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Thêm vật tư$/i })).toBeEnabled();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("vật tư")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Thùng rác/i }));

    expect(screen.getByPlaceholderText("Tìm trong thùng rác...")).toBeInTheDocument();
    expect(screen.getByText("Thùng rác vật tư đang trống")).toBeInTheDocument();
    expect(screen.getByText("Vật tư đã chuyển vào đây sẽ được giữ trong 30 ngày.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Danh sách$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Thêm vật tư$/i })).toBeDisabled();
  });

  it("refreshes active and trash lists from the toolbar", () => {
    render(<SupplyList restaurantId="res-1" warehouseId="wh-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Tải lại danh sách vật tư" }));

    expect(refresh).toHaveBeenCalled();
    expect(refetchTrash).toHaveBeenCalled();
  });

  it("only exposes transfer when the restaurant has at least two active warehouses", () => {
    supplyRows.push({ id: "supply-1", name: "Khăn giấy", unit: "pack" });

    const { unmount } = render(
      <SupplyList
        restaurantId="res-1"
        warehouseId="wh-1"
        warehouses={[{ id: "wh-1", name: "Kho chính", isActive: true }]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Chuyển kho" })).not.toBeInTheDocument();

    unmount();
    render(
      <SupplyList
        restaurantId="res-1"
        warehouseId="wh-1"
        warehouses={[
          { id: "wh-1", name: "Kho chính", isActive: true },
          { id: "wh-2", name: "Kho phụ", isActive: true },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Chuyển kho" })).toBeInTheDocument();
  });
});
