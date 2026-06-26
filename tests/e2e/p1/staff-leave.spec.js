import { expect, test } from "./p1Fixtures.js";

const TEST_RESTAURANT = {
  id: "test-restaurant-active",
  name: "Cohan Smoke Bistro",
};

const STAFF_USER = {
  id: "test-staff-1",
  fullName: "Cohan Test Staff",
  username: "cohan_staff",
  email: "staff.test@cohan.local",
  phone: "0900000003",
  roleName: "staff",
  userType: "STAFF",
  status: "active",
  emailVerified: true,
  phoneVerified: true,
  restaurantForStaff: TEST_RESTAURANT.id,
  employeeCode: "ST-001",
  positionTitle: "Nhân viên phục vụ",
  department: "service",
};

const jwtLikeToken = (roleName) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, roleName }),
  ).toString("base64url");
  return `p1.${payload}.token`;
};

const makeLeaveRequest = (overrides = {}) => ({
  id: "leave-p1-1",
  employeeId: STAFF_USER.id,
  employeeName: STAFF_USER.fullName,
  employeeCode: STAFF_USER.employeeCode,
  employeeRole: STAFF_USER.positionTitle,
  employeeAvatar: null,
  restaurantId: TEST_RESTAURANT.id,
  leaveType: "ANNUAL",
  startDate: "2026-07-01T00:00:00.000Z",
  endDate: "2026-07-01T00:00:00.000Z",
  startSession: "FULL",
  endSession: "FULL",
  requestedDays: 1,
  requestedHours: 8,
  reason: "P1 xin nghỉ phép tự phục vụ",
  status: "PENDING",
  approverId: null,
  approverName: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: "",
  replacementManagerId: null,
  replacementManagerName: null,
  replacementStatus: "NOT_REQUIRED",
  replacementConfirmedAt: null,
  replacementConfirmedBy: null,
  payrollFlags: {
    isPaidLeave: true,
    deductLeaveBalance: true,
    payrollCountable: true,
    halfDayFactor: 1,
    maternityTreatment: false,
    holidayTreatment: false,
    compensatoryTreatment: false,
    unpaidFactor: 0,
  },
  quotaImpact: {
    deductAnnualDays: 1,
    deductSickDays: 0,
    deductCompensatoryDays: 0,
    totalDeductDays: 1,
  },
  auditLogs: [],
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z",
  ...overrides,
});

const installStaffLeaveMocks = async (page) => {
  const createdRequests = [];

  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: jwtLikeToken(STAFF_USER.roleName), user: STAFF_USER }),
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/graphql", async (route) => {
    const payload = route.request().postDataJSON();
    const operationName = payload?.operationName || "";
    let data = {};

    switch (operationName) {
      case "Me":
        data = { me: STAFF_USER };
        break;
      case "StaffRestaurantBasic":
        data = { restaurant: TEST_RESTAURANT };
        break;
      case "StaffLeavePageData":
        data = { leaveRequests: createdRequests };
        break;
      case "CreateLeave": {
        const input = payload?.variables?.input || {};
        const created = makeLeaveRequest({
          id: "leave-p1-created",
          startDate: new Date(input.startDate).toISOString(),
          endDate: new Date(input.endDate).toISOString(),
          leaveType: input.leaveType || "ANNUAL",
          startSession: input.startSession || "FULL",
          endSession: input.endSession || "FULL",
          reason: input.reason || "",
        });
        createdRequests.unshift(created);
        data = {
          createLeaveRequest: {
            id: created.id,
            status: created.status,
            replacementStatus: created.replacementStatus,
          },
        };
        break;
      }
      default:
        data = {};
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
};

test.describe("P1 staff leave self-service", () => {
  test("staff creates a leave request without hidden backend errors", async ({ page, backendGuard }) => {
    await installStaffLeaveMocks(page);

    await page.goto("/staff/leave");
    await expect(page.getByRole("heading", { name: "Xin nghỉ phép trong vài bước" })).toBeVisible();

    await page.getByRole("button", { name: "+ Tạo đơn nghỉ phép" }).click();
    const modal = page.getByRole("dialog", { name: "Tạo đơn nghỉ phép" });
    await expect(modal).toBeVisible();

    await modal.locator("label.radio-card", { hasText: "Nghỉ năm" }).click();
    await expect(modal.locator('input[name="leaveType"][value="ANNUAL"]')).toBeChecked();
    await modal.locator('input[name="startDate"]').fill("2026-07-01");
    await modal.locator('input[name="endDate"]').fill("2026-07-01");
    await modal.locator('textarea[name="reason"]').fill("P1 xin nghỉ phép tự phục vụ");

    backendGuard.clear();
    const dialogPromise = page.waitForEvent("dialog");
    await modal.getByRole("button", { name: "Gửi đơn" }).click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain("Đã tạo đơn nghỉ phép");
    await dialog.accept();
    backendGuard.assertNoBackendErrors("staff leave create request");

    await expect(modal).toBeHidden();
    await expect(page.getByText("P1 xin nghỉ phép tự phục vụ")).toBeVisible();
  });
});
