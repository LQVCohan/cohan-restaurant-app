import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  useQuery: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
}));

describe("InventoryAuditTab", () => {
  it("requires a concrete warehouse before creating an end-period count", () => {
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

    expect(screen.getByText(/Vui lòng chọn một kho cụ thể/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo kỳ kiểm kê" })).toBeDisabled();
  });
});
