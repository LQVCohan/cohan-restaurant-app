import {
  BrandMembership,
  Staff,
} from "../../../models/index.js";
import { generateRandomPassword } from "../../../models/user.model.js";
import { sanitizeStaffPrivateProfile } from "../../../src/security/userDtos.js";
import { sendStaffInvitationEmail } from "../../../src/services/auth/staffInvitation.service.js";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => String(value || "").trim();

async function rollbackCreatedStaff({ brandId, staffId, cause }) {
  const cleanupErrors = [];

  try {
    if (brandId) await BrandMembership.deleteOne({ brandId, userId: staffId });
  } catch (error) {
    cleanupErrors.push(error);
  }

  try {
    await Staff.deleteOne({ _id: staffId });
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length) cause.cleanupErrors = cleanupErrors;
}

export function withStaffInvitationFlow(mutations = {}) {
  const createStaff = mutations.createStaff;
  if (typeof createStaff !== "function") return mutations;

  return {
    ...mutations,
    createStaff: async (parent, args = {}, ctx, info) => {
      const input = args.input || {};
      const email = normalizeEmail(input.email);

      // Phone-only staff keep the established verification path.
      if (!email) return createStaff(parent, args, ctx, info);

      const phone = normalizePhone(input.phone);
      const submittedPassword = String(input.password || "").trim();
      const initialPassword = submittedPassword || generateRandomPassword(12);
      const accountInput = { ...input, password: initialPassword, status: "pending" };

      // The legacy persistence resolver dispatches verification when contact fields
      // are present. Hold them until membership and restaurant role setup succeeds.
      delete accountInput.email;
      delete accountInput.phone;

      const created = await createStaff(
        parent,
        { ...args, input: accountInput },
        ctx,
        info,
      );
      const staffId = created?.id || created?._id;
      const brandId = input.staffBusinessContext?.brandId || null;
      const restaurantId = input.staffBusinessContext?.restaurantId || null;

      if (!staffId) throw new Error("Không xác định được tài khoản nhân viên vừa tạo");

      try {
        const staff = await Staff.findById(staffId);
        if (!staff || staff.userType !== "STAFF") {
          throw new Error("Không tìm thấy tài khoản nhân viên vừa tạo");
        }

        staff.email = email;
        if (phone) staff.phone = phone;
        staff.status = "pending";
        staff.emailVerified = false;
        staff.emailVerifiedAt = null;
        staff.verifiedAt = null;
        staff.emailVerifyToken = null;
        staff.emailVerifyTokenHash = null;
        staff.emailVerifyTokenExp = null;
        await staff.save();
        await staff.populate(["role", "refRestaurants"]);

        await sendStaffInvitationEmail({ staff, initialPassword });

        return sanitizeStaffPrivateProfile(staff, ctx, {
          restaurantId,
          skipAuthorization: true,
        });
      } catch (error) {
        await rollbackCreatedStaff({ brandId, staffId, cause: error });
        throw error;
      }
    },
  };
}

export default withStaffInvitationFlow;
