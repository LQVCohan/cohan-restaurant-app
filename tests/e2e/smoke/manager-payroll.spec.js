import { expect, test } from "@playwright/test";
import { TEST_RESTAURANT, TEST_USERS } from "./fixtures.js";

const jwtLikeToken = (roleName) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, roleName }),
  ).toString("base64url");
  return `smoke.${payload}.token`;
};

const PAYROLL_PERIOD = {
  id: "payroll-period-current",
  name: "Kỳ hiện tại / gần nhất",
  restaurantId: TEST_RESTAURANT.id,
  startDate: "2026-05-25T00:00:00.000Z",
  endDate: "2026-06-24T23:59:59.999Z",
  status: "draft",
  finalizedAt: null,
  lockedAt: null,
  paidAt: null,
  stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
};

const PAYROLL_SETTINGS = {
  restaurantId: TEST_RESTAURANT.id,
  currentPayrollPeriodId: PAYROLL_PERIOD.id,
  standardWorkDaysPerMonth: 26,
  standardHoursPerDay: 8,
  overtimeMultiplierWeekday: 1.5,
  overtimeMultiplierWeekend: 2,
  overtimeMultiplierHoliday: 3,
  latenessPenaltyPerMinute: 0,
  earlyLeavePenaltyPerMinute: 0,
  unpaidLeaveDeductionPerDay: 0,
  defaultAllowance: 0,
  allowPaidLeaveInWorkDays: true,
  defaultBonus: 0,
  defaultDeduction: 0,
  weekendDays: [0],
  holidayDates: [],
  nightShiftStart: "22:00",
  nightShiftEnd: "06:00",
  nightShiftAllowanceRate: 0,
  enablePersonalIncomeTax: false,
  personalIncomeTaxRate: 0,
  personalIncomeTaxFreeThreshold: 11000000,
  notes: "",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const PAYROLL_READINESS = {
  periodId: PAYROLL_PERIOD.id,
  restaurantId: TEST_RESTAURANT.id,
  status: "draft",
  readyToFinalize: false,
  blockingCount: 0,
  warningCount: 0,
  sections: {
    schedule: {
      status: "ready",
      blockingCount: 0,
      warningCount: 0,
      metrics: {},
      issues: [],
    },
    attendance: {
      status: "ready",
      blockingCount: 0,
      warningCount: 0,
      metrics: {},
      issues: [],
    },
    approvals: {
      status: "ready",
      blockingCount: 0,
      warningCount: 0,
      metrics: {},
      issues: [],
    },
    payroll: {
      status: "ready",
      blockingCount: 0,
      warningCount: 0,
      metrics: {},
      issues: [],
    },
  },
  issues: [],
};

const PAYROLL_ITEMS = Array.from({ length: 14 }, (_, index) => {
  const number = index + 1;
  return {
    id: `payroll-runtime-${number}`,
    payrollItemId: null,
    name: `Demo Staff ${String(number).padStart(2, "0")}`,
    code: `DS-${String(number).padStart(2, "0")}`,
    role: number % 2 ? "Server" : "Cashier",
    department:
      number % 3 === 0 ? "Kitchen" : number % 3 === 1 ? "Service" : "Cashier",
    avatar: null,
    baseSalary: 0,
    workDays: 0,
    actualWorkDays: 0,
    totalHours: 0,
    hourlyRate: 0,
    allowance: 0,
    bonus: 0,
    otherAddition: 0,
    overtime: 0,
    overtimeNormal: 0,
    overtimeWeekend: 0,
    overtimeHoliday: 0,
    nightShiftExtra: 0,
    overtimeHours: 0,
    overtimeNormalHours: 0,
    overtimeWeekendHours: 0,
    overtimeHolidayHours: 0,
    nightHours: 0,
    overtimeNightHours: 0,
    deduction: 0,
    otherDeduction: 0,
    advance: 0,
    insuranceSocial: 0,
    insuranceHealth: 0,
    insuranceUnemployment: 0,
    insuranceTotal: 0,
    insuranceEmployerTotal: 0,
    personalIncomeTax: 0,
    grossIncome: 0,
    coefficient: 1,
    totalIncome: 0,
    totalDeduction: 0,
    netSalary: 0,
    policyCode: null,
    policyEffectiveFrom: null,
    regionCode: null,
    minimumWageMonthly: 0,
    minimumWageHourly: 0,
    minimumWageViolation: false,
    insuranceEligible: false,
    warningMessages: [],
    status: "draft",
    paidAmount: 0,
    remainingAmount: 0,
    paidAt: null,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unpaidLeaveDays: 0,
    paidLeaveDays: 0,
    scheduleShiftCount: 0,
    manualAdjustmentTotal: 0,
    periodId: null,
  };
});

const buildPayrollOverviewPage = ({
  offset = 0,
  limit = 8,
  search,
  status,
} = {}) => {
  const keyword = String(search || "")
    .trim()
    .toLowerCase();
  const filtered = PAYROLL_ITEMS.filter((item) => {
    const matchesStatus = !status || item.status === status;
    const haystack = [item.name, item.code, item.department, item.role]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !keyword || haystack.includes(keyword);
    return matchesStatus && matchesSearch;
  });
  const safeLimit = Math.max(1, Number(limit || 8));
  const safeOffset = Math.max(0, Number(offset || 0));
  const pageItems = filtered.slice(safeOffset, safeOffset + safeLimit);
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));

  return {
    stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
    pageInfo: {
      totalCount: filtered.length,
      limit: safeLimit,
      offset: safeOffset,
      page: Math.min(totalPages, Math.floor(safeOffset / safeLimit) + 1),
      pageSize: pageItems.length,
      totalPages,
      hasMore: safeOffset + safeLimit < filtered.length,
    },
    items: pageItems,
  };
};

const installPayrollMocks = async (page) => {
  const authUser = {
    ...TEST_USERS.manager,
    restaurantForStaff: TEST_RESTAURANT.id,
  };

  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        token: jwtLikeToken(authUser.roleName),
        user: authUser,
      }),
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
      case "PayrollContext":
        data = { me: authUser };
        break;
      case "GetRestaurants":
      case "AuthBusinessContext":
      case "ScopedRestaurants":
        data = {
          refRestaurants: [],
          scopedRestaurants: {
            edges: [{ cursor: TEST_RESTAURANT.id, node: TEST_RESTAURANT }],
            pageInfo: {
              endCursor: TEST_RESTAURANT.id,
              hasNextPage: false,
            },
          },
        };
        break;
      case "PayrollPeriods":
        data = { payrollPeriods: [PAYROLL_PERIOD] };
        break;
      case "PayrollSettings":
        data = { payrollSettings: PAYROLL_SETTINGS };
        break;
      case "PayrollPeriodDetail":
        data = {
          payrollPeriodDetail: {
            period: PAYROLL_PERIOD,
            settings: PAYROLL_SETTINGS,
            stats: PAYROLL_PERIOD.stats,
            items: [],
          },
        };
        break;
      case "ValidatePayrollPeriod":
        data = {
          validatePayrollPeriod: {
            periodId: variables.periodId || PAYROLL_PERIOD.id,
            status: "ready",
            errorCount: 0,
            warningCount: 0,
            issues: [],
          },
        };
        break;
      case "PayrollReadiness":
        data = {
          payrollReadiness: {
            ...PAYROLL_READINESS,
            periodId: variables.periodId || PAYROLL_PERIOD.id,
          },
        };
        break;
      case "PayrollPayments":
        data = { payrollPayments: [] };
        break;
      case "PayrollExportRows":
        data = { payrollExportRows: [] };
        break;
      case "StaffPayrollOverview":
        data = {
          staffPayrollOverview: {
            stats: {
              totalPayroll: 0,
              paidAmount: 0,
              remaining: 0,
              progress: 0,
            },
            items: PAYROLL_ITEMS,
          },
        };
        break;
      case "PayrollOverviewPage":
        data = {
          staffPayrollOverview: buildPayrollOverviewPage(variables),
        };
        break;
      case "CreatePayrollPeriod":
        data = {
          createPayrollPeriod: {
            id: "payroll-period-created",
            status: "draft",
            startDate:
              variables.input?.startDate || PAYROLL_PERIOD.startDate,
            endDate: variables.input?.endDate || PAYROLL_PERIOD.endDate,
            name: variables.input?.name || "Kỳ lương smoke test",
          },
        };
        break;
      case "RecalculatePayrollPeriod":
        data = {
          recalculatePayrollPeriod: {
            period: { id: variables.periodId, status: "draft" },
          },
        };
        break;
      case "FinalizePayrollPeriod":
        data = {
          finalizePayrollPeriod: {
            id: variables.periodId,
            status: "finalized",
            finalizedAt: "2026-06-24T10:00:00.000Z",
          },
        };
        break;
      case "LockPayrollPeriod":
        data = {
          lockPayrollPeriod: {
            id: variables.periodId,
            status: "locked",
            lockedAt: "2026-06-24T10:05:00.000Z",
          },
        };
        break;
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

const collectPageErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error));
  return errors;
};

test.describe("manager payroll page", () => {
  test("shows runtime payroll data, backend pagination and create-period success", async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    await installPayrollMocks(page);

    await page.goto("/manager#payroll");
    await expect(page.locator(".payroll-page-compact")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Quản lý lương" }),
    ).toBeVisible();
    await expect(page.getByText("Kỳ lương chính thức")).toBeVisible();
    await expect(page.getByText("14 nhân viên phù hợp")).toBeVisible();
    await expect(page.getByText(/Hiển thị 1-8/)).toBeVisible();
    await expect(page.getByText(/Trang 1\/2/)).toBeVisible();
    await expect(page.getByText("Demo Staff 01")).toBeVisible();

    await page.getByRole("button", { name: "Sau" }).click();
    await expect(page.getByText(/Hiển thị 9-14/)).toBeVisible();
    await expect(page.getByText(/Trang 2\/2/)).toBeVisible();
    await expect(page.getByText("Demo Staff 09")).toBeVisible();

    await page.getByRole("button", { name: /Tạo kỳ lương/ }).click();
    await expect(page.getByText("Đã tạo kỳ lương chính thức.")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("sends payroll search and status filters through the backend page query", async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page);
    const payrollPageRequests = [];
    await installPayrollMocks(page);
    page.on("request", (request) => {
      if (!request.url().includes("/graphql")) return;
      const payload = request.postDataJSON();
      if (payload?.operationName === "PayrollOverviewPage") {
        payrollPageRequests.push(payload.variables || {});
      }
    });

    await page.goto("/manager#payroll");
    await expect(page.getByText("Demo Staff 01")).toBeVisible();

    await page
      .getByPlaceholder("Tìm nhân viên, mã, bộ phận...")
      .fill("cashier");
    await page.getByRole("button", { name: "Nháp" }).click();

    await expect
      .poll(() => payrollPageRequests.at(-1))
      .toMatchObject({
        search: "cashier",
        status: "draft",
        limit: 8,
        offset: 0,
      });

    expect(pageErrors).toEqual([]);
  });
});
