import { describe, expect, it } from "vitest";
import {
  buildDetailGroups,
  buildSearchText,
  formatActor,
  formatDateTimeParts,
  formatObjectReference,
  humanizeAction,
  matchesFriendlySearch,
  shortenIdentifier,
} from "./systemLogsPresentation";

describe("formatDateTimeParts", () => {
  it("converts a millisecond timestamp string instead of showing the raw number", () => {
    const result = formatDateTimeParts("1783976721234");

    expect(result.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(result.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(result.full).not.toContain("1783976721234");
  });

  it("keeps an invalid value readable", () => {
    expect(formatDateTimeParts("không xác định")).toEqual({
      date: "không xác định",
      time: "",
      full: "không xác định",
    });
  });
});

describe("friendly activity labels", () => {
  it("translates common event codes into natural Vietnamese", () => {
    expect(humanizeAction("review.helpful")).toBe("Đánh dấu đánh giá hữu ích");
    expect(humanizeAction("review.react")).toBe("Bày tỏ cảm xúc với đánh giá");
    expect(humanizeAction("table.vr.generate")).toBe("Tạo ảnh 360° cho bàn");
  });

  it("creates a readable fallback for an unknown code", () => {
    expect(humanizeAction("menu.update")).toBe("Cập nhật thực đơn");
  });
});

describe("friendly references", () => {
  it("shortens long technical identifiers", () => {
    expect(shortenIdentifier("6a554211c3e3d7a76c58f810")).toBe("…58f810");
    expect(formatActor({ actorUserId: "6a554211c3e3d7a76c58f810" }))
      .toBe("Nhân viên · mã …58f810");
  });

  it("prefers a business code over a database identifier", () => {
    expect(formatObjectReference({ kind: "table", id: "long-database-id", code: "T111" }))
      .toBe("Bàn · T111");
  });
});

describe("activity details", () => {
  it("keeps support-only identifiers out of the main information section", () => {
    const result = buildDetailGroups({
      meta: { reviewId: "review-01", isHelpful: true },
      sessionId: "session-01",
      correlationId: "correlation-01",
    });

    expect(result.visible).toHaveLength(1);
    expect(result.visible[0].label).toBe("Thông tin bổ sung");
    expect(result.visible[0].value).toContain("Được đánh dấu hữu ích");
    expect(result.technical.map((item) => item.label)).toEqual([
      "Mã liên kết xử lý",
      "Mã phiên làm việc",
    ]);
  });

  it("supports searching by both friendly and original values", () => {
    const entry = {
      searchText: buildSearchText(
        "Đánh dấu đánh giá hữu ích",
        "review.helpful",
        "Bàn · T111",
      ),
    };

    expect(matchesFriendlySearch(entry, "đánh giá hữu ích")).toBe(true);
    expect(matchesFriendlySearch(entry, "review.helpful")).toBe(true);
    expect(matchesFriendlySearch(entry, "T111")).toBe(true);
    expect(matchesFriendlySearch(entry, "thanh toán")).toBe(false);
  });
});
