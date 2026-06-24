import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (strings, ...values) =>
    strings.reduce((acc, string, index) => `${acc}${string}${values[index] || ""}`, ""),
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
}));

vi.mock("../../../data/vietnamLocationData", async () => {
  const actual = await vi.importActual("../../../data/vietnamLocationData");
  return {
    ...actual,
    loadVietnamLocationData: vi.fn(async () => ({
      source: "fallback",
      data: actual.getFallbackLocationData(),
    })),
  };
});

import AddressPageV2 from "./AddressPageV2";

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockReturnValue({
    data: { myAddresses: [] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  useMutationMock.mockReturnValue([vi.fn(), { loading: false }]);
});

describe("AddressPageV2", () => {
  it("renders empty address state and opens dynamic address modal", async () => {
    render(<AddressPageV2 />);

    expect(screen.getByText("Chưa có địa chỉ nào")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /thêm địa chỉ mới/i }));

    expect(screen.getByRole("heading", { name: /thêm địa chỉ mới/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/đang dùng dữ liệu địa chỉ dự phòng/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("-- Tỉnh/Thành --")).toBeInTheDocument();
  });

  it("lets customer choose province, district and ward from loaded data", async () => {
    render(<AddressPageV2 />);

    fireEvent.click(screen.getByRole("button", { name: /thêm địa chỉ mới/i }));

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "79" } });
    fireEvent.change(selects[1], { target: { value: "769" } });
    fireEvent.change(selects[2], { target: { value: "Phường Thảo Điền" } });

    await waitFor(() => {
      expect(selects[0]).toHaveValue("79");
      expect(selects[1]).toHaveValue("769");
      expect(selects[2]).toHaveValue("Phường Thảo Điền");
    });
  });
});
