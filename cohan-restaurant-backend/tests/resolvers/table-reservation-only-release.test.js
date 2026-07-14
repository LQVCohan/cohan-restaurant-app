import { beforeEach, describe, expect, it, vi } from "vitest";

const reservationFindMock = vi.fn();
const reservationUpdateManyMock = vi.fn();
const releaseReservationSlotMock = vi.fn();
const closeEmptyTableSessionMock = vi.fn();
const hasActiveOrdersForTableMock = vi.fn();

vi.mock("../../models/reservation.model.js", () => ({
  default: {
    find: reservationFindMock,
    updateMany: reservationUpdateManyMock,
  },
}));

vi.mock("../../models/table.model.js", () => ({
  default: { findById: vi.fn() },
}));

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../src/services/reservationAvailability.service.js", () => ({
  releaseReservationSlot: releaseReservationSlotMock,
}));

vi.mock("../../src/services/reservationTableTiming.service.js", () => ({
  getTableReservationSnapshot: vi.fn(),
}));

vi.mock("../../utils/tableStateGuards.js", () => ({
  closeEmptyTableSessionForTable: closeEmptyTableSessionMock,
  hasActiveOrdersForTable: hasActiveOrdersForTableMock,
}));

const reservationRows = (rows) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(rows),
});

describe("reservation-only table release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeEmptyTableSessionMock.mockResolvedValue(true);
    hasActiveOrdersForTableMock.mockResolvedValue(false);
    reservationUpdateManyMock.mockResolvedValue({ modifiedCount: 1 });
    releaseReservationSlotMock.mockResolvedValue({ modifiedCount: 1 });
  });

  it("completes a seated reservation after closing its empty internal session", async () => {
    reservationFindMock.mockReturnValue(
      reservationRows([{ _id: "reservation-1" }]),
    );

    const { completeReservationOnlyTable } = await import(
      "../../graphql/resolvers/table/reservationStatusGuard.js"
    );
    const completed = await completeReservationOnlyTable({
      _id: "table-1",
      restaurantId: "restaurant-1",
      code: "A1",
    });

    expect(completed).toBe(true);
    expect(closeEmptyTableSessionMock).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      tableId: "table-1",
      tableCode: "A1",
    });
    expect(reservationUpdateManyMock).toHaveBeenCalledWith(
      {
        _id: { $in: ["reservation-1"] },
        status: "seated",
      },
      { $set: { status: "completed" } },
    );
    expect(releaseReservationSlotMock).toHaveBeenCalledWith({
      reservationId: "reservation-1",
    });
  });

  it("keeps the reservation active when a real order still exists", async () => {
    hasActiveOrdersForTableMock.mockResolvedValue(true);

    const { completeReservationOnlyTable } = await import(
      "../../graphql/resolvers/table/reservationStatusGuard.js"
    );
    const completed = await completeReservationOnlyTable({
      _id: "table-1",
      restaurantId: "restaurant-1",
      code: "A1",
    });

    expect(completed).toBe(false);
    expect(reservationFindMock).not.toHaveBeenCalled();
    expect(reservationUpdateManyMock).not.toHaveBeenCalled();
  });
});
