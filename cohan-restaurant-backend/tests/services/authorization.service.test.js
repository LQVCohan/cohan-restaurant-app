import { describe, expect, it } from "vitest";
import {
  getUserEffectivePermissions,
  normalizePermissionCode,
} from "../../src/services/auth/authorization.service.js";

describe("authorization service utilities", () => {
  it("normalizes capability codes", () => {
    expect(normalizePermissionCode(" MENU.READ ")).toBe("menu.read");
  });

  it("merges parent and concrete role capabilities without duplicates", async () => {
    const shared = { _id: "p1", code: "order.read" };
    const user = {
      id: "u1",
      role: {
        slug: "server",
        parentRole: {
          permissions: [shared, { _id: "p2", code: "menu.read" }],
        },
        permissions: [shared, { _id: "p3", code: "order.create" }],
      },
    };

    const values = (await getUserEffectivePermissions(user))
      .map((item) => item.code)
      .sort();
    expect(values).toEqual(["menu.read", "order.create", "order.read"]);
  });
});
