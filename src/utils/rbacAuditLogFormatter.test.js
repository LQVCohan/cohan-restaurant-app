import { describe, expect, it } from "vitest";
import {
  formatAuditActor,
  formatAuditChange,
  getAuditActionLabel,
  getAuditTargetTypeLabel,
} from "./rbacAuditLogFormatter";

describe("rbacAuditLogFormatter", () => {
  it("maps ROLE_CREATED to Vietnamese", () => {
    expect(getAuditActionLabel("ROLE_CREATED")).toBe("Tạo vai trò");
  });

  it("falls back to raw action for unknown actions", () => {
    expect(getAuditActionLabel("UNKNOWN_ACTION")).toBe("UNKNOWN_ACTION");
  });

  it("maps target type labels", () => {
    expect(getAuditTargetTypeLabel("ParentRole")).toBe("Nhóm vai trò");
  });

  it("formats staff role assignment from before and after roles", () => {
    expect(formatAuditChange({
      action: "STAFF_ROLE_ASSIGNED",
      before: { role: { name: "Phục vụ", slug: "server" } },
      after: { role: { name: "Thu ngân", slug: "cashier" } },
      metadata: { assignedRoleSlug: "cashier" },
    })).toContain("Vai trò: Phục vụ → Thu ngân");
  });

  it("formats name changes", () => {
    expect(formatAuditChange({
      before: { name: "Cũ" },
      after: { name: "Mới" },
    })).toBe("Tên: Cũ → Mới");
  });

  it("formats permission changes", () => {
    expect(formatAuditChange({ action: "ROLE_PERMISSION_UPDATED", before: {}, after: {} })).toBe("Danh sách quyền đã được cập nhật");
  });

  it("formats actor fallback", () => {
    expect(formatAuditActor({ actorName: "Admin" })).toBe("Admin");
    expect(formatAuditActor({ actorId: "user-1" })).toBe("user-1");
  });
});
