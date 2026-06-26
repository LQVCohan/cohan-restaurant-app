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

const REQUESTING_MANAGER = {
  id: "test-manager-requester-2",
  fullName: "Cohan Requesting Manager",
  employeeCode: "MG-002",
  positionTitle: "Quản lý ca",
};

const jwtLikeToken = (roleName) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, roleName }),
  ).toString("base64url");
  return `p1.${payload}.token`;
};

const makeLeaveRequest = (overrides = {}) => ({
  id: "leave-review-p1",
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
  reason: "P1 manager review leave request",
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

const makeManagerReplacementRequest = (overrides = {}) => makeLeaveRequest({
  id: "leave-replacement-p1",
  employeeId: REQUESTING_MANAGER.id,
  employeeName: REQUESTING_MANAGER.fullName,
  employeeCode: REQUESTING_MANAGER.employeeCode,
  employeeRole: REQUESTING_MANAGER.positionTitle,
  reason: "P1 manager needs replacement confirmation",
  status: "PENDING_REPLACEMENT_CONFIRMATION",
  replacementManagerId: MANAGER_USER.id,
  replacementManagerName: MANAGER_USER.fullName,
  replacementStatus: "PENDING",
  ...overrides,
});

const filterLeaveRequests = (requests, filter = {}) => {
  const expectedStatus = filter?.status && filter.status !== "all" ? filter.status : null;
  return requests.filter((request) => {
    if (filter?.restaurantId && request.restaurantId !== filter.restaurantId) return false;
    if (expectedStatus && request.status !== expectedStatus) return false;
    return true;
  });
};

const installManagerLeaveMocks = async (page, initialRequests) => {
  let requests = initialRequests.map((request) => ({ ...request }));

  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: jwtLikeToken(MANAGER_USER.roleName), user: MANAGER_USER }),
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/graphql", async (route) => {
    const payload = route.request().postDataJSON();
    const operationName = payload?.operationName || "";
    const variables = payload?.variables || {};
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
      case "LeavePageData":
        data = {
          staffList: [STAFF_USER],
          leaveRequests: filterLeaveRequests(requests, variables.filter),
        };
        break;
      case "ApproveLeave": {
        const requestId = variables.requestId;
        requests = requests.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: "APPROVED",
                approvedAt: "2026-06-26T10:00:00.000Z",
                approverId: MANAGER_USER.id,
                approverName: MANAGER_USER.fullName,
                rejectedAt: null,
                rejectionReason: "",
              }
            : request,
        );
        data = { approveLeaveRequest: requests.find((request) => request.id === requestId) };
        break;
      }
      case "RejectLeave": {
        const requestId = variables.requestId;
        const reason = variables.reason || "Không phù hợp lịch làm việc";
        requests = requests.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: "REJECTED",
                rejectedAt: "2026-06-26T10:05:00.000Z",
                rejectionReason: reason,
                approverId: MANAGER_USER.id,
                approverName: MANAGER_USER.fullName,
                approvedAt: null,
              }
            : request,
        );
        data = { rejectLeaveRequest: requests.find((request) => request.id === requestId) };
        break;
      }
      case "ConfirmReplacement": {
        const requestId = variables.requestId;
        requests = requests.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: "PENDING",
                replacementStatus: "CONFIRMED",
                replacementConfirmedAt: "2026-06-26T10:10:00.000Z",
                replacementConfirmedBy: MANAGER_USER.id,
              }
            : request,
        );
        data = { confirmReplacementLeaveRequest: requests.find((request) => request.id === requestId) };
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

const openManagerLeavePage = async (page) => {
  await page.goto("/manager#staff");
  await expect(page.locator(".staff-page-container")).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("manager:navigation-query", {
        detail: { page: "staff", query: { staffPage: "leave" }, source: "p1" },
      }),
    );
  });
  await expect(page.locator(".leave-list-container")).toBeVisible();
  await expect(page.getByText(STAFF_USER.fullName).or(page.getByText(REQUESTING_MANAGER.fullName))).toBeVisible();
};

test.describe("P1 manager leave review", () => {
  test("manager approves a pending leave request without hidden backend errors", async ({ page, backendGuard }) => {
    await installManagerLeaveMocks(page, [makeLeaveRequest({ id: "leave-approve-p1" })]);
    await openManagerLeavePage(page);

    const row = page.locator("tr.hover-row", { hasText: STAFF_USER.fullName });
    await expect(row).toContainText("Chờ duyệt");

    backendGuard.clear();
    const dialogPromise = page.waitForEvent("dialog");
    await row.locator(".btn-icon.approve").click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain("Duyệt đơn thành công");
    await dialog.accept();
    backendGuard.assertNoBackendErrors("manager approve leave request");

    await expect(row).toContainText("Đã duyệt");
  });

  test("manager rejects a pending leave request without hidden backend errors", async ({ page, backendGuard }) => {
    await installManagerLeaveMocks(page, [makeLeaveRequest({ id: "leave-reject-p1" })]);
    await openManagerLeavePage(page);

    const row = page.locator("tr.hover-row", { hasText: STAFF_USER.fullName });
    await expect(row).toContainText("Chờ duyệt");

    backendGuard.clear();
    const dialogMessages = [];
    const handleDialog = async (dialog) => {
      dialogMessages.push(dialog.message());
      if (dialog.type() === "prompt") {
        await dialog.accept("P1 không phù hợp lịch làm việc");
        return;
      }
      await dialog.accept();
    };
    page.on("dialog", handleDialog);
    try {
      await row.locator(".btn-icon.reject").click();
      await expect.poll(() => dialogMessages.some((message) => message.includes("Lý do từ chối"))).toBe(true);
      await expect.poll(() => dialogMessages.some((message) => message.includes("Từ chối đơn thành công"))).toBe(true);
    } finally {
      page.off("dialog", handleDialog);
    }
    backendGuard.assertNoBackendErrors("manager reject leave request");

    await expect(row).toContainText("Từ chối");
  });

  test("assigned manager confirms replacement without hidden backend errors", async ({ page, backendGuard }) => {
    await installManagerLeaveMocks(page, [makeManagerReplacementRequest()]);
    await openManagerLeavePage(page);

    const row = page.locator("tr.hover-row", { hasText: REQUESTING_MANAGER.fullName });
    await expect(row).toContainText("Chờ quản lý thay thế xác nhận");

    backendGuard.clear();
    const dialogPromise = page.waitForEvent("dialog");
    await row.locator('button[title="Xác nhận thay thế"]').click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain("Đã xác nhận thay thế thành công");
    await dialog.accept();
    backendGuard.assertNoBackendErrors("manager confirm replacement leave request");

    await expect(row).toContainText("Chờ duyệt");
  });

  test("assigned manager confirms replacement then approves leave without hidden backend errors", async ({ page, backendGuard }) => {
    await installManagerLeaveMocks(page, [makeManagerReplacementRequest({ id: "leave-replacement-approve-p1" })]);
    await openManagerLeavePage(page);

    const row = page.locator("tr.hover-row", { hasText: REQUESTING_MANAGER.fullName });
    await expect(row).toContainText("Chờ quản lý thay thế xác nhận");

    backendGuard.clear();
    const confirmDialogPromise = page.waitForEvent("dialog");
    await row.locator('button[title="Xác nhận thay thế"]').click();
    const confirmDialog = await confirmDialogPromise;
    expect(confirmDialog.message()).toContain("Đã xác nhận thay thế thành công");
    await confirmDialog.accept();
    backendGuard.assertNoBackendErrors("manager confirm replacement before approval");
    await expect(row).toContainText("Chờ duyệt");

    backendGuard.clear();
    const approveDialogPromise = page.waitForEvent("dialog");
    await row.locator(".btn-icon.approve").click();
    const approveDialog = await approveDialogPromise;
    expect(approveDialog.message()).toContain("Duyệt đơn thành công");
    await approveDialog.accept();
    backendGuard.assertNoBackendErrors("manager approve confirmed replacement leave request");

    await expect(row).toContainText("Đã duyệt");
  });

  test("assigned manager confirms replacement then rejects leave without hidden backend errors", async ({ page, backendGuard }) => {
    await installManagerLeaveMocks(page, [makeManagerReplacementRequest({ id: "leave-replacement-reject-p1" })]);
    await openManagerLeavePage(page);

    const row = page.locator("tr.hover-row", { hasText: REQUESTING_MANAGER.fullName });
    await expect(row).toContainText("Chờ quản lý thay thế xác nhận");

    backendGuard.clear();
    const confirmDialogPromise = page.waitForEvent("dialog");
    await row.locator('button[title="Xác nhận thay thế"]').click();
    const confirmDialog = await confirmDialogPromise;
    expect(confirmDialog.message()).toContain("Đã xác nhận thay thế thành công");
    await confirmDialog.accept();
    backendGuard.assertNoBackendErrors("manager confirm replacement before rejection");
    await expect(row).toContainText("Chờ duyệt");

    backendGuard.clear();
    const dialogMessages = [];
    const handleDialog = async (dialog) => {
      dialogMessages.push(dialog.message());
      if (dialog.type() === "prompt") {
        await dialog.accept("P1 từ chối sau khi xác nhận thay thế");
        return;
      }
      await dialog.accept();
    };
    page.on("dialog", handleDialog);
    try {
      await row.locator(".btn-icon.reject").click();
      await expect.poll(() => dialogMessages.some((message) => message.includes("Lý do từ chối"))).toBe(true);
      await expect.poll(() => dialogMessages.some((message) => message.includes("Từ chối đơn thành công"))).toBe(true);
    } finally {
      page.off("dialog", handleDialog);
    }
    backendGuard.assertNoBackendErrors("manager reject confirmed replacement leave request");

    await expect(row).toContainText("Từ chối");
  });
});
