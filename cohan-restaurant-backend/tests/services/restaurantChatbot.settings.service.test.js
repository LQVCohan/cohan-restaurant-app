import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const anyPermissionSpy = vi.fn();

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: (...args) => permissionSpy(...args),
  requireAnyRestaurantPermission: (...args) => anyPermissionSpy(...args),
}));

import { Restaurant } from "../../models/index.js";
import {
  getPublicAiChatbotSettings,
  getRestaurantAiChatbotSettings,
  updateRestaurantAiChatbotSettings,
} from "../../src/services/ai/restaurantChatbotSettings.service.js";
import { clearAiChatbotCache } from "../../src/services/ai/restaurantChatbotCache.service.js";
import { PERMISSIONS } from "../../src/constants/permissions.js";

const rid = new mongoose.Types.ObjectId().toString();
const uid = new mongoose.Types.ObjectId().toString();

const longText = "x".repeat(501);

const mockRestaurantFindById = (restaurantDoc) =>
  vi.spyOn(Restaurant, "findById").mockReturnValue({
    select: vi.fn(() => Promise.resolve(restaurantDoc)),
  });

const mockLeanRestaurantFindById = (restaurantDoc) =>
  vi.spyOn(Restaurant, "findById").mockReturnValue({
    select: vi.fn(() => ({
      lean: vi.fn(() => Promise.resolve(restaurantDoc)),
    })),
  });

describe("restaurantChatbotSettings permission + validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAiChatbotCache();
    permissionSpy.mockReset();
    anyPermissionSpy.mockReset();
    permissionSpy.mockResolvedValue(true);
    anyPermissionSpy.mockResolvedValue(true);
  });

  it("manager read uses AI chatbot read/write permissions", async () => {
    mockLeanRestaurantFindById({ aiChatbotSettings: { enabled: true } });

    const out = await getRestaurantAiChatbotSettings({
      restaurantId: rid,
      ctx: { user: { _id: uid, roleName: "manager" } },
    });

    expect(out.enabled).toBe(true);
    expect(anyPermissionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      rid,
      [PERMISSIONS.AI_CHATBOT_READ, PERMISSIONS.AI_CHATBOT_WRITE],
    );
  });

  it("staff with restaurant access but without AI write permission cannot update", async () => {
    permissionSpy.mockRejectedValueOnce(
      Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" }),
    );

    await expect(
      updateRestaurantAiChatbotSettings({
        input: { restaurantId: rid, enabled: false },
        ctx: { user: { _id: uid, roleName: "staff", restaurantForStaff: rid } },
      }),
    ).rejects.toThrow("FORBIDDEN");

    expect(permissionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      rid,
      PERMISSIONS.AI_CHATBOT_WRITE,
    );
  });

  it("manager/admin with AI write permission can update", async () => {
    const restaurantDoc = {
      aiChatbotSettings: { welcomeMessage: "hello" },
      save: vi.fn().mockResolvedValue(true),
    };
    mockRestaurantFindById(restaurantDoc);

    const out = await updateRestaurantAiChatbotSettings({
      input: { restaurantId: rid, enabled: false },
      ctx: { user: { _id: uid, roleName: "manager" } },
    });

    expect(out.enabled).toBe(false);
    expect(restaurantDoc.save).toHaveBeenCalled();
    expect(permissionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      rid,
      PERMISSIONS.AI_CHATBOT_WRITE,
    );
  });

  it("guest/customer cannot update", async () => {
    await expect(
      updateRestaurantAiChatbotSettings({
        input: { restaurantId: rid, enabled: false },
        ctx: { user: null },
      }),
    ).rejects.toThrow("Cần đăng nhập");
  });

  it("rejects invalid low confidence threshold before saving", async () => {
    const findByIdSpy = vi.spyOn(Restaurant, "findById");

    for (const value of [Number.NaN, -0.1, 1.1, "not-a-number"]) {
      await expect(
        updateRestaurantAiChatbotSettings({
          input: {
            restaurantId: rid,
            lowConfidenceHandoffThreshold: value,
          },
          ctx: { user: { _id: uid, roleName: "manager" } },
        }),
      ).rejects.toMatchObject({ code: "BAD_USER_INPUT" });
    }

    expect(findByIdSpy).not.toHaveBeenCalled();
  });

  it("rejects customer-facing messages longer than 500 characters", async () => {
    await expect(
      updateRestaurantAiChatbotSettings({
        input: {
          restaurantId: rid,
          welcomeMessage: longText,
        },
        ctx: { user: { _id: uid, roleName: "manager" } },
      }),
    ).rejects.toMatchObject({ code: "BAD_USER_INPUT" });

    await expect(
      updateRestaurantAiChatbotSettings({
        input: {
          restaurantId: rid,
          handoffUnavailableMessage: longText,
        },
        ctx: { user: { _id: uid, roleName: "manager" } },
      }),
    ).rejects.toMatchObject({ code: "BAD_USER_INPUT" });
  });

  it("rejects more than 8 quick replies and overlong quick replies", async () => {
    await expect(
      updateRestaurantAiChatbotSettings({
        input: {
          restaurantId: rid,
          starterQuickReplies: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        },
        ctx: { user: { _id: uid, roleName: "manager" } },
      }),
    ).rejects.toMatchObject({ code: "BAD_USER_INPUT" });

    await expect(
      updateRestaurantAiChatbotSettings({
        input: {
          restaurantId: rid,
          starterQuickReplies: ["x".repeat(81)],
        },
        ctx: { user: { _id: uid, roleName: "manager" } },
      }),
    ).rejects.toMatchObject({ code: "BAD_USER_INPUT" });
  });

  it("public settings works without auth and excludes internal fields", async () => {
    mockLeanRestaurantFindById({
      businessStatus: "active",
      publicationStatus: "published",
      aiChatbotSettings: {
        enabled: true,
        fallbackMessage: "internal",
        updatedBy: uid,
      },
    });

    const out = await getPublicAiChatbotSettings({ restaurantId: rid });

    expect(out).toHaveProperty("enabled");
    expect(out).toHaveProperty("welcomeMessage");
    expect(out).not.toHaveProperty("fallbackMessage");
    expect(out).not.toHaveProperty("updatedBy");
  });

  it("public settings returns global defaults for null restaurant", async () => {
    const out = await getPublicAiChatbotSettings({ restaurantId: null });
    expect(out.enabled).toBe(true);
    expect(out.handoffEnabled).toBe(true);
    expect(out.starterQuickReplies.length).toBeGreaterThan(0);
  });

  it("public settings disables unavailable direct restaurants", async () => {
    const invalid = await getPublicAiChatbotSettings({ restaurantId: "not-an-id" });
    expect(invalid).toMatchObject({ enabled: false, handoffEnabled: false, starterQuickReplies: [] });

    mockLeanRestaurantFindById({ businessStatus: "inactive", publicationStatus: "published", aiChatbotSettings: { enabled: true } });
    const inactive = await getPublicAiChatbotSettings({ restaurantId: rid });
    expect(inactive).toMatchObject({ enabled: false, handoffEnabled: false, starterQuickReplies: [] });

    clearAiChatbotCache();
    vi.restoreAllMocks();
    mockLeanRestaurantFindById({ businessStatus: "active", publicationStatus: "published", aiChatbotSettings: { enabled: false } });
    const disabled = await getPublicAiChatbotSettings({ restaurantId: rid });
    expect(disabled).toMatchObject({ enabled: false, handoffEnabled: false, starterQuickReplies: [] });
  });

});
