import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RestaurantPublicationControl from "./RestaurantPublicationControl";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const updatePublicationMock = vi.fn();
const refetchMock = vi.fn();
const successMock = vi.fn();
const errorMock = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
}));

vi.mock("antd", () => ({
  Button: ({ children, icon, ...props }) => (
    <button {...props}>
      {icon}
      {children}
    </button>
  ),
  Switch: ({ checked, onChange, loading, ...props }) => (
    <input
      {...props}
      role="switch"
      type="checkbox"
      checked={checked}
      disabled={props.disabled || loading}
      onChange={(event) => onChange?.(event.target.checked)}
    />
  ),
  message: {
    success: (...args) => successMock(...args),
    error: (...args) => errorMock(...args),
  },
}));

describe("RestaurantPublicationControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetchMock.mockResolvedValue({
      data: {
        restaurant: {
          id: "restaurant-1",
          name: "COHAN One",
          businessStatus: "active",
          publicationStatus: "published",
        },
      },
    });
    useQueryMock.mockReturnValue({
      data: {
        restaurant: {
          id: "restaurant-1",
          name: "COHAN One",
          businessStatus: "active",
          publicationStatus: "draft",
        },
      },
      loading: false,
      error: null,
      refetch: refetchMock,
    });
    updatePublicationMock.mockResolvedValue({
      data: {
        updateRestaurant: {
          id: "restaurant-1",
          name: "COHAN One",
          businessStatus: "active",
          publicationStatus: "published",
        },
      },
    });
    useMutationMock.mockReturnValue([
      updatePublicationMock,
      { loading: false },
    ]);
  });

  it("publishes the selected draft restaurant through the existing update mutation", async () => {
    render(<RestaurantPublicationControl restaurantId="restaurant-1" />);

    expect(screen.getByText("Bản nháp")).toBeInTheDocument();
    expect(
      screen.getByText("Xuất hiện ở trang chính và danh sách nhà hàng."),
    ).toBeInTheDocument();

    const publicationSwitch = screen.getByRole("switch", {
      name: "Hiển thị công khai",
    });
    expect(publicationSwitch).not.toBeChecked();

    fireEvent.click(publicationSwitch);

    await waitFor(() => {
      expect(updatePublicationMock).toHaveBeenCalledWith({
        variables: {
          id: "restaurant-1",
          publicationStatus: "published",
        },
      });
    });
    expect(refetchMock).toHaveBeenCalledTimes(1);
    expect(successMock).toHaveBeenCalledWith(
      "Nhà hàng đã được hiển thị trên trang khách.",
    );
    expect(errorMock).not.toHaveBeenCalled();
  });
});
