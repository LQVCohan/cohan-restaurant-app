import { describe, expect, it } from "vitest";
import { permissions } from "../../scripts/seedPermissions.js";
import { PERMISSIONS } from "../../src/constants/permissions.js";
import { MANAGER_STAFF_PERMISSION_WHITELIST } from "../../src/services/auth/authorization.service.js";

const catalogByCode = new Map(permissions.map((permission) => [permission.code, permission]));

describe("seed permission catalog", () => {
  it("keeps permission codes unique", () => {
    expect(catalogByCode.size).toBe(permissions.length);
  });

  it("contains every generic permission constant used by backend resolvers", () => {
    const missing = Object.values(PERMISSIONS).filter((code) => !catalogByCode.has(code));
    expect(missing).toEqual([]);
  });

  it("contains every permission a manager is allowed to assign", () => {
    const missing = MANAGER_STAFF_PERMISSION_WHITELIST.filter((code) => !catalogByCode.has(code));
    expect(missing).toEqual([]);
  });

  it("uses Vietnamese product wording for previously mixed labels", () => {
    expect(catalogByCode.get("role.read")?.name).toBe("Xem vai trò");
    expect(catalogByCode.get("permission.write")?.name).toBe("Quản lý danh mục quyền");
    expect(catalogByCode.get("dashboard.read")?.name).toBe("Xem tổng quan vận hành");
    expect(catalogByCode.get("ai.chatbot.analytics.read")?.name).toBe("Xem báo cáo trợ lý AI");
    expect(catalogByCode.get("ai.chatbot.handoff")?.name).toBe("Tiếp nhận hội thoại cần hỗ trợ");
    expect(catalogByCode.get("menu.read")?.name).toBe("Xem thực đơn");
    expect(catalogByCode.get("review.report.resolve")?.name).toBe("Xử lý báo cáo vi phạm đánh giá");
  });
});
