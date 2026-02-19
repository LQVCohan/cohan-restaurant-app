import test from "node:test";
import assert from "node:assert/strict";
import { hasAllowedRole, resolveRoleName } from "../routeGuard.js";

test("resolveRoleName returns null when me payload has no role", () => {
  assert.equal(resolveRoleName(null), null);
  assert.equal(resolveRoleName({ roleName: null, role: null }), null);
});

test("resolveRoleName ưu tiên roleName để đồng bộ với AuthProvider", () => {
  const me = { roleName: "manager", role: { slug: "admin" } };
  assert.equal(resolveRoleName(me), "manager");
});

test("resolveRoleName fallback từ me.role.slug khi roleName trống", () => {
  const me = { roleName: "", role: { slug: "staff" } };
  assert.equal(resolveRoleName(me), "staff");
});

test("hasAllowedRole cho phép khi route không có allowedRoles", () => {
  assert.equal(hasAllowedRole(undefined, null), true);
});

test("hasAllowedRole cho phép token + role hợp lệ", () => {
  assert.equal(hasAllowedRole(["staff", "manager"], "staff"), true);
});

test("hasAllowedRole từ chối token + role không hợp lệ", () => {
  assert.equal(hasAllowedRole(["admin"], "customer"), false);
});

test("hasAllowedRole từ chối token + role null khi route yêu cầu role", () => {
  assert.equal(hasAllowedRole(["admin"], null), false);
});
