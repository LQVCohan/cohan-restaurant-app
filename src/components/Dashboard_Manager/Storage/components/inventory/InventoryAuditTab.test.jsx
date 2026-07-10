import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useQuery } from "@apollo/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InventoryAuditTab from "./InventoryAuditTab";

vi.mock("lucide-react", () => {
  const Icon = (props) => <span aria-hidden="true" {...props} />;
  return {
    AlertCircle: Icon,
    ArrowDownUp: Icon,
    Boxes: Icon,
    CheckCircle2: Icon,
    ClipboardCheck: Icon,
    FileCheck2: Icon,
    History: Icon,
    Search: Icon,
  };
});

vi.mock("@apollo/client", () => ({
  gql: (strings) => (Array.isArray(strings) ? strings.join("") : String(strings || "")),
  useQuery: vi.fn(),
  useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
}));

const emptyQueryResult = () => ({
  data: null,
  loading: false,
  error: null,
  refetch: vi.fn(),
});

describe("InventoryAuditTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockImplementation(emptyQueryResult);
  });

  it("requires the restaurant default warehouse before creating an end-period count", () => {
    render(
      <InventoryAuditTab
        restaurantId="restaurant-1"
        warehouseId={null}
        ingredients={[]}
        stockItems={[]}
        movements={[]}
        warehouses={[]}
      />,
    );

    expect(screen.getByText(/Kho mặc định chưa sẵn sàng/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo kỳ kiểm kê" })).toBeDisabled();
  });

  it("keeps every count line reachable and scopes documents to the active period", () => {
    const periodStart = "2026-07-01T00:00:00.000Z";
    const periodEnd = "2026-07-31T23:59:59.999Z";
    const lines = Array.from({ length: 81 }, (_, index) => ({
      ingredientId: `ingredient-${index + 1}`,
      nameSnapshot: `Nguyên liệu ${index + 1}`,
      skuSnapshot: `SKU-${index + 1}`,
      unit: "kg",
      systemQty: index + 1,
      countedQty: null,
      variance: 0,
      note: "",
    }));

    useQuery.mockImplementation((document) => {
      const source = String(document);
      if (source.includes("query InventoryCounts")) {
        return {
          data: {
            inventoryCounts: [{
              id: "count-1",
              code: "IC-001",
              title: "Kiểm kê tháng 7",
              status: "draft",
              periodStart,
              periodEnd,
              lines,
            }],
          },
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return {
        data: { inventoryDocumentMovements: [] },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    render(
      <InventoryAuditTab
        restaurantId="restaurant-1"
        warehouseId="warehouse-1"
        ingredients={[]}
        stockItems={[]}
        movements={[]}
        warehouses={[]}
      />,
    );

    const documentCall = useQuery.mock.calls.find(([document]) =>
      String(document).includes("query InventoryDocumentMovements"),
    );
    expect(documentCall?.[1]?.variables).toMatchObject({
      dateFrom: periodStart,
      dateTo: periodEnd,
    });

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục kiểm đếm" }));
    expect(screen.getByText("Nguyên liệu 1")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Sau" })[0]);
    expect(screen.getByText("Nguyên liệu 41")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Sau" })[0]);
    expect(screen.getByText("Nguyên liệu 81")).toBeInTheDocument();
  });
});
