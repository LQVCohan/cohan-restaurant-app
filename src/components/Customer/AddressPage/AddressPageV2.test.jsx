import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddressPageV2 from "./AddressPageV2";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddressPageV2", () => {
  it("renders empty address state and opens dynamic address modal", async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: expect.anything() },
            result: { data: { myAddresses: [] } },
          },
        ]}
      >
        <AddressPageV2 />
      </MockedProvider>,
    );

    expect(await screen.findByText("Chưa có địa chỉ nào")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /thêm địa chỉ mới/i }));

    expect(screen.getByRole("heading", { name: /thêm địa chỉ mới/i })).toBeInTheDocument();
    expect(screen.getByText(/đang dùng dữ liệu địa chỉ dự phòng/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("-- Tỉnh/Thành --")).toBeInTheDocument();
  });

  it("lets customer choose province, district and ward from loaded data", async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: expect.anything() },
            result: { data: { myAddresses: [] } },
          },
        ]}
      >
        <AddressPageV2 />
      </MockedProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /thêm địa chỉ mới/i }));

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
