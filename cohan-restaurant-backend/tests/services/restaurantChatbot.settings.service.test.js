import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: (...args) => permissionSpy(...args),
}));

import { Restaurant } from "../../models/index.js";
import { getPublicAiChatbotSettings, updateRestaurantAiChatbotSettings } from "../../src/services/ai/restaurantChatbotSettings.service.js";
import { clearAiChatbotCache } from "../../src/services/ai/restaurantChatbotCache.service.js";
import { PERMISSIONS } from "../../src/constants/permissions.js";

const rid = new mongoose.Types.ObjectId().toString();
const uid = new mongoose.Types.ObjectId().toString();

describe("restaurantChatbotSettings permission + merge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAiChatbotCache();
    permissionSpy.mockReset();
    permissionSpy.mockResolvedValue(true);
  });

  it("staff with restaurant access but without required permission cannot update", async () => {
    permissionSpy.mockRejectedValueOnce(Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" }));
    await expect(updateRestaurantAiChatbotSettings({
      input: { restaurantId: rid, enabled: false },
      ctx: { user: { _id: uid, roleName: "staff", restaurantForStaff: rid } },
    })).rejects.toThrow("FORBIDDEN");
    expect(permissionSpy).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }), rid, PERMISSIONS.RESTAURANT_WRITE);
  });

  it("manager/admin with required permission can update", async () => {
    const restaurantDoc = { aiChatbotSettings: { welcomeMessage: "hello" }, save: vi.fn().mockResolvedValue(true) };
    vi.spyOn(Restaurant, "findById").mockReturnValue({ select: () => Promise.resolve(restaurantDoc) });

    const out = await updateRestaurantAiChatbotSettings({
      input: { restaurantId: rid, enabled: false },
      ctx: { user: { _id: uid, roleName: "manager" } },
    });
    expect(out.enabled).toBe(false);
    expect(restaurantDoc.save).toHaveBeenCalled();
    expect(permissionSpy).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }), rid, PERMISSIONS.RESTAURANT_WRITE);
  });

  it("guest/customer cannot update", async () => {
    await expect(updateRestaurantAiChatbotSettings({
      input: { restaurantId: rid, enabled: false },
      ctx: { user: null },
    })).rejects.toThrow("Cần đăng nhập");
  });

  it("public settings works without auth and excludes internal fields", async () => {
    vi.spyOn(Restaurant, "findById").mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ aiChatbotSettings: { enabled: true, fallbackMessage: "internal", updatedBy: uid } }) }),
    });
    const out = await getPublicAiChatbotSettings({ restaurantId: rid });
    expect(out).toHaveProperty("enabled");
    expect(out).toHaveProperty("welcomeMessage");
    expect(out).not.toHaveProperty("fallbackMessage");
    expect(out).not.toHaveProperty("updatedBy");
  });
});
