import { expect, test } from "./p1Fixtures.js";

const TEST_RESTAURANT = {
  id: "test-restaurant-active",
  name: "Cohan Smoke Bistro",
  avatar: "/default-restaurant.jpg",
};

const MANAGER_USER = {
  id: "test-manager-1",
  fullName: "Cohan Test Manager",
  username: "cohan_manager",
  email: "manager.test@cohan.local",
  phone: "0900000002",
  roleName: "manager",
  status: "active",
  emailVerified: true,
  phoneVerified: true,
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
  refRestaurants: [{ id: TEST_RESTAURANT.id, name: TEST_RESTAURANT.name }],
  employeeCode: "ST-001",
  positionTitle: "Nhân viên phục vụ",
  department: "service",
  employmentStatus: "WORKING",
};

const jwtLikeToken = (roleName) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, roleName }),
  ).toString("base64url");
  return `p1.${payload}.token`;
};

const makeAttendanceRecord = (overrides = {}) => ({
  id: "attendance-p1",
  employeeId: STAFF_USER.id,
  employeeName: STAFF_USER.fullName,
  employeeCode: STAFF_USER.employeeCode,
  employeeRole: STAFF_USER.positionTitle,
  employeeAvatar: null,
  restaurantId: TEST_RESTAURANT.id,
  workDate: "2026-06-26T00:00:00.000+07:00",
  shiftId: null,
  shiftType: "morning",
  plannedStartTime: "2026-06-26T01:00:00.000Z",
  plannedEndTime: "2026-06-26T09:00:00.000Z",
  actualCheckInAt: null,
  actualCheckOutAt: null,
  workedMinutes: 0,
  hours: 0,
  latenessMinutes: 0,
  earlyLeaveMinutes: 0,
  overtimeMinutes: 0,
  approvedOvertimeMinutes: 0,
  overtimeApprovalStatus: "not_required",
  overtimeReviewNote: "",
  overtimeReviewedBy: null,
  overtimeReviewedAt: null,
  status: "scheduled_absent",
  isOffSchedule: false,
  offScheduleApprovalStatus: "not_required",
  offScheduleReasonCategory: "other",
  offScheduleReason: "",
  offScheduleReviewedBy: null,
  offScheduleReviewedAt: null,
  offScheduleReviewNote: "",
  source: "quick",
  note: "",
  approved: true,
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z",
  ...overrides,
});

const corsHeadersFor = (route) => {
  const origin = route.request().headers().origin || "http://127.0.0.1:5173";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    vary: "Origin",
  };
};

const fulfillOptions = (route) =>
  route.fulfill({ status: 204, headers: corsHeadersFor(route), body: "" });

const fulfillJson = (route, data) =>
  route.fulfill({
    status: 200,
    headers: {
      ...corsHeadersFor(route),
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

const seedAccessToken = async (page, token) => {
  await page.goto("/");
  await page.evaluate((accessToken) => {
    window.sessionStorage.setItem("foodhub_access_token", accessToken);
  }, token);
};

const installManagerAttendanceMocks = async (page) => {
  let records = [];
  const token = jwtLikeToken(MANAGER_USER.roleName);

  await page.addInitScript((accessToken) => {
    window.sessionStorage.setItem("foodhub_access_token", accessToken);
  }, token);

  await page.route("**/api/auth/refresh**", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillOptions(route);
    return fulfillJson(route, { token, user: MANAGER_USER });
  });

  await page.route("**/api/auth/logout**", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillOptions(route);
    return route.fulfill({ status: 204, headers: corsHeadersFor(route), body: "" });
  });

  await page.route("**/graphql**", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillOptions(route);

    const payload = route.request().postDataJSON();
    const operationName = payload?.operationName || "";
    let data = {};

    switch (operationName) {
      case "Me":
        data = { me: MANAGER_USER };
        break;
      case "GetRestaurants":
      case "ManagerRestaurants":
        data = {
          refRestaurants: [],
          restaurantsByManager: {
            edges: [{ cursor: TEST_RESTAURANT.id, node: TEST_RESTAURANT }],
            pageInfo: { endCursor: TEST_RESTAURANT.id, hasNextPage: false },
          },
        };
        break;
      case "StaffList":
        data = { staffList: [STAFF_USER] };
        break;
      case "StaffRoleListForManagement":
        data = { roleList: [] };
        break;
      case "PendingLeaveRequests":
        data = { leaveRequests: [] };
        break;
      case "AttendancePageData":
        data = { staffList: [STAFF_USER], staffAttendanceRecords: records };
        break;
      case "AttendanceCorrectionRequests":
        data = { attendanceCorrectionRequests: [] };
        break;
      case "OffScheduleAttendances":
        data = { offScheduleAttendances: [] };
        break;
      case "UpsertAttendance": {
        const input = payload?.variables?.input || {};
        const checkedIn = makeAttendanceRecord({
          workDate: input.workDate || "2026-06-26T00:00:00.000+07:00",
          actualCheckInAt: "2026-06-26T02:00:00.000Z",
          note: input.note || "",
          status: "checked_in",
          updatedAt: "2026-06-26T02:00:00.000Z",
        });
        records = [checkedIn];
        data = { upsertStaffAttendance: checkedIn };
        break;
      }
      default:
        data = {};
    }

    return fulfillJson(route, { data });
  });

  return token;
};

const openManagerAttendancePage = async (page, token) => {
  await seedAccessToken(page, token);
  await page.goto("/manager");
  await expect(page.locator(".manager-layout")).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: { page: "staff", query: { staffPage: "attendance" }, source: "p1" },
      }),
    );
  });
  await expect(page.getByRole("heading", { name: "Quản lý chấm công" })).toBeVisible();
};

test.describe("P1 manager attendance", () => {
  test("manager quick check-in records attendance without hidden backend errors", async ({ page, backendGuard }) => {
    const token = await installManagerAttendanceMocks(page);
    await openManagerAttendancePage(page, token);

    await page.locator("select.quick-select").selectOption(STAFF_USER.id);
    await page.getByPlaceholder("VD: Quên thẻ, đổi ca, máy vân tay lỗi...").fill("P1 ghi nhận vào ca tại quầy");

    backendGuard.clear();
    await page.getByRole("button", { name: "Chấm công vào ca cho nhân viên đã chọn" }).click();
    await expect(page.getByRole("status")).toContainText("Đã lưu chấm công VÀO CA thành công");
    backendGuard.assertNoBackendErrors("manager quick attendance check-in");

    const row = page.locator(".attendance-table tbody tr", { hasText: STAFF_USER.fullName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Đang làm");
    await expect(row).toContainText("quick");
  });
});
