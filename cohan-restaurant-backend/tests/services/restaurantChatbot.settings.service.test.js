import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { Restaurant } from "../../models/index.js";
import { getPublicAiChatbotSettings, updateRestaurantAiChatbotSettings } from "../../src/services/ai/restaurantChatbotSettings.service.js";

const rid = new mongoose.Types.ObjectId().toString();
const uid = new mongoose.Types.ObjectId().toString();

describe("restaurantChatbotSettings service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("partial update preserves existing settings fields", async () => {
    const restaurantDoc = {
      aiChatbotSettings: {
        enabled: true,
        welcomeMessage: "hello",
        starterQuickReplies: ["a", "b"],
        handoffEnabled: true,
        handoffUnavailableMessage: "h",
        lowConfidenceHandoffThreshold: 0.7,
        fallbackMessage: "fallback",
      },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(Restaurant, "findById")
      .mockReturnValueOnce({ select: () => Promise.resolve({ _id: rid, managerId: uid }) })
      .mockReturnValueOnce({ select: () => Promise.resolve(restaurantDoc) });

    const out = await updateRestaurantAiChatbotSettings({
      input: { restaurantId: rid, enabled: false },
      user: { _id: uid, roleName: "manager" },
    });

    expect(out.enabled).toBe(false);
    expect(out.welcomeMessage).toBe("hello");
    expect(out.starterQuickReplies).toEqual(["a", "b"]);
    expect(out.handoffEnabled).toBe(true);
    expect(out.fallbackMessage).toBe("fallback");
    expect(restaurantDoc.save).toHaveBeenCalled();
  });

  it("sets updatedAt and updatedBy on update", async () => {
    const restaurantDoc = { aiChatbotSettings: {}, save: vi.fn().mockResolvedValue(true) };
    vi.spyOn(Restaurant, "findById")
      .mockReturnValueOnce({ select: () => Promise.resolve({ _id: rid, managerId: uid }) })
      .mockReturnValueOnce({ select: () => Promise.resolve(restaurantDoc) });

    const out = await updateRestaurantAiChatbotSettings({
      input: { restaurantId: rid, fallbackMessage: "x" },
      user: { _id: uid, roleName: "manager" },
    });

    expect(out.updatedBy).toBeTruthy();
    expect(out.updatedAt).toBeTruthy();
  });

  it("public settings response excludes internal fields", async () => {
    vi.spyOn(Restaurant, "findById").mockReturnValue({
      select: () => Promise.resolve({ aiChatbotSettings: { enabled: true, fallbackMessage: "internal", updatedBy: uid } }),
    });

    const out = await getPublicAiChatbotSettings({ restaurantId: rid });
    expect(out).toHaveProperty("enabled");
    expect(out).toHaveProperty("welcomeMessage");
    expect(out).not.toHaveProperty("fallbackMessage");
    expect(out).not.toHaveProperty("updatedBy");
    expect(out).not.toHaveProperty("updatedAt");
  });
});
