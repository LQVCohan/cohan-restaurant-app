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
  employeeCode: "ST-001",
  department: "service",
  roleName: "staff",
  role: { id: "role-server", slug: "server", name: "Phục vụ", department: "service" },
  positionTitle: "Nhân viên phục vụ",
  employmentStatus: "WORKING",
  employmentType: "full_time",
  workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
  baseSalary: 8000000,
};

const jwtLikeToken = (roleName) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, roleName }),
  ).toString("base64url");
  return `p1.${payload}.token`;
};

const schedulePermissions = {
  canPublish: true,
  canApplyAutoSchedule: true,
  canEditDraftSchedule: true,
  canMakePublishedChange: true,
  canChangeShiftTime: true,
  canAddStaffToShift: true,
  canRemoveStaffFromShift: true,
  canDeleteShiftGroup: true,
  requiresChangeReason: false,
  requiresEmployeeNotification: false,
  isReadOnly: false,
  canReopen: false,
};

const makeSchedulingPolicy = () => ({
  id: "schedule-policy-p1",
  restaurantId: TEST_RESTAURANT.id,
  shiftTemplates: [
    { key: "morning", label: "Ca sáng", startTime: "08:00", endTime: "16:00", enabled: true, allowCrossDay: false },
  ],
  laborRules: {
    respectWorkingDays: true,
    workingDaysRuleLevel: "warning",
    respectLeaveRequests: true,
    leaveConflictRuleLevel: "blocking",
    preventShiftOverlap: true,
    weeklyHoursCap: 40,
    recommendedWeeklyHoursCap: 40,
    weeklyHoursRuleLevel: "warning",
    maxShiftsPerDay: 2,
    maxShiftsPerDayRuleLevel: "warning",
    minRestHoursBetweenShifts: 8,
    minRestRuleLevel: "warning",
    maxConsecutiveWorkingDays: 6,
    hardMaxConsecutiveWorkingDays: 7,
    consecutiveDaysRuleLevel: "warning",
    allowManagerOverride: true,
    overrideRequiresReason: true,
  },
  scoringWeights: {},
  mandatoryShiftRoles: [],
  employmentTypePolicy: {},
  schedulingOperationalStartAt: null,
  firstWeekGracePolicy: { enabled: false, strategy: "none", appliedUntil: null },
  availabilityRegistrationPolicy: {
    availabilityRegistrationMode: "optional",
    availabilityOpenDayOffset: 7,
    availabilityOpenTime: "08:00",
    availabilityCloseDayOffset: 2,
    availabilityCloseTime: "20:00",
    enabled: false,
    targetEmploymentTypes: ["part_time", "seasonal"],
    openDayOfWeek: 1,
    openTime: "08:00",
    closeDayOfWeek: 5,
    closeTime: "20:00",
    publishTargetDayOfWeek: 6,
    publishTargetTime: "10:00",
    timezone: "Asia/Ho_Chi_Minh",
    allowFullTimeUnavailableException: true,
    lateChangeRequiresApproval: true,
    treatMissingPartTimeSubmissionAsUnavailable: false,
    autoCreateWindow: false,
  },
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z",
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
    headers: { ...corsHeadersFor(route), "content-type": "application/json" },
    body: JSON.stringify(data),
  });

const makeShift = (overrides = {}) => ({
  id: "shift-p1-created",
  employeeId: STAFF_USER.id,
  employeeName: STAFF_USER.fullName,
  restaurantId: TEST_RESTAURANT.id,
  shiftType: "MORNING",
  startTime: "2026-06-30T01:00:00.000Z",
  endTime: "2026-06-30T09:00:00.000Z",
  status: "scheduled",
  notes: "",
  ...overrides,
});

const installManagerScheduleMocks = async (page) => {
  const token = jwtLikeToken(MANAGER_USER.roleName);
  let shifts = [];

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
      case "RestaurantsByManager":
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
      case "StaffShifts":
        data = { staffShifts: shifts };
        break;
      case "SchedulePublication":
        data = {
          schedulePublication: {
            id: "schedule-publication-p1",
            status: "draft",
            effectiveStatus: "draft",
            publishedAt: null,
            publishedBy: null,
            activatedAt: null,
            lockedAt: null,
            lockedBy: null,
            lockReason: null,
            closedAt: null,
            closedBy: null,
            closeReason: null,
            reopenedAt: null,
            reopenedBy: null,
            reopenReason: null,
            reopenCount: 0,
            reminderSentAt: null,
            lastChangedAt: null,
            permissions: schedulePermissions,
          },
        };
        break;
      case "ScheduleAckSummary":
        data = {
          scheduleAcknowledgementSummary: {
            totalAssignedStaff: 0,
            acknowledgedCount: 0,
            pendingCount: 0,
            changedAfterAcknowledgementCount: 0,
          },
        };
        break;
      case "ShiftAcknowledgements":
        data = { shiftAcknowledgements: [] };
        break;
      case "SchedulingPolicy":
        data = { schedulingPolicy: makeSchedulingPolicy() };
        break;
      case "ScheduleAvailabilityWindows":
        data = { availabilityWindows: [] };
        break;
      case "ScheduleAvailabilitySubmissions":
        data = { staffAvailabilitySubmissions: [] };
        break;
      case "ManagerShiftAttendances":
        data = { managerShiftAttendances: [] };
        break;
      case "CreateStaffShifts": {
        const input = payload?.variables?.inputs?.[0] || {};
        const created = makeShift({
          employeeId: input.employeeId || STAFF_USER.id,
          restaurantId: input.restaurantId || TEST_RESTAURANT.id,
          shiftType: input.shiftType || "MORNING",
          startTime: input.startTime || "2026-06-30T01:00:00.000Z",
          endTime: input.endTime || "2026-06-30T09:00:00.000Z",
          notes: input.notes || "",
        });
        shifts = [created];
        data = {
          createStaffShifts: {
            successCount: 1,
            failedCount: 0,
            shifts: [created],
            errors: [],
          },
        };
        break;
      }
      case "AttendanceCorrectionRequests":
        data = { attendanceCorrectionRequests: [] };
        break;
      default:
        data = {};
    }

    return fulfillJson(route, { data });
  });
};

const openManagerSchedulePage = async (page) => {
  await page.goto("/manager#schedules");
  await expect(page.locator(".manager-layout")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lịch làm việc" })).toBeVisible();
};

test.describe("P1 manager schedule", () => {
  test("manager opens schedule workspace without hidden backend errors", async ({ page, backendGuard }) => {
    await installManagerScheduleMocks(page);
    await openManagerSchedulePage(page);

    await expect(page.getByRole("button", { name: /Tạo ca/ })).toBeVisible();
    await expect(page.getByText("Ca trong tuần")).toBeVisible();
    backendGuard.assertNoBackendErrors("manager schedule workspace");
  });

  test("manager opens create shift modal and selects staff without hidden backend errors", async ({ page, backendGuard }) => {
    await installManagerScheduleMocks(page);
    await openManagerSchedulePage(page);

    await page.getByRole("button", { name: /Tạo ca/ }).click();
    await expect(page.getByText("Thêm Ca Làm Việc Mới")).toBeVisible();

    const staffRow = page.locator(".staff-item", { hasText: STAFF_USER.fullName });
    await expect(staffRow).toBeVisible();
    backendGuard.clear();
    await staffRow.click();
    await expect(page.locator(".staff-item.selected", { hasText: STAFF_USER.fullName })).toBeVisible();
    backendGuard.assertNoBackendErrors("manager schedule create shift modal");
  });

  test("manager sees validation before creating a shift without selected staff", async ({ page, backendGuard }) => {
    await installManagerScheduleMocks(page);
    await openManagerSchedulePage(page);

    await page.getByRole("button", { name: /Tạo ca/ }).click();
    await expect(page.getByText("Thêm Ca Làm Việc Mới")).toBeVisible();

    backendGuard.clear();
    await page.getByRole("button", { name: "Lưu & Tạo Lịch" }).click();
    await expect(page.locator(".submit-error")).toContainText("Cần chọn ít nhất một nhân viên cho ca làm.");
    backendGuard.assertNoBackendErrors("manager schedule empty create shift validation");
  });

  test("manager creates a shift and sees it after refetch without hidden backend errors", async ({ page, backendGuard }) => {
    await installManagerScheduleMocks(page);
    await openManagerSchedulePage(page);

    await page.getByRole("button", { name: /Tạo ca/ }).click();
    await expect(page.getByText("Thêm Ca Làm Việc Mới")).toBeVisible();
    await page.locator(".staff-item", { hasText: STAFF_USER.fullName }).click();

    backendGuard.clear();
    await page.getByRole("button", { name: "Lưu & Tạo Lịch" }).click();
    await expect(page.getByRole("status")).toContainText("Đã thêm 1 nhân viên vào ca.");
    await expect(page.locator(".shift-card", { hasText: "1 nhân sự" })).toBeVisible();
    backendGuard.assertNoBackendErrors("manager schedule create shift success");
  });
});
