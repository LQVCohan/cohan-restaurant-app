import { afterEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import { Reservation, Table } from "../../models/index.js";
import { enrichCustomerReservations } from "../../graphql/resolvers/reservation/customerHistoryEnrichment.js";
import { withCustomerReservationPolicy } from "../../graphql/resolvers/reservation/customerReservationPolicy.js";

const USER_ID = "507f1f77bcf86cd799439011";
const RESTAURANT_ID = "507f1f77bcf86cd799439012";
const RESERVATION_ID = "507f1f77bcf86cd799439013";
const TABLE_ID = "507f1f77bcf86cd799439014";

const queryResult = (rows) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(rows),
  }),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("customer reservation rules for report pages 21-25", () => {
  it("blocks a second overlapping booking for the same customer and restaurant", async () => {
    vi.spyOn(Reservation, "find").mockReturnValue(queryResult([
      {
        _id: RESERVATION_ID,
        orderCode: "RSV-OLD",
        timeTo: "2026-08-01T12:00:00.000Z",
        durationMinutes: 120,
        isUnlimitedTime: false,
      },
    ]));
    const createReservation = vi.fn();
    const mutation = withCustomerReservationPolicy({ createReservation });

    await expect(mutation.createReservation(
      null,
      {
        input: {
          restaurantId: RESTAURANT_ID,
          timeTo: "2026-08-01T13:00:00.000Z",
          durationMinutes: 60,
        },
      },
      { user: { id: USER_ID, userType: "CUSTOMER" } },
      null,
    )).rejects.toMatchObject({
      extensions: { code: "USER_RESERVATION_TIME_CONFLICT" },
    });

    expect(createReservation).not.toHaveBeenCalled();
  });

  it("confirms a zero-deposit booking without leaving it in payment flow", async () => {
    vi.spyOn(Reservation, "find").mockReturnValue(queryResult([]));
    const save = vi.fn().mockResolvedValue(undefined);
    const created = {
      _id: RESERVATION_ID,
      depositAmount: 0,
      depositStatus: "pending",
      status: "pending_payment",
      pendingPaymentExpiresAt: new Date(),
      paymentReference: null,
      save,
    };
    const createReservation = vi.fn().mockResolvedValue(created);
    const mutation = withCustomerReservationPolicy({ createReservation });

    const result = await mutation.createReservation(
      null,
      {
        input: {
          restaurantId: RESTAURANT_ID,
          timeTo: "2026-08-02T12:00:00.000Z",
          durationMinutes: 60,
        },
      },
      { user: { id: USER_ID, userType: "CUSTOMER" } },
      null,
    );

    expect(result).toMatchObject({
      depositAmount: 0,
      depositStatus: "paid",
      status: "confirmed",
      pendingPaymentExpiresAt: null,
      paymentReference: "NO_DEPOSIT_REQUIRED",
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not apply the customer overlap guard to manager-created reservations", async () => {
    const find = vi.spyOn(Reservation, "find");
    const createReservation = vi.fn().mockResolvedValue({
      depositAmount: 100000,
      status: "confirmed",
    });
    const mutation = withCustomerReservationPolicy({ createReservation });

    await mutation.createReservation(
      null,
      { input: { restaurantId: RESTAURANT_ID, timeTo: "2026-08-02T12:00:00.000Z" } },
      { user: { id: USER_ID, userType: "MANAGER" } },
      null,
    );

    expect(find).not.toHaveBeenCalled();
    expect(createReservation).toHaveBeenCalledTimes(1);
  });
});

describe("customer reservation history enrichment", () => {
  it("resolves the table label, flags overlapping bookings and produces a check-in QR", async () => {
    vi.spyOn(Table, "find").mockReturnValue(queryResult([
      { _id: TABLE_ID, code: "T201", name: "Bàn cửa sổ" },
    ]));
    vi.spyOn(QRCode, "toDataURL").mockResolvedValue("data:image/png;base64,qr");

    const rows = await enrichCustomerReservations([
      {
        _id: RESERVATION_ID,
        orderCode: "RSV-001",
        restaurantId: RESTAURANT_ID,
        tableId: TABLE_ID,
        timeTo: "2099-08-01T12:00:00.000Z",
        durationMinutes: 120,
        status: "confirmed",
      },
      {
        _id: "507f1f77bcf86cd799439015",
        orderCode: "RSV-002",
        restaurantId: RESTAURANT_ID,
        tableId: TABLE_ID,
        timeTo: "2099-08-01T13:00:00.000Z",
        durationMinutes: 60,
        status: "confirmed",
      },
    ]);

    expect(rows[0]).toMatchObject({
      tableCode: "T201",
      tableName: "Bàn cửa sổ",
      hasUserOverlap: true,
      overlapReservationCodes: ["RSV-002"],
      canCheckIn: true,
      checkInQrDataUrl: "data:image/png;base64,qr",
    });
    expect(JSON.parse(rows[0].checkInQrPayload)).toMatchObject({
      type: "COHAN_RESERVATION_CHECK_IN",
      reservationId: RESERVATION_ID,
      orderCode: "RSV-001",
      tableId: TABLE_ID,
    });
  });
});
