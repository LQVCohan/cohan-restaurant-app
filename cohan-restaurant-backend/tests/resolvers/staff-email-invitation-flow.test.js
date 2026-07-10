import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  BrandMembership: { deleteOne: vi.fn() },
  Staff: {
    findById: vi.fn(),
    deleteOne: vi.fn(),
  },
  generateRandomPassword: vi.fn(),
  sanitizeStaffPrivateProfile: vi.fn(),
  sendStaffInvitationEmail: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  BrandMembership: mocks.BrandMembership,
  Staff: mocks.Staff,
}));
vi.mock("../../models/user.model.js", () => ({
  generateRandomPassword: mocks.generateRandomPassword,
}));
vi.mock("../../src/security/userDtos.js", () => ({
  sanitizeStaffPrivateProfile: mocks.sanitizeStaffPrivateProfile,
}));
vi.mock("../../src/services/auth/staffInvitation.service.js", () => ({
  sendStaffInvitationEmail: mocks.sendStaffInvitationEmail,
}));

import { withStaffInvitationFlow } from "../../graphql/resolvers/staff/invitationFlow.js";

const context = { user: { id: "manager-1" } };
const businessContext = {
  brandId: "brand-1",
  restaurantId: "restaurant-1",
};

function staffDocument(overrides = {}) {
  return {
    _id: "staff-1",
    userType: "STAFF",
    email: undefined,
    phone: undefined,
    status: "active",
    emailVerified: false,
    save: vi.fn().mockResolvedValue(undefined),
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("staff email invitation flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateRandomPassword.mockReturnValue("Generated#123");
    mocks.sendStaffInvitationEmail.mockResolvedValue({ sent: true });
    mocks.BrandMembership.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mocks.Staff.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mocks.sanitizeStaffPrivateProfile.mockImplementation((staff) => ({
      id: String(staff._id),
      email: staff.email,
      status: staff.status,
      emailVerified: staff.emailVerified,
    }));
  });

  it("sends the manager-provided password only after the staff domain flow succeeds", async () => {
    const staff = staffDocument();
    mocks.Staff.findById.mockResolvedValue(staff);
    const createStaff = vi.fn().mockResolvedValue({ id: "staff-1" });
    const mutation = withStaffInvitationFlow({ createStaff }).createStaff;

    const result = await mutation(
      null,
      {
        input: {
          fullName: "Nhân viên A",
          email: " Staff@Example.com ",
          phone: "0901234567",
          password: "Provided#123",
          status: "active",
          staffBusinessContext: businessContext,
        },
      },
      context,
    );

    expect(createStaff).toHaveBeenCalledWith(
      null,
      {
        input: {
          fullName: "Nhân viên A",
          password: "Provided#123",
          status: "pending",
          staffBusinessContext: businessContext,
        },
      },
      context,
      undefined,
    );
    expect(staff).toMatchObject({
      email: "staff@example.com",
      phone: "0901234567",
      status: "pending",
      emailVerified: false,
      emailVerifiedAt: null,
      verifiedAt: null,
    });
    expect(staff.save).toHaveBeenCalledOnce();
    expect(mocks.sendStaffInvitationEmail).toHaveBeenCalledWith({
      staff,
      initialPassword: "Provided#123",
    });
    expect(createStaff.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendStaffInvitationEmail.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({
      id: "staff-1",
      email: "staff@example.com",
      status: "pending",
      emailVerified: false,
    });
  });

  it("generates and emails an initial password when the manager leaves it blank", async () => {
    const staff = staffDocument();
    mocks.Staff.findById.mockResolvedValue(staff);
    const createStaff = vi.fn().mockResolvedValue({ id: "staff-1" });
    const mutation = withStaffInvitationFlow({ createStaff }).createStaff;

    await mutation(
      null,
      {
        input: {
          fullName: "Nhân viên B",
          email: "generated@example.com",
          password: "   ",
          staffBusinessContext: businessContext,
        },
      },
      context,
    );

    expect(mocks.generateRandomPassword).toHaveBeenCalledWith(12);
    expect(createStaff.mock.calls[0][1].input.password).toBe("Generated#123");
    expect(mocks.sendStaffInvitationEmail).toHaveBeenCalledWith({
      staff,
      initialPassword: "Generated#123",
    });
  });

  it("rolls back the new account and membership when invitation delivery fails", async () => {
    const staff = staffDocument();
    mocks.Staff.findById.mockResolvedValue(staff);
    mocks.sendStaffInvitationEmail.mockRejectedValue(
      new Error("STAFF_INVITATION_EMAIL_NOT_SENT"),
    );
    const createStaff = vi.fn().mockResolvedValue({ id: "staff-1" });
    const mutation = withStaffInvitationFlow({ createStaff }).createStaff;

    await expect(
      mutation(
        null,
        {
          input: {
            fullName: "Nhân viên C",
            email: "failed@example.com",
            password: "Provided#123",
            staffBusinessContext: businessContext,
          },
        },
        context,
      ),
    ).rejects.toThrow("STAFF_INVITATION_EMAIL_NOT_SENT");

    expect(mocks.BrandMembership.deleteOne).toHaveBeenCalledWith({
      brandId: "brand-1",
      userId: "staff-1",
    });
    expect(mocks.Staff.deleteOne).toHaveBeenCalledWith({ _id: "staff-1" });
  });

  it("leaves phone-only staff on the existing create flow", async () => {
    const createStaff = vi.fn().mockResolvedValue({ id: "staff-phone" });
    const mutation = withStaffInvitationFlow({ createStaff }).createStaff;
    const args = {
      input: {
        fullName: "Nhân viên điện thoại",
        phone: "0901234567",
        staffBusinessContext: businessContext,
      },
    };

    const result = await mutation(null, args, context);

    expect(createStaff).toHaveBeenCalledWith(null, args, context, undefined);
    expect(mocks.Staff.findById).not.toHaveBeenCalled();
    expect(mocks.sendStaffInvitationEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "staff-phone" });
  });
});
