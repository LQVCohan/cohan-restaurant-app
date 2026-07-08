import React from "react";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../../context/AuthContext";
import BookingModal, {
  GET_PUBLIC_BOOKING_RESTAURANT,
  GET_PUBLIC_BOOKING_TABLES,
} from "./BookingModal";

const { createBookingMock, showNotificationMock } = vi.hoisted(() => ({
  createBookingMock: vi.fn(),
  showNotificationMock: vi.fn(),
}));

vi.mock("../../../context/CartProvider", () => ({
  useCart: () => ({ cart: [] }),
}));

vi.mock("../../../hooks/useBookingTable", () => ({
  useBookingTable: () => ({
    createBooking: createBookingMock,
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: showNotificationMock }),
}));

const restaurantId = "restaurant-1";
const tableId = "table-1";

const publicRestaurant = {
  id: restaurantId,
  name: "Cohan Riverside",
  openingHours: "11:00",
  closingHours: "22:00",
  address: {
    line1: "01 Võ Văn Ngân",
    line2: null,
    ward: "Linh Chiểu",
    district: "Thủ Đức",
    city: "TP. Hồ Chí Minh",
    country: "Việt Nam",
  },
  reservationSettings: {
    baseDepositAmount: 100000,
    menuDepositPercent: 50,
  },
};

const publicTable = {
  id: tableId,
  code: "TB02",
  capacity: 2,
  status: "available",
  floorId: "floor-3",
  floorLevel: 3,
  deposit: 100000,
  type: "standard",
  vrUrl: null,
  bookingPerks: ["Miễn phí nước suối"],
  reservationHoldMinutes: 15,
  minSpend: 0,
  cancelPolicy: "Liên hệ nhà hàng trước khi thay đổi lịch.",
};

const apolloMocks = [
  {
    request: {
      query: GET_PUBLIC_BOOKING_RESTAURANT,
      variables: { id: restaurantId },
    },
    result: { data: { publicRestaurant } },
  },
  {
    request: {
      query: GET_PUBLIC_BOOKING_TABLES,
      variables: { restaurantId, limit: 200 },
    },
    result: { data: { publicTables: [publicTable] } },
  },
];

function renderModal({ user, onBookingConfirmed = vi.fn() } = {}) {
  const resolvedUser = user || {
    id: "customer-1",
    fullName: "Lê Hoàng Vương",
    email: "hoangvuong@cohan.local",
    phone: "0901234567",
    loyaltyRank: "basic",
  };

  render(
    <MockedProvider mocks={apolloMocks} addTypename={false}>
      <MemoryRouter>
        <AuthContext.Provider value={{ user: resolvedUser }}>
          <BookingModal
            isOpen
            onClose={vi.fn()}
            restaurantId={restaurantId}
            tableId={tableId}
            tableCode="TB02"
            tableCapacity={2}
            tableFloor={3}
            onBookingConfirmed={onBookingConfirmed}
          />
        </AuthContext.Provider>
      </MemoryRouter>
    </MockedProvider>,
  );

  return { onBookingConfirmed };
}

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toLocaleDateString("en-CA");
}

describe("BookingModal", () => {
  beforeEach(() => {
    createBookingMock.mockReset();
    showNotificationMock.mockReset();
    createBookingMock.mockResolvedValue({
      id: "reservation-1",
      tableId,
      restaurantId,
      depositAmount: 100000,
      status: "pending_payment",
    });
  });

  it("renders the public restaurant and the selected public table", async () => {
    renderModal();

    expect(await screen.findByText("Cohan Riverside")).toBeInTheDocument();
    expect(screen.getByText(/01 Võ Văn Ngân/)).toBeInTheDocument();
    expect(screen.getByText("TB02")).toBeInTheDocument();
    expect(screen.getByText("Tầng 3")).toBeInTheDocument();
    expect(screen.getByText("Miễn phí nước suối")).toBeInTheDocument();
  });

  it("does not allow the party size to exceed table capacity", async () => {
    renderModal();
    await screen.findByText("Cohan Riverside");

    const increaseButton = screen.getByRole("button", { name: "Tăng số khách" });
    expect(increaseButton).toBeDisabled();
    expect(screen.getByText("Tối đa 2 khách")).toBeInTheDocument();
  });

  it("submits unlimited time as a boolean for an eligible customer", async () => {
    const onBookingConfirmed = vi.fn();
    renderModal({
      user: {
        id: "customer-1",
        fullName: "Lê Hoàng Vương",
        email: "hoangvuong@cohan.local",
        phone: "0901234567",
        loyaltyRank: "silver",
      },
      onBookingConfirmed,
    });
    await screen.findByText("Cohan Riverside");

    fireEvent.change(screen.getByLabelText("Ngày"), {
      target: { value: tomorrowDate() },
    });
    fireEvent.change(screen.getByLabelText("Giờ đến"), {
      target: { value: "11:00" },
    });

    const unlimitedCheckbox = screen.getByRole("checkbox", {
      name: /Không giới hạn giờ kết thúc/i,
    });
    fireEvent.click(unlimitedCheckbox);
    expect(unlimitedCheckbox).toBeChecked();
    expect(screen.getByLabelText("Giờ kết thúc")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Kiểm tra thông tin/i }));
    expect(await screen.findByText("Kiểm tra lần cuối")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt bàn" }));

    await waitFor(() => expect(createBookingMock).toHaveBeenCalledTimes(1));
    expect(createBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId,
        tableId,
        partySize: 2,
        durationMinutes: 0,
        isUnlimitedTime: true,
      }),
    );
    expect(onBookingConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ id: "reservation-1" }),
    );
  });
});
