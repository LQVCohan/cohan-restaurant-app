import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  promotions: vi.fn(),
  notify: vi.fn(),
  clearDraft: vi.fn(),
}));

vi.mock("@/hooks/usePromotions", () => ({
  usePromotions: (...args) => mocks.promotions(...args),
}));
vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));
vi.mock("@/hooks/useModalDraft", () => ({
  default: () => ({
    requestCloseWithDraft: (close) => close(),
    clearDraft: mocks.clearDraft,
    didRestore: false,
  }),
}));
vi.mock("@/hooks/useModalClosePipeline", () => ({
  default: ({ onClose }) => ({
    requestClose: onClose,
    onBackdropMouseDown: vi.fn(),
  }),
}));
vi.mock("@/utils/vrStorage", () => ({
  loadTableVrImage: () => "",
  removeTableVrImage: vi.fn(),
  storeTableVrImage: vi.fn(),
}));
vi.mock("@/lib/authStorage", () => ({ getToken: () => "access-token" }));
vi.mock("@/lib/apiBaseUrl", () => ({
  toApiUrl: (path) => `http://api.test/api${path}`,
}));
vi.mock("@/components/Dashboard_Manager/Table/TableCameraPlacementPreviewModal", () => ({
  default: () => null,
}));

import TableActionsLiteModal from "./TableActionsLiteModal";

const restaurantId = "507f1f77bcf86cd799439011";
const table = {
  id: "table-a1",
  code: "A1",
  capacity: 4,
  type: "standard",
  status: "available",
  floorId: "floor-1",
  floorLevel: 1,
  position: { x: 80, y: 80 },
  promotionIds: [],
  bookingPerks: [],
};

const renderModal = ({ tableOverrides = {}, actionOverrides = {}, onUpdated = vi.fn() } = {}) => {
  const currentTable = { ...table, ...tableOverrides };

  return render(
    <TableActionsLiteModal
      open
      table={currentTable}
      restaurantId={restaurantId}
      floors={[{ id: "floor-1", level: 1, name: "Tầng 1" }]}
      tables={[
        currentTable,
        {
          id: "table-a2",
          code: "A2",
          capacity: 4,
          status: "available",
          floorId: "floor-1",
          position: { x: 120, y: 80 },
        },
        {
          id: "table-a3",
          code: "A3",
          capacity: 4,
          status: "occupied",
          floorId: "floor-1",
        },
        {
          id: "table-b1",
          code: "B1",
          capacity: 4,
          status: "available",
          floorId: "floor-2",
        },
      ]}
      actions={{
        updateTable: vi.fn(),
        setTableStatus: vi.fn(),
        moveTable: vi.fn(),
        swapTableCodes: vi.fn(),
        mergeTables: vi.fn(),
        splitTables: vi.fn(),
        deleteTable: vi.fn(),
        fetchTableByCode: vi.fn(),
        getIdFromLevel: vi.fn(),
        ...actionOverrides,
      }}
      onUpdated={onUpdated}
      onClose={vi.fn()}
    />,
  );
};

describe("TableActionsLiteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.promotions.mockReturnValue({
      allPromotions: [
        { id: "promo-1", name: "Giảm 10%", code: "GIAM10", level: 1, usageCount: 2 },
      ],
      loading: false,
      error: null,
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion: "Nên ghép với bàn A2." }),
    });
  });

  it("hides internal coordinates and requests scoped, authenticated suggestions", async () => {
    renderModal();

    expect(mocks.promotions).toHaveBeenCalledWith({
      restaurantId,
      activeOnly: true,
      showErrorBanner: false,
    });
    expect(screen.queryByLabelText("Vị trí X")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Vị trí Y")).not.toBeInTheDocument();
    expect(screen.queryByText(/swap code/i)).not.toBeInTheDocument();
    expect(screen.getByText("Khuyến mãi đang hiệu lực")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gợi ý bàn nên ghép" }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("http://api.test/api/ai/table/merge-suggestion");
    expect(options.credentials).toBe("include");
    expect(options.headers.Authorization).toBe("Bearer access-token");

    const payload = JSON.parse(options.body);
    expect(payload.restaurantId).toBe(restaurantId);
    expect(payload.promotions).toEqual([
      expect.objectContaining({ id: "promo-1", code: "GIAM10" }),
    ]);
    expect(payload.tables.map((item) => item.code)).toEqual(["A2"]);
    expect(await screen.findByText("Nên ghép với bàn A2.")).toBeInTheDocument();
  });

  it("saves table type and every persisted detail field on the table document", async () => {
    const updateTable = vi.fn().mockResolvedValue({});
    const onUpdated = vi.fn().mockResolvedValue();

    renderModal({
      tableOverrides: {
        tags: ["VIP", "Yên tĩnh"],
        vrUrl: "https://example.com/table-a1",
        deposit: 200000,
        promotionIds: ["promo-1"],
        bookingPerks: ["Tặng nước"],
        zone: "Sảnh VIP",
        reservationHoldMinutes: 15,
        minSpend: 500000,
        cancelPolicy: "Hủy trước 2 giờ để được hoàn cọc.",
      },
      actionOverrides: { updateTable },
      onUpdated,
    });

    const typeSelect = screen.getByText("Loại bàn").parentElement.querySelector("select");
    fireEvent.change(typeSelect, { target: { value: "vip" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() =>
      expect(updateTable).toHaveBeenCalledWith({
        id: "table-a1",
        code: "A1",
        capacity: 4,
        type: "vip",
        tags: ["VIP", "Yên tĩnh"],
        vrUrl: "https://example.com/table-a1",
        deposit: 200000,
        promotionIds: ["promo-1"],
        bookingPerks: ["Tặng nước"],
        zone: "Sảnh VIP",
        reservationHoldMinutes: 15,
        minSpend: 500000,
        cancelPolicy: "Hủy trước 2 giờ để được hoàn cọc.",
      }),
    );
    expect(onUpdated).toHaveBeenCalled();
    expect(mocks.clearDraft).toHaveBeenCalled();
  });
});
