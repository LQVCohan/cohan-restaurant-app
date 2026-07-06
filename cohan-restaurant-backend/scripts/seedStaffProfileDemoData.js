import "dotenv/config.js";
import mongoose from "mongoose";
import { Staff, User } from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const TAG = "[demo-staff-profile-2026-07]";
const VERIFIED_AT = new Date("2026-06-15T02:00:00.000Z");

const PROFILES = [
  ["staff.bartender.demo@cohan.local", "DEMO-BAR-01", "0326000001", "Nhân viên pha chế", "bar", "part_time", "evening", "2025-08-18", 8000000, "12 Đường Nguyễn Huệ", "Phường Bến Nghé", "Quận 1"],
  ["staff.cashier.demo@cohan.local", "PERF-CSH-01", "0326000002", "Thu ngân", "cashier", "part_time", "morning", "2025-09-01", 8500000, "28 Đường Lê Lợi", "Phường Bến Thành", "Quận 1"],
  ["staff.chef.demo@cohan.local", "PERF-CHEF-01", "0326000003", "Bếp trưởng", "kitchen", "full_time", "morning", "2025-03-10", 15000000, "45 Đường Nguyễn Trãi", "Phường Bến Thành", "Quận 1"],
  ["staff.cleaner.demo@cohan.local", "DEMO-CLN-01", "0326000004", "Nhân viên vệ sinh", "cleaning", "part_time", "rotating", "2025-10-06", 6500000, "19 Đường Cô Giang", "Phường Cô Giang", "Quận 1"],
  ["staff.cook.demo@cohan.local", "DEMO-COOK-01", "0326000005", "Nhân viên bếp", "kitchen", "full_time", "morning", "2025-05-12", 10000000, "33 Đường Trần Hưng Đạo", "Phường Cầu Kho", "Quận 1"],
  ["staff.host.demo@cohan.local", "DEMO-HOST-01", "0326000006", "Đón khách / điều phối", "service", "part_time", "evening", "2025-11-03", 7500000, "56 Đường Nguyễn Thái Học", "Phường Cầu Ông Lãnh", "Quận 1"],
  ["staff.kitchenhelper.demo@cohan.local", "PERF-KH-01", "0326000007", "Phụ bếp", "kitchen", "part_time", "afternoon", "2025-09-15", 7500000, "72 Đường Nguyễn Cư Trinh", "Phường Nguyễn Cư Trinh", "Quận 1"],
  ["staff.server.demo@cohan.local", "PERF-SRV-01", "0326000008", "Phục vụ", "service", "full_time", "morning", "2025-04-07", 8000000, "91 Đường Đề Thám", "Phường Cô Giang", "Quận 1"],
  ["staff.shipper.demo@cohan.local", "DEMO-SHP-01", "0326000009", "Nhân viên giao hàng", "delivery", "part_time", "rotating", "2025-12-01", 8500000, "15 Đường Võ Văn Kiệt", "Phường Cô Giang", "Quận 1"],
  ["staff.exception.demo@cohan.local", "PERF-EXC-01", "0326000010", "Nhân viên bếp", "kitchen", "part_time", "afternoon", "2026-01-05", 7000000, "24 Đường Nguyễn Văn Cừ", "Phường Cầu Kho", "Quận 1"],
  ["staff.fulltime.demo@cohan.local", "DEMO-FT-01", "0326000011", "Nhân viên phục vụ", "service", "full_time", "full_day", "2025-06-02", 8500000, "38 Đường Phạm Ngũ Lão", "Phường Phạm Ngũ Lão", "Quận 1"],
  ["staff.parttime.demo@cohan.local", "PERF-APL-01", "0326000012", "Thu ngân", "cashier", "part_time", "evening", "2026-02-02", 5000000, "67 Đường Bùi Viện", "Phường Phạm Ngũ Lão", "Quận 1"],
  ["staff.storekeeper.demo@cohan.local", "DEMO-STK-01", "0326000013", "Thủ kho", "inventory", "full_time", "morning", "2025-07-14", 9000000, "105 Đường Nguyễn Thị Minh Khai", "Phường Bến Thành", "Quận 1"],
  ["staff.supervisor.demo@cohan.local", "PERF-SUP-01", "0326000014", "Giám sát phục vụ", "service", "full_time", "full_day", "2025-02-17", 12000000, "18 Đường Pasteur", "Phường Bến Nghé", "Quận 1"],
].map(([email, employeeCode, phone, positionTitle, department, employmentType, shiftType, dateJoined, baseSalary, line1, ward, district]) => ({
  email,
  employeeCode,
  phone,
  positionTitle,
  department,
  employmentType,
  shiftType,
  dateJoined: new Date(`${dateJoined}T00:00:00.000Z`),
  baseSalary,
  address: { line1, ward, district, city: "TP. Hồ Chí Minh", country: "Việt Nam" },
}));

async function assertNoConflicts() {
  const emails = PROFILES.map((profile) => profile.email);
  const phoneByEmail = new Map(PROFILES.map((profile) => [profile.email, profile.phone]));
  const codeByEmail = new Map(PROFILES.map((profile) => [profile.email, profile.employeeCode]));

  const [phoneOwners, codeOwners] = await Promise.all([
    User.find({ phone: { $in: PROFILES.map((profile) => profile.phone) } })
      .select("email phone")
      .lean(),
    Staff.find({ employeeCode: { $in: PROFILES.map((profile) => profile.employeeCode) } })
      .select("email employeeCode")
      .lean(),
  ]);

  const phoneConflict = phoneOwners.find(
    (owner) => !emails.includes(owner.email) || phoneByEmail.get(owner.email) !== owner.phone,
  );
  if (phoneConflict) {
    throw new Error(`DEMO_PROFILE_PHONE_CONFLICT: ${phoneConflict.phone} (${phoneConflict.email || "unknown"})`);
  }

  const codeConflict = codeOwners.find(
    (owner) => !emails.includes(owner.email) || codeByEmail.get(owner.email) !== owner.employeeCode,
  );
  if (codeConflict) {
    throw new Error(`DEMO_PROFILE_EMPLOYEE_CODE_CONFLICT: ${codeConflict.employeeCode} (${codeConflict.email || "unknown"})`);
  }
}

async function main() {
  assertDemoScriptAllowed("seedStaffProfileDemoData.js");
  if (!mongoose.isValidObjectId(RESTAURANT_ID)) throw new Error("DEMO_RESTAURANT_ID_INVALID");

  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "foodhub",
  });

  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const staff = await Staff.find({
    email: { $in: PROFILES.map((profile) => profile.email) },
    restaurantForStaff: restaurantId,
    userType: "STAFF",
    deletedAt: null,
  })
    .select("_id email")
    .lean();
  const staffByEmail = new Map(staff.map((item) => [item.email, item]));
  const missing = PROFILES.map((profile) => profile.email).filter((email) => !staffByEmail.has(email));
  if (missing.length) throw new Error(`DEMO_STAFF_ACCOUNTS_MISSING: ${missing.join(", ")}`);

  await assertNoConflicts();

  for (const profile of PROFILES) {
    const addressText = [profile.address.line1, profile.address.ward, profile.address.district, profile.address.city]
      .filter(Boolean)
      .join(", ");
    await Staff.updateOne(
      { _id: staffByEmail.get(profile.email)._id, restaurantForStaff: restaurantId },
      {
        $set: {
          phone: profile.phone,
          employeeCode: profile.employeeCode,
          positionTitle: profile.positionTitle,
          department: profile.department,
          employmentType: profile.employmentType,
          employmentStatus: "working",
          shiftType: profile.shiftType,
          dateJoined: profile.dateJoined,
          officialStartDate: profile.dateJoined,
          contractStartDate: profile.dateJoined,
          contractType: profile.employmentType === "full_time" ? "indefinite" : "fixed_term",
          baseSalary: profile.baseSalary,
          salaryType: "monthly",
          address: profile.address,
          permanentAddress: addressText,
          temporaryAddress: addressText,
          emailVerified: true,
          emailVerifiedAt: VERIFIED_AT,
          phoneVerified: true,
          phoneVerifiedAt: VERIFIED_AT,
          verifiedAt: VERIFIED_AT,
          verificationLastChannel: "both",
          verificationLastStatus: "verified",
          status: "active",
          noteInternal: `${TAG} complete manager staff profile`,
        },
      },
      { runValidators: true },
    );
  }

  console.log(`Demo staff profiles completed: ${PROFILES.length}`);
}

main()
  .catch((error) => {
    console.error("[seed:demo:staff-profiles] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect().catch(() => {}));
