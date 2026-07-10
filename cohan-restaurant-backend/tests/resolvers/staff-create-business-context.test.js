import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  legacyCreateStaff: vi.fn(),
  legacyUpdateStaff: vi.fn(),
  legacyDeleteStaff: vi.fn(),
  legacySetEmploymentStatus: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRestaurantPermission: vi.fn(async () => true),
  getStaffRestaurantIds: vi.fn(),
  assertAssignableStaffRole: vi.fn(),
  assignStaffRoleWithinRestaurant: vi.fn(),
  assertNoLockedPayrollPeriodOverlap: vi.fn(async () => true),
  sanitizeStaffPrivateProfile: vi.fn((value) => value),
  Restaurant: { findById: vi.fn() },
  Role: { findById: vi.fn() },
  BrandMembership: {
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  },
  Staff: {
    deleteOne: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => Boolean(value)),
  },
}));

vi.mock("../../models/index.js", () => ({
  Restaurant: mocks.Restaurant,
  Role: mocks.Role,
  BrandMembership: mocks.BrandMembership,
  Staff: mocks.Staff,
}));

vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: mocks.requireRestaurantAccess,
}));

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: mocks.requireRestaurantPermission,
}));

vi.mock("../../src/services/auth/restaurantScope.service.js", () => ({
  getStaffRestaurantIds: mocks.getStaffRestaurantIds,
}));

vi.mock("../../src/services/auth/staffRoleAssignment.service.js", () => ({
  assertAssignableStaffRole: mocks.assertAssignableStaffRole,
  assignStaffRoleWithinRestaurant: mocks.assignStaffRoleWithinRestaurant,
}));

vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({
  assertNoLockedPayrollPeriodOverlap:
    mocks.assertNoLockedPayrollPeriodOverlap,
}));

vi.mock("../../src/security/userDtos.js", () => ({
  sanitizeStaffPrivateProfile: mocks.sanitizeStaffPrivateProfile,
}));

vi.mock("../../graphql/resolvers/staff/query.js", () => ({ default: {} }));
vi.mock("../../graphql/resolvers/staff/payrollReadiness.query.js", () => ({
  default: {},
}));
vi.mock("../../graphql/resolvers/staff/mutation.js", () => ({
  default: {
    createStaff: mocks.legacyCreateStaff,
    updateStaff: mocks.legacyUpdateStaff,
    deleteStaff: mocks.legacyDeleteStaff,
    setStaffEmploymentStatus: mocks.legacySetEmploymentStatus,
  },
}));
vi.mock("../../graphql/resolvers/staff/staffAvatar.mutation.js", () => ({
  default: {},
}));
vi.mock(
  "../../graphql/resolvers/staff/payrollFinalizeReadiness.mutation.js",
  () => ({ default: {} }),
);
vi.mock(
  "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js",
  () => ({ default: {} }),
);

const mockRestaurant = (restaurant) => {
  mocks.Restaurant.findById.mockReturnValue({
    select: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(restaurant),
    })),
  });
};

const mockRole = (role = {}) => {
  const resolvedRole = {
    _id: "role-server",
    slug: "server",
    department: "service",
    parentRole: { slug: "staff", permissions: [] },
    permissions: [],
    ...role,
  };
  const query = {
    populate: vi.fn(),
    lean: vi.fn().mockResolvedValue(resolvedRole),
  };
  query.populate.mockReturnValue(query);
  mocks.Role.findById.mockReturnValue(query);
  return resolvedRole;
};

const mockStaffForUpdate = (staff = {}) => {
  const resolvedStaff = {
    _id: "staff-1",
    userType: "STAFF",
    deletedAt: null,
    role: "role-server",
    department: "service",
    positionTitle: "Nhân viên phục vụ",
    employmentType: "full_time",
    employmentStatus: "working",
    dateJoined: new Date("2026-01-01T00:00:00.000Z"),
    dateLeft: null,
    baseSalary: 5_000_000,
    emergencyContacts: [
      {
        name: "Nguyễn Thị B",
        phone: "0912345678",
        relation: "Mẹ",
        isPrimary: true,
      },
      {
        name: "Nguyễn Văn C",
        phone: "0988888888",
        relation: "Anh",
        isPrimary: false,
      },
    ],
    ...staff,
  };
  mocks.Staff.findById.mockReturnValue({
    select: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(resolvedStaff),
    })),
  });
  return resolvedStaff;
};

const createArgs = {
  input: {
    fullName: "Nhân viên mới",
    department: "service",
    roleId: "role-server",
    emergencyContact: {
      name: "Nguyễn Thị B",
      phone: "0912345678",
      relation: "Mẹ",
    },
    staffBusinessContext: {
      brandId: "brand-active",
      restaurantId: "restaurant-active",
    },
  },
};

const context = { user: { id: "manager-1", roleName: "manager" } };

describe("staff active business context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRestaurant({ _id: "restaurant-active", brandId: "brand-active" });
    mockRole();
    mockStaffForUpdate();
    mocks.getStaffRestaurantIds.mockResolvedValue(["restaurant-active"]);
    mocks.legacyCreateStaff.mockResolvedValue({ id: "staff-1" });
    mocks.legacyUpdateStaff.mockResolvedValue({ id: "staff-1" });
    mocks.legacyDeleteStaff.mockResolvedValue(true);
    mocks.legacySetEmploymentStatus.mockResolvedValue({ id: "staff-1" });
    mocks.BrandMembership.findOneAndUpdate.mockResolvedValue({
      id: "membership-1",
    });
    mocks.BrandMembership.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mocks.Staff.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mocks.assignStaffRoleWithinRestaurant.mockResolvedValue({
      _id: "staff-1",
      fullName: "Nhân viên mới",
    });
  });

  it("creates membership and assigns a staff-derived role without passing roleId to the legacy creator", async () => {
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    const created = await resolvers.Mutation.createStaff(
      null,
      createArgs,
      context,
    );

    expect(created).toMatchObject({ _id: "staff-1" });
    expect(mocks.requireRestaurantPermission).toHaveBeenCalledWith(
      context,
      "restaurant-active",
      "staff.write",
    );
    expect(mocks.assertAssignableStaffRole).toHaveBeenCalledWith(
      expect.objectContaining({ actor: context.user }),
    );
    expect(mocks.legacyCreateStaff).toHaveBeenCalledWith(
      null,
      {
        input: {
          fullName: "Nhân viên mới",
          department: "service",
          emergencyContacts: [
            {
              name: "Nguyễn Thị B",
              phone: "0912345678",
              relation: "Mẹ",
              isPrimary: true,
            },
          ],
          businessRestaurantId: "restaurant-active",
        },
      },
      context,
      undefined,
    );
    expect(mocks.BrandMembership.findOneAndUpdate).toHaveBeenCalledWith(
      { brandId: "brand-active", userId: "staff-1" },
      {
        $set: {
          role: "staff",
          restaurantIds: ["restaurant-active"],
          status: "active",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    expect(mocks.assignStaffRoleWithinRestaurant).toHaveBeenCalledWith({
      actor: context.user,
      staffUserId: "staff-1",
      roleId: "role-server",
      restaurantId: "restaurant-active",
      ctx: context,
    });
  });

  it("rejects a restaurant outside the active business before creating the account", async () => {
    mockRestaurant({ _id: "restaurant-active", brandId: "brand-other" });
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await expect(
      resolvers.Mutation.createStaff(null, createArgs, context),
    ).rejects.toThrow("Nhà hàng không thuộc doanh nghiệp đang hoạt động");

    expect(mocks.legacyCreateStaff).not.toHaveBeenCalled();
    expect(mocks.BrandMembership.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("removes both membership and new account when role synchronization fails", async () => {
    mocks.assignStaffRoleWithinRestaurant.mockRejectedValue(
      new Error("ROLE_ASSIGNMENT_FAILED"),
    );
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await expect(
      resolvers.Mutation.createStaff(null, createArgs, context),
    ).rejects.toThrow("ROLE_ASSIGNMENT_FAILED");

    expect(mocks.BrandMembership.deleteOne).toHaveBeenCalledWith({
      brandId: "brand-active",
      userId: "staff-1",
    });
    expect(mocks.Staff.deleteOne).toHaveBeenCalledWith({ _id: "staff-1" });
  });

  it("removes unchanged payroll fields and preserves emergency relation", async () => {
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await resolvers.Mutation.updateStaff(
      null,
      {
        userId: "staff-1",
        input: {
          fullName: "Nhân viên cập nhật",
          department: "service",
          roleId: "role-server",
          positionTitle: "Nhân viên phục vụ",
          employmentType: "FULL_TIME",
          employmentStatus: "WORKING",
          dateJoined: "2026-01-01T00:00:00.000Z",
          baseSalary: 5_000_000,
          emergencyContact: {
            name: "Nguyễn Thị B",
            phone: "0999999999",
          },
        },
      },
      context,
    );

    expect(mocks.requireRestaurantPermission).toHaveBeenCalledWith(
      context,
      "restaurant-active",
      "staff.write",
    );
    expect(mocks.assertNoLockedPayrollPeriodOverlap).not.toHaveBeenCalled();
    expect(mocks.legacyUpdateStaff).toHaveBeenCalledWith(
      null,
      {
        userId: "staff-1",
        input: {
          fullName: "Nhân viên cập nhật",
          emergencyContacts: [
            {
              name: "Nguyễn Thị B",
              phone: "0999999999",
              relation: "Mẹ",
              isPrimary: true,
            },
            {
              name: "Nguyễn Văn C",
              phone: "0988888888",
              relation: "Anh",
              isPrimary: false,
            },
          ],
        },
        restaurantId: "restaurant-active",
      },
      context,
      undefined,
    );
  });

  it("keeps a changed salary so the existing admin-only guard remains authoritative", async () => {
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await resolvers.Mutation.updateStaff(
      null,
      {
        userId: "staff-1",
        input: {
          fullName: "Nhân viên cập nhật",
          baseSalary: 6_000_000,
        },
      },
      context,
    );

    expect(mocks.legacyUpdateStaff).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        input: expect.objectContaining({ baseSalary: 6_000_000 }),
      }),
      context,
      undefined,
    );
  });

  it("keeps the payroll lock guard when the role really changes", async () => {
    const role = mockRole({ _id: "role-cashier", slug: "cashier" });
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await resolvers.Mutation.updateStaff(
      null,
      {
        userId: "staff-1",
        input: {
          roleId: "role-cashier",
          department: "service",
        },
      },
      context,
    );

    expect(mocks.assertNoLockedPayrollPeriodOverlap).toHaveBeenCalledWith({
      restaurantId: "restaurant-active",
      employeeId: "staff-1",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: expect.any(Date),
      action: "update_staff",
    });
    expect(mocks.legacyUpdateStaff).toHaveBeenCalledWith(
      null,
      {
        userId: "staff-1",
        input: { role: role._id },
        restaurantId: "restaurant-active",
      },
      context,
      undefined,
    );
  });

  it("routes account lock and unlock through the scoped staff updater", async () => {
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await resolvers.Mutation.setStaffAccountStatus(
      null,
      { userId: "staff-1", status: "blocked" },
      context,
    );

    expect(mocks.requireRestaurantPermission).toHaveBeenCalledWith(
      context,
      "restaurant-active",
      "staff.write",
    );
    expect(mocks.legacyUpdateStaff).toHaveBeenCalledWith(
      null,
      {
        userId: "staff-1",
        input: { status: "blocked" },
        restaurantId: "restaurant-active",
      },
      context,
      undefined,
    );
  });

  it("rejects invalid account statuses before mutating staff", async () => {
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await expect(
      resolvers.Mutation.setStaffAccountStatus(
        null,
        { userId: "staff-1", status: "owner" },
        context,
      ),
    ).rejects.toThrow("Trạng thái tài khoản nhân viên không hợp lệ");

    expect(mocks.legacyUpdateStaff).not.toHaveBeenCalled();
  });

  it("requires staff.write before soft deleting an employee", async () => {
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await expect(
      resolvers.Mutation.deleteStaff(
        null,
        { userId: "staff-1" },
        context,
      ),
    ).resolves.toBe(true);

    expect(mocks.requireRestaurantPermission).toHaveBeenCalledWith(
      context,
      "restaurant-active",
      "staff.write",
    );
    expect(mocks.legacyDeleteStaff).toHaveBeenCalledWith(
      null,
      { userId: "staff-1" },
      context,
      undefined,
    );
  });

  it("requires staff.write before changing employment status", async () => {
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await resolvers.Mutation.setStaffEmploymentStatus(
      null,
      { userId: "staff-1", employmentStatus: "ON_LEAVE" },
      context,
    );

    expect(mocks.requireRestaurantPermission).toHaveBeenCalledWith(
      context,
      "restaurant-active",
      "staff.write",
    );
    expect(mocks.legacySetEmploymentStatus).toHaveBeenCalledWith(
      null,
      { userId: "staff-1", employmentStatus: "ON_LEAVE" },
      context,
      undefined,
    );
  });
});
