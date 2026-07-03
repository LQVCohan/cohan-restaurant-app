import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsManagement from "./SettingsManagement";
import { AuthContext } from "../../../context/AuthContext";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const updateSystemSetting = vi.fn();
const refetch = vi.fn();
const selection = {
  restaurantOptions: [{ id: "r1", name: "Nhà hàng 1" }],
  selectedRestaurantId: "r1",
  setSelectedRestaurantId: vi.fn(),
  restaurantsLoading: false,
  hasRestaurants: true,
};

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
}));

vi.mock("../../../hooks/useManagerRestaurantSelection", () => ({ default: () => selection }));
vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ title, subtitle, customControls }) => <header><h1>{title}</h1><p>{subtitle}</p>{customControls}</header>,
}));

const setting = {
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  dateFormat: "DD/MM/YYYY",
  operational: { businessDayStartHour: 6, defaultLanguage: "vi" },
  modules: { scheduling: true, rbac: true, printing: true, backup: false },
  metadata: { version: 3, note: "baseline" },
  updatedAt: "2026-06-02T00:00:00.000Z",
};

const renderPage = (user = { id: "u1", role: { permissions: [{ code: "system.manage" }] } }) => render(
  <AuthContext.Provider value={{ user }}>
    <SettingsManagement />
  </AuthContext.Provider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockReturnValue({ data: { systemSetting: setting }, loading: false, error: null, refetch });
  updateSystemSetting.mockResolvedValue({ data: { updateSystemSetting: { ...setting, timezone: "UTC", metadata: { version: 4, note: "updated" } } } });
  useMutationMock.mockImplementation((_mutation, options = {}) => [async (args) => {
    try {
      const result = await updateSystemSetting(args);
      options.onCompleted?.(result.data);
      return result;
    } catch (error) {
      options.onError?.(error);
      return {};
    }
  }, { loading: false, error: null }]);
});

describe("SettingsManagement", () => {
  it("renders setting from query with metadata", () => {
    renderPage();
    expect(screen.getByDisplayValue("Asia/Ho_Chi_Minh")).toBeInTheDocument();
    expect(screen.getByText(/Phiên bản 3/)).toBeInTheDocument();
    expect(screen.getByText(/v3/)).toBeInTheDocument();
  });

  it("uses backend-aligned defaults when the setting payload is unavailable", () => {
    useQueryMock.mockReturnValue({ data: {}, loading: false, error: null, refetch });
    renderPage();

    expect(screen.getByLabelText("Giờ bắt đầu ngày vận hành")).toHaveValue(5);
    expect(screen.getByLabelText("Sao lưu")).toBeChecked();
    expect(screen.getByText(/Phiên bản 1/)).toBeInTheDocument();
  });

  it("enables edit mode and saves updateSystemSetting variables", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Chỉnh sửa"));
    fireEvent.change(screen.getByLabelText("Múi giờ"), { target: { value: "UTC" } });
    fireEvent.change(screen.getByLabelText("Đơn vị tiền tệ"), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("Định dạng ngày"), { target: { value: "YYYY-MM-DD" } });
    fireEvent.change(screen.getByLabelText("Giờ bắt đầu ngày vận hành"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Ngôn ngữ mặc định"), { target: { value: "en" } });
    fireEvent.click(screen.getByLabelText("Sao lưu"));
    fireEvent.change(screen.getByLabelText("Ghi chú cấu hình"), { target: { value: "updated note" } });
    fireEvent.click(screen.getByText("Lưu cấu hình"));
    await waitFor(() => expect(updateSystemSetting).toHaveBeenCalled());
    expect(updateSystemSetting.mock.calls[0][0].variables.input).toEqual(expect.objectContaining({
      restaurantId: "r1",
      timezone: "UTC",
      currency: "USD",
      dateFormat: "YYYY-MM-DD",
      operational: { businessDayStartHour: 5, defaultLanguage: "en" },
      note: "updated note",
    }));
    expect(updateSystemSetting.mock.calls[0][0].variables.input.modules.backup).toBe(true);
    expect(refetch).toHaveBeenCalled();
    expect(await screen.findByText(/Đã lưu cấu hình/)).toBeInTheDocument();
  });

  it("validates businessDayStartHour", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Chỉnh sửa"));
    fireEvent.change(screen.getByLabelText("Giờ bắt đầu ngày vận hành"), { target: { value: "24" } });
    fireEvent.click(screen.getByText("Lưu cấu hình"));
    expect(await screen.findByText(/số nguyên từ 0 đến 23/)).toBeInTheDocument();
    expect(updateSystemSetting).not.toHaveBeenCalled();
  });

  it("shows error state when mutation fails", async () => {
    updateSystemSetting.mockRejectedValueOnce(new Error("FORBIDDEN"));
    renderPage();
    fireEvent.click(screen.getByText("Chỉnh sửa"));
    fireEvent.click(screen.getByText("Lưu cấu hình"));
    expect(await screen.findByText(/Không lưu được cấu hình: FORBIDDEN/)).toBeInTheDocument();
  });

  it("shows read-only state if user lacks system.manage", () => {
    renderPage({ id: "u2", role: { permissions: [{ code: "restaurant.read" }] } });
    expect(screen.getByText(/Chế độ chỉ xem/)).toBeInTheDocument();
    expect(screen.getByText("Chỉnh sửa")).toBeDisabled();
  });
});
