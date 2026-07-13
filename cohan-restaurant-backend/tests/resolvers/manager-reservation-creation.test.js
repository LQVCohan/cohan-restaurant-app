import { describe, expect, it, vi } from "vitest";
import {
  buildManagerReservationNote,
  isManagerReservationActor,
  withManagerReservationCreation,
} from "../../graphql/resolvers/reservation/managerCreationPolicy.js";

describe("manager reservation creation policy", () => {
  it("recognizes manager, admin and owner roles without treating customer/staff as manager", () => {
    expect(isManagerReservationActor({ userType: "MANAGER" })).toBe(true);
    expect(isManagerReservationActor({ roleName: "restaurant_admin" })).toBe(true);
    expect(isManagerReservationActor({ role: { slug: "brand_owner" } })).toBe(true);
    expect(isManagerReservationActor({ roleName: "Quản lý nhà hàng" })).toBe(true);
    expect(isManagerReservationActor({ userType: "CUSTOMER" })).toBe(false);
    expect(isManagerReservationActor({ userType: "STAFF", roleName: "waiter" })).toBe(false);
    expect(isManagerReservationActor(null)).toBe(false);
  });

  it("adds the manager name before an existing customer note", () => {
    expect(buildManagerReservationNote("Nguyễn Văn An", "Bàn gần cửa sổ"))
      .toBe("Quản lý Nguyễn Văn An đặt | Bàn gần cửa sổ");
    expect(buildManagerReservationNote("Nguyễn Văn An", ""))
      .toBe("Quản lý Nguyễn Văn An đặt");
  });

  it("does not duplicate the manager prefix", () => {
    expect(
      buildManagerReservationNote(
        "Nguyễn Văn An",
        "Quản lý Nguyễn Văn An đặt | Ghế trẻ em",
      ),
    ).toBe("Quản lý Nguyễn Văn An đặt | Ghế trẻ em");
  });

  it("keeps the normal customer resolver unchanged", async () => {
    const normalCreate = vi.fn().mockResolvedValue({ id: "normal" });
    const managerCreate = vi.fn().mockResolvedValue({ id: "manager" });
    const mutation = withManagerReservationCreation(
      { createReservation: normalCreate, anotherMutation: vi.fn() },
      managerCreate,
    );

    const result = await mutation.createReservation(
      null,
      { input: { restaurantId: "r1" } },
      { user: { userType: "CUSTOMER" } },
      null,
    );

    expect(result).toEqual({ id: "normal" });
    expect(normalCreate).toHaveBeenCalledTimes(1);
    expect(managerCreate).not.toHaveBeenCalled();
  });

  it("routes manager accounts to the manager-aware resolver", async () => {
    const normalCreate = vi.fn().mockResolvedValue({ id: "normal" });
    const managerCreate = vi.fn().mockResolvedValue({ id: "manager" });
    const mutation = withManagerReservationCreation(
      { createReservation: normalCreate },
      managerCreate,
    );
    const ctx = { user: { id: "manager-1", userType: "MANAGER" } };
    const args = { input: { restaurantId: "r1" } };

    const result = await mutation.createReservation(null, args, ctx, null);

    expect(result).toEqual({ id: "manager" });
    expect(managerCreate).toHaveBeenCalledWith(null, args, ctx, null);
    expect(normalCreate).not.toHaveBeenCalled();
  });
});
