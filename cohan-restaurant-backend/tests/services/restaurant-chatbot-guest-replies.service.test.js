import { describe, expect, it } from "vitest";
import { toGuestStaffReplies } from "../../src/services/ai/restaurantChatbotGuestReplies.service.js";

describe("toGuestStaffReplies", () => {
  const baseDate = new Date("2026-05-20T10:00:00.000Z");

  it("maps valid staff replies to guest-safe payload", () => {
    const rows = toGuestStaffReplies({
      messages: [
        { _id: "m1", senderRole: "STAFF", senderId: "u1", content: "Xin chào", createdAt: baseDate },
      ],
    });

    expect(rows).toEqual([
      {
        id: "m1",
        role: "staff",
        senderLabel: "Nhân viên",
        content: "Xin chào",
        createdAt: baseDate.toISOString(),
      },
    ]);
  });

  it("excludes handoff summary, system, customer and empty messages", () => {
    const rows = toGuestStaffReplies({
      messages: [
        { senderRole: "system", senderName: "AI", content: "[AI HANDOFF] summary", createdAt: baseDate },
        { senderRole: "guest", senderId: "g1", content: "Tôi cần hỗ trợ", createdAt: baseDate },
        { senderRole: "staff", senderId: "u1", content: "   ", createdAt: baseDate },
        { senderRole: "manager", senderId: "u2", content: "Mình hỗ trợ bạn nhé", createdAt: baseDate },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("Mình hỗ trợ bạn nhé");
  });

  it("filters by after cursor when valid", () => {
    const rows = toGuestStaffReplies({
      after: "2026-05-20T10:00:01.000Z",
      messages: [
        { _id: "a", senderRole: "staff", senderId: "u1", content: "old", createdAt: "2026-05-20T10:00:01.000Z" },
        { _id: "b", senderRole: "staff", senderId: "u1", content: "new", createdAt: "2026-05-20T10:00:02.000Z" },
      ],
    });

    expect(rows.map((x) => x.id)).toEqual(["b"]);
  });

  it("clamps limit to 50", () => {
    const messages = Array.from({ length: 70 }).map((_, index) => ({
      _id: `id_${index}`,
      senderRole: "staff",
      senderId: "u1",
      content: `m_${index}`,
      createdAt: new Date(baseDate.getTime() + index * 1000),
    }));

    const rows = toGuestStaffReplies({ messages, limit: 500 });
    expect(rows).toHaveLength(50);
    expect(rows[0].id).toBe("id_20");
    expect(rows[49].id).toBe("id_69");
  });

  it("ignores invalid after cursor safely", () => {
    const rows = toGuestStaffReplies({
      after: "not-a-date",
      messages: [{ _id: "m1", senderRole: "staff", senderId: "u1", content: "ok", createdAt: baseDate }],
    });

    expect(rows).toHaveLength(1);
  });
});
