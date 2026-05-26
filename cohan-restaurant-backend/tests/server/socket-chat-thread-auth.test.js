import { describe, it, expect, vi } from "vitest";
import { authorizeChatThreadJoin } from "../../src/server/createServer.js";

describe("authorizeChatThreadJoin", () => {
  it("allows owner to join thread", async () => {
    const res = await authorizeChatThreadJoin({
      socketUser: { id: "u1" },
      threadId: "t1",
      findThreadById: vi.fn(async () => ({ _id: "t1", userId: "u1", restaurantId: null })),
      requireRestaurantPermissionFn: vi.fn(),
      permissionCode: "order.read",
    });
    expect(res.ok).toBe(true);
  });

  it("allows manager with restaurant permission", async () => {
    const requirePermission = vi.fn(async () => true);
    const res = await authorizeChatThreadJoin({
      socketUser: { id: "manager1" },
      threadId: "t2",
      findThreadById: vi.fn(async () => ({ _id: "t2", userId: "u1", restaurantId: "r1" })),
      requireRestaurantPermissionFn: requirePermission,
      permissionCode: "order.read",
    });
    expect(res.ok).toBe(true);
    expect(requirePermission).toHaveBeenCalled();
  });

  it("rejects unrelated user without permission", async () => {
    const res = await authorizeChatThreadJoin({
      socketUser: { id: "u2" },
      threadId: "t3",
      findThreadById: vi.fn(async () => ({ _id: "t3", userId: "u1", restaurantId: "r1" })),
      requireRestaurantPermissionFn: vi.fn(async () => { throw new Error("forbidden"); }),
      permissionCode: "order.read",
    });
    expect(res).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects non-owner when thread has no restaurantId", async () => {
    const res = await authorizeChatThreadJoin({
      socketUser: { id: "u2" },
      threadId: "t4",
      findThreadById: vi.fn(async () => ({ _id: "t4", userId: "u1", restaurantId: null })),
      requireRestaurantPermissionFn: vi.fn(),
      permissionCode: "order.read",
    });
    expect(res).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});
