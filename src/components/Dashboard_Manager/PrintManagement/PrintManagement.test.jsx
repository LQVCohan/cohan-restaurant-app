import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import PrintManagement, {
  printerStatusLabel,
  printTypeLabel,
} from "./PrintManagement";

const apolloMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  mutations: [],
}));
const scopeMocks = vi.hoisted(() => ({ useScope: vi.fn(), setRestaurant: vi.fn() }));
const permissionMocks = vi.hoisted(() => ({ hasPermission: vi.fn() }));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQuery: apolloMocks.useQuery,
    useMutation: apolloMocks.useMutation,
  };
});
vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: scopeMocks.useScope,
}));
vi.mock("@/utils/frontendPermissionAccess", () => ({
  hasPermission: permissionMocks.hasPermission,
}));
vi.mock("@/components/Dashboard_Manager/POS/components/modals/PrinterSettingsModal", () => ({
  PrinterSettingsModal: ({ isOpen }) => isOpen ? <div>Modal máy in</div> : null,
}));
vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ selectedRestaurant, onRestaurantChange, primaryAction }) => (
    <header>
      <span>Chi nhánh đang chọn: {selectedRestaurant}</span>
      <button type="button" onClick={() => onRestaurantChange("restaurant-3")}>Đổi chi nhánh</button>
      <button
        type="button"
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
      >
        {primaryAction.label}
      </button>
    </header>
  ),
}));

const settingsData = {
  printSettings: {
    id: "print-setting-1",
    restaurantId: "restaurant-2",
    printers: [
      {
        id: "printer-1",
        name: "Máy bếp",
        ip: "192.168.1.20",
        type: "thermal",
        location: "kitchen",
        status: "configured",
      },
    ],
    stations: { kitchen: ["printer-1"] },
    templates: [
      { key: "kitchen", name: "Phiếu bếp", enabled: true, content: "{{orderCode}}" },
      { key: "bar", name: "Phiếu bar", enabled: true, content: "{{orderCode}}" },
      { key: "receipt", name: "Hóa đơn", enabled: true, content: "{{orderCode}}" },
    ],
    jobs: [
      {
        id: "job-failed",
        printerId: "printer-1",
        printerName: "Máy bếp",
        stationId: "kitchen",
        printType: "order_confirmed",
        templateKey: "kitchen",
        status: "failed",
        error: "Printer offline",
        retryCount: 0,
        payload: null,
        createdAt: "2026-07-11T05:00:00.000Z",
        updatedAt: "2026-07-11T05:00:00.000Z",
      },
    ],
    updatedAt: "2026-07-11T05:00:00.000Z",
  },
};

const renderPage = () => render(
  <AuthContext.Provider value={{ user: { id: "viewer-1" } }}>
    <PrintManagement />
  </AuthContext.Provider>,
);

describe("PrintManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apolloMocks.mutations = [];
    apolloMocks.useMutation.mockImplementation(() => {
      const mutation = vi.fn();
      apolloMocks.mutations.push(mutation);
      return [mutation, { loading: false }];
    });
    apolloMocks.useQuery.mockReturnValue({
      data: settingsData,
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(settingsData),
    });
    scopeMocks.useScope.mockReturnValue({
      selectedRestaurantId: "restaurant-2",
      setSelectedRestaurantId: scopeMocks.setRestaurant,
      restaurantOptions: [
        { id: "restaurant-1", name: "Chi nhánh cũ" },
        { id: "restaurant-2", name: "Chi nhánh trung tâm" },
      ],
    });
    permissionMocks.hasPermission.mockReturnValue(false);
  });

  it("queries the canonical manager restaurant and keeps read-only actions disabled", async () => {
    renderPage();

    expect(screen.getByText("Chi nhánh đang chọn: restaurant-2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm máy in" })).toBeDisabled();
    expect(screen.getByText(/Bạn đang ở chế độ chỉ xem/)).toBeInTheDocument();

    await waitFor(() => {
      expect(apolloMocks.useQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: { restaurantId: "restaurant-2" },
          skip: false,
        }),
      );
      expect(screen.getByText("Đã kiểm tra cấu hình")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Kiểm tra cấu hình Máy bếp" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gửi lại lệnh lỗi" })).toBeDisabled();
    expect(apolloMocks.mutations.every((mutation) => mutation.mock.calls.length === 0)).toBe(true);
  });

  it("updates the same canonical restaurant scope from the page header", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Đổi chi nhánh" }));
    expect(scopeMocks.setRestaurant).toHaveBeenCalledWith("restaurant-3");
  });
});

describe("print management labels", () => {
  it("does not describe a simulated configuration check as a live connection", () => {
    expect(printerStatusLabel("configured")).toBe("Đã kiểm tra cấu hình");
    expect(printerStatusLabel("online")).toBe("Đã kết nối");
    expect(printerStatusLabel("offline")).toBe("Chưa sẵn sàng");
    expect(printTypeLabel("order_confirmed")).toBe("Phiếu chế biến");
  });
});
