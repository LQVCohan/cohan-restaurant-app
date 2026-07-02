import { beforeEach, describe, expect, it, vi } from "vitest";

const jwtMocks = vi.hoisted(() => ({
  verify: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  User: {
    findById: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({ default: jwtMocks }));
vi.mock("../../models/index.js", () => userMocks);

function findByIdChain(userDoc) {
  const chain = {
    populate: vi.fn(() => chain),
    lean: vi.fn().mockResolvedValue(userDoc),
  };
  return chain;
}

const activeUserDoc = {
  _id: "user-1",
  email: "manager@example.com",
  fullName: "Manager User",
  status: "active",
  emailVerified: true,
  phoneVerified: true,
  forcePasswordChange: false,
  userType: "staff",
  provider: "local",
  refRestaurants: ["restaurant-1"],
  restaurantForStaff: "restaurant-1",
  restaurantId: "restaurant-1",
  role: {
    slug: "manager",
    name: "Manager",
    permissions: [
      { code: "menu.copy" },
      { permissionCode: "menu.delete" },
      { code: "menu.copy" },
    ],
    parentRole: {
      slug: "manager",
      permissions: [
        { code: "menu.read" },
        { slug: "menu.write" },
      ],
    },
  },
};

describe("resolveAuthenticatedUserFromRequest", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    delete process.env.JWT_ISSUER;
  });

  it("returns null when Authorization header is missing", async () => {
    const { resolveAuthenticatedUserFromRequest } = await import(
      "../../src/server/authUserResolver.js"
    );

    await expect(resolveAuthenticatedUserFromRequest({ headers: {} })).resolves.toBeNull();
    expect(jwtMocks.verify).not.toHaveBeenCalled();
    expect(userMocks.User.findById).not.toHaveBeenCalled();
  });

  it("hydrates role, parent role, and deduped effective permission codes", async () => {
    jwtMocks.verify.mockReturnValue({ id: "user-1" });
    userMocks.User.findById.mockReturnValue(findByIdChain(activeUserDoc));

    const { resolveAuthenticatedUserFromRequest } = await import(
      "../../src/server/authUserResolver.js"
    );

    const user = await resolveAuthenticatedUserFromRequest({
      headers: { authorization: "Bearer token-1" },
    });

    expect(jwtMocks.verify).toHaveBeenCalledWith("token-1", "test-secret", {
      issuer: "foodhub-system",
    });
    expect(userMocks.User.findById).toHaveBeenCalledWith("user-1");
    expect(user.roleName).toBe("manager");
    expect(user.restaurantId).toBe("restaurant-1");
    expect(user.emailVerified).toBe(true);
    expect(user.phoneVerified).toBe(true);
    expect(user.forcePasswordChange).toBe(false);
    expect(user.permissions).toEqual(activeUserDoc.role.permissions);
    expect(user.effectivePermissions).toEqual([
      ...activeUserDoc.role.parentRole.permissions,
      ...activeUserDoc.role.permissions,
    ]);
    expect(user.effectivePermissionCodes).toEqual([
      "menu.read",
      "menu.write",
      "menu.copy",
      "menu.delete",
    ]);
  });

  it("supports uppercase Authorization header", async () => {
    jwtMocks.verify.mockReturnValue({ sub: "user-1" });
    userMocks.User.findById.mockReturnValue(findByIdChain(activeUserDoc));

    const { resolveAuthenticatedUserFromRequest } = await import(
      "../../src/server/authUserResolver.js"
    );

    const user = await resolveAuthenticatedUserFromRequest({
      headers: { Authorization: "Bearer token-2" },
    });

    expect(user.id).toBe("user-1");
    expect(jwtMocks.verify).toHaveBeenCalledWith("token-2", "test-secret", {
      issuer: "foodhub-system",
    });
  });

  it("returns null for inactive users", async () => {
    jwtMocks.verify.mockReturnValue({ userId: "user-1" });
    userMocks.User.findById.mockReturnValue(
      findByIdChain({ ...activeUserDoc, status: "inactive" }),
    );

    const { resolveAuthenticatedUserFromRequest } = await import(
      "../../src/server/authUserResolver.js"
    );

    await expect(
      resolveAuthenticatedUserFromRequest({ headers: { authorization: "Bearer token-3" } }),
    ).resolves.toBeNull();
  });

  it("returns null and logs warning when token verification fails", async () => {
    jwtMocks.verify.mockImplementation(() => {
      const error = new Error("bad token");
      error.name = "JsonWebTokenError";
      throw error;
    });
    const warn = vi.fn();

    const { resolveAuthenticatedUserFromRequest } = await import(
      "../../src/server/authUserResolver.js"
    );

    await expect(
      resolveAuthenticatedUserFromRequest({
        headers: { authorization: "Bearer bad-token" },
        log: { warn },
      }),
    ).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith(
      { code: "JsonWebTokenError" },
      "JWT verify failed; user = null",
    );
  });
});
