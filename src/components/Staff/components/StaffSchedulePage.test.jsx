import React from "react";
import { describe, it, expect } from "vitest";
import { gql } from "@apollo/client";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StaffLayout from "@/layouts/StaffLayout";
import StaffSchedulePage from "./StaffSchedulePage";
import { AuthContext } from "@/context/AuthContext";
const GET_AVAILABILITY_WINDOWS = gql`
  query StaffAvailabilityWindows(
    $restaurantId: ID!
    $from: DateTime
    $to: DateTime
  ) {
    availabilityWindows(restaurantId: $restaurantId, from: $from, to: $to) {
      id
      periodStart
      periodEnd
      openAt
      closeAt
      status
      effectiveStatus
      registrationMode
      targetEmploymentTypes
      allowFullTimeUnavailableException
      lateChangeRequiresApproval
    }
  }
`;

const GET_STAFF_SHIFTS = gql`
  query StaffMyShifts(
    $restaurantId: ID
    $employeeId: ID
    $startDate: DateTime
    $endDate: DateTime
  ) {
    staffShifts(
      restaurantId: $restaurantId
      employeeId: $employeeId
      startDate: $startDate
      endDate: $endDate
      limit: 1000
    ) {
      id
      employeeId
      shiftType
      startTime
      endTime
      status
      notes
      restaurantId
    }
  }
`;

const GET_SUBMISSION = gql`
  query StaffAvailabilitySubmission($windowId: ID!, $employeeId: ID!) {
    staffAvailabilitySubmission(windowId: $windowId, employeeId: $employeeId) {
      id
      status
      submissionType
      reviewNote
      pendingSubmittedAt
      pendingSlots {
        date
        shiftType
        status
        note
      }
      slots {
        date
        shiftType
        status
        note
      }
    }
  }
`;

const GET_MY_SCHEDULE_ACK = gql`
  query MyScheduleAck(
    $restaurantId: ID!
    $periodStart: DateTime!
    $periodEnd: DateTime!
  ) {
    myScheduleAcknowledgement(
      restaurantId: $restaurantId
      periodStart: $periodStart
      periodEnd: $periodEnd
    ) {
      id
      status
      acknowledgedAt
      changedAfterAcknowledgement
    }
  }
`;

const GET_SCHEDULING_POLICY = gql`
  query StaffSchedulingPolicy($restaurantId: ID!) {
    schedulingPolicy(restaurantId: $restaurantId) {
      shiftTemplates {
        key
        label
        startTime
        endTime
        enabled
        allowCrossDay
      }
      employmentTypePolicy {
        part_time {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          requireAvailability
        }
        seasonal {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          requireAvailability
        }
      }
    }
  }
`;

const GET_MY_SHIFT_ACKS = gql`
  query MyShiftAcknowledgements($restaurantId: ID, $periodStart: DateTime, $periodEnd: DateTime) {
    myShiftAcknowledgements(restaurantId: $restaurantId, periodStart: $periodStart, periodEnd: $periodEnd) {
      id
      shiftId
      status
      declineClassification
      reasonCategory
      reason
    }
  }
`;
const MY_SHIFT_ATTENDANCES = gql`
  query MyShiftAttendances($periodStart: DateTime, $periodEnd: DateTime) {
    myShiftAttendances(periodStart: $periodStart, periodEnd: $periodEnd) {
      id
      shiftId
      checkInAt
      checkOutAt
      status
    }
  }
`;

const RESPOND_SHIFT_ACK = gql`
  mutation RespondShiftAcknowledgement(
    $input: RespondShiftAcknowledgementInput!
  ) {
    respondShiftAcknowledgement(input: $input) {
      id
      status
      declineClassification
    }
  }
`;

const anyIsoDateRange = (variables, startKey, endKey) =>
  typeof variables?.[startKey] === "string" &&
  typeof variables?.[endKey] === "string" &&
  variables[startKey].endsWith("Z") &&
  variables[endKey].endsWith("Z");

const matchRestaurantWindowVars =
  (restaurantId = "r1") =>
  (variables) =>
    variables?.restaurantId === restaurantId &&
    anyIsoDateRange(variables, "from", "to");

const matchRestaurantPeriodVars =
  (restaurantId = "r1") =>
  (variables) =>
    variables?.restaurantId === restaurantId &&
    anyIsoDateRange(variables, "periodStart", "periodEnd");

const matchStaffShiftVars =
  ({ restaurantId = "r1", employeeId = "e1" } = {}) =>
  (variables) =>
    variables?.restaurantId === restaurantId &&
    variables?.employeeId === employeeId &&
    anyIsoDateRange(variables, "startDate", "endDate");

const matchShiftAckVars =
  (restaurantId = "r1") =>
  (variables) =>
    variables?.restaurantId === restaurantId &&
    anyIsoDateRange(variables, "periodStart", "periodEnd");

const shiftTemplates = [
  {
    key: "morning",
    label: "Ca sáng",
    startTime: "06:00",
    endTime: "12:00",
    enabled: true,
    allowCrossDay: false,
  },
  {
    key: "afternoon",
    label: "Ca chiều",
    startTime: "12:00",
    endTime: "18:00",
    enabled: true,
    allowCrossDay: false,
  },
  {
    key: "evening",
    label: "Ca tối",
    startTime: "18:00",
    endTime: "23:00",
    enabled: true,
    allowCrossDay: false,
  },
];

const schedulingPolicyMock = () => ({
  request: {
    query: GET_SCHEDULING_POLICY,
    variables: { restaurantId: "r1" },
  },
  result: {
    data: {
      schedulingPolicy: {
        shiftTemplates,
        employmentTypePolicy: {
          part_time: {
            minWeeklyHours: 8,
            weeklyHoursTarget: 20,
            weeklyHoursCap: 28,
            maxShiftsPerWeek: 4,
            requireAvailability: true,
          },
          seasonal: {
            minWeeklyHours: 0,
            weeklyHoursTarget: 24,
            weeklyHoursCap: 40,
            maxShiftsPerWeek: 5,
            requireAvailability: true,
          },
        },
      },
    },
  },
});

const emptyAvailabilityWindowsMock = () => ({
  request: { query: GET_AVAILABILITY_WINDOWS },
  variableMatcher: matchRestaurantWindowVars("r1"),
  result: { data: { availabilityWindows: [] } },
});

const emptyScheduleAckMock = () => ({
  request: { query: GET_MY_SCHEDULE_ACK },
  variableMatcher: matchRestaurantPeriodVars("r1"),
  result: { data: { myScheduleAcknowledgement: null } },
});

const emptyStaffShiftsMock = () => ({
  request: { query: GET_STAFF_SHIFTS },
  variableMatcher: matchStaffShiftVars({
    restaurantId: "r1",
    employeeId: "e1",
  }),
  result: { data: { staffShifts: [] } },
});

const emptyShiftAcksMock = () => ({
  request: { query: GET_MY_SHIFT_ACKS },
  variableMatcher: matchShiftAckVars("r1"),
  result: { data: { myShiftAcknowledgements: [] } },
});
const emptyMyShiftAttendancesMock = () => ({
  request: { query: MY_SHIFT_ATTENDANCES },
  variableMatcher: (variables) =>
    anyIsoDateRange(variables, "periodStart", "periodEnd"),
  result: { data: { myShiftAttendances: [] } },
});

const buildIsoDate = (date) => date.toISOString();

const buildWeekRange = (weekOffset = 0) => {
  const now = new Date();
  const dayIndex = now.getDay();
  const daysFromMonday = dayIndex === 0 ? 6 : dayIndex - 1;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
};

const availabilityWindow = (overrides = {}) => {
  const { weekStart, weekEnd } = buildWeekRange(1);
  const openAt = new Date(weekStart);
  openAt.setDate(openAt.getDate() - 2);
  const closeAt = new Date(weekEnd);
  closeAt.setDate(closeAt.getDate() + 1);

  return {
    id: "w1",
    periodStart: buildIsoDate(weekStart),
    periodEnd: buildIsoDate(weekEnd),
    openAt: buildIsoDate(openAt),
    closeAt: buildIsoDate(closeAt),
    status: "open",
    effectiveStatus: "open",
    registrationMode: "manual",
    targetEmploymentTypes: ["part_time"],
    allowFullTimeUnavailableException: true,
    lateChangeRequiresApproval: true,
    ...overrides,
  };
};

const availabilityWindowsMock = (windows) => ({
  request: { query: GET_AVAILABILITY_WINDOWS },
  variableMatcher: matchRestaurantWindowVars("r1"),
  result: { data: { availabilityWindows: windows } },
});

const staffShiftsMock = (staffShifts) => ({
  request: { query: GET_STAFF_SHIFTS },
  variableMatcher: matchStaffShiftVars({
    restaurantId: "r1",
    employeeId: "e1",
  }),
  result: { data: { staffShifts } },
});

const shiftAcksMock = (myShiftAcknowledgements) => ({
  request: { query: GET_MY_SHIFT_ACKS },
  variableMatcher: matchShiftAckVars("r1"),
  result: { data: { myShiftAcknowledgements } },
});

function buildScheduleMocks(mocks = []) {
  const defaultMocks = [
    schedulingPolicyMock(),
    emptyAvailabilityWindowsMock(),
    emptyAvailabilityWindowsMock(),
    emptyScheduleAckMock(),
    emptyScheduleAckMock(),
    emptyStaffShiftsMock(),
    emptyStaffShiftsMock(),
    emptyShiftAcksMock(),
    emptyShiftAcksMock(),
    emptyShiftAcksMock(),
    emptyShiftAcksMock(),
    emptyMyShiftAttendancesMock(),
    emptyMyShiftAttendancesMock(),
    emptyMyShiftAttendancesMock(),
    emptyMyShiftAttendancesMock(),
  ];

  return [...mocks, ...defaultMocks];
}

function renderWithAuth(user, mocks = []) {
  return render(
    <AuthContext.Provider value={{ user, restaurants: [{ id: "r1" }] }}>
      <MockedProvider mocks={buildScheduleMocks(mocks)}>
        <StaffSchedulePage />
      </MockedProvider>
    </AuthContext.Provider>,
  );
}

function renderWithStaffLayout(user, mocks = []) {
  return render(
    <MemoryRouter initialEntries={["/staff/schedule"]}>
      <AuthContext.Provider value={{ user, restaurants: [{ id: "r1" }] }}>
        <MockedProvider mocks={buildScheduleMocks(mocks)}>
          <StaffLayout>
            <StaffSchedulePage />
          </StaffLayout>
        </MockedProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("StaffSchedulePage", () => {
  it("shows page title", async () => {
    renderWithAuth({
      id: "e1",
      employmentType: "part_time",
      restaurantForStaff: "r1",
    });

    expect(
      await screen.findByText("Lịch làm việc của tôi"),
    ).toBeInTheDocument();
  });

  it("smoke-renders empty schedule state controls without an extra main landmark", async () => {
    const { container } = renderWithStaffLayout({
      id: "e1",
      employmentType: "part_time",
      restaurantForStaff: "r1",
      roleSlug: "server",
    });

    expect(await screen.findByText("Lịch làm việc của tôi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem tuần trước" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem tuần sau" })).toBeInTheDocument();
    expect(screen.getByText("Đăng ký lịch")).toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main#staff-main-content")).toBeInTheDocument();
  });

  it("shows full-time unavailable copy", async () => {
    renderWithAuth({
      id: "e1",
      employmentType: "full_time",
      restaurantForStaff: "r1",
    });

    expect(
      (await screen.findAllByText(/Báo ca không khả dụng/i)).length,
    ).toBeGreaterThan(0);
  });

  it("does not render manager controls", async () => {
    renderWithAuth({
      id: "e1",
      employmentType: "part_time",
      restaurantForStaff: "r1",
    });

    expect(screen.queryByText(/Tạo cửa đăng ký/i)).not.toBeInTheDocument();
  });

  it("matches and renders open availability window for next-week target period", async () => {
    const mocks = [
      availabilityWindowsMock([
        availabilityWindow({
          targetEmploymentTypes: ["part_time", "seasonal"],
        }),
      ]),
      emptyScheduleAckMock(),
      emptyStaffShiftsMock(),
      {
        request: {
          query: GET_SUBMISSION,
          variables: {
            windowId: "w1",
            employeeId: "e1",
          },
        },
        result: {
          data: { staffAvailabilitySubmission: null },
        },
      },
    ];

    renderWithAuth(
      {
        id: "e1",
        employmentType: "part_time",
        restaurantForStaff: { id: "r1" },
      },
      mocks,
    );

    expect((await screen.findAllByText("Đang mở")).length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Chưa có kỳ đăng ký lịch"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Ca sáng").length).toBeGreaterThan(0);
  });

  it("renders approved submission summary and approved badge", async () => {
    const mocks = [
      availabilityWindowsMock([availabilityWindow()]),
      {
        request: {
          query: GET_SUBMISSION,
          variables: { windowId: "w1", employeeId: "e1" },
        },
        result: {
          data: {
            staffAvailabilitySubmission: {
              id: "s1",
              status: "approved",
              submissionType: "weekly_availability",
              reviewNote: null,
              pendingSubmittedAt: null,
              pendingSlots: [],
              slots: [
                {
                  date: "2026-05-11T00:00:00.000Z",
                  shiftType: "morning",
                  status: "available",
                  note: null,
                },
              ],
            },
          },
        },
      },
    ];

    renderWithAuth(
      { id: "e1", employmentType: "part_time", restaurantForStaff: "r1" },
      mocks,
    );

    expect(await screen.findByText("Các ca đã đăng ký")).toBeInTheDocument();
    expect(
      await screen.findByText("Đã được quản lý duyệt"),
    ).toBeInTheDocument();
  });

  it("renders late change pending slots and rejected note", async () => {
    const mocks = [
      availabilityWindowsMock([availabilityWindow()]),
      {
        request: {
          query: GET_SUBMISSION,
          variables: { windowId: "w1", employeeId: "e1" },
        },
        result: {
          data: {
            staffAvailabilitySubmission: {
              id: "s2",
              status: "late_change_requested",
              submissionType: "weekly_availability",
              reviewNote: null,
              pendingSubmittedAt: null,
              pendingSlots: [
                {
                  date: "2026-05-12T00:00:00.000Z",
                  shiftType: "morning",
                  status: "available",
                  note: null,
                },
              ],
              slots: [],
            },
          },
        },
      },
    ];

    renderWithAuth(
      { id: "e1", employmentType: "part_time", restaurantForStaff: "r1" },
      mocks,
    );

    expect(
      await screen.findByText("Yêu cầu thay đổi muộn đang chờ duyệt"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /Các thay đổi này chỉ được dùng để xếp lịch sau khi quản lý duyệt/,
      ),
    ).toBeInTheDocument();
  });

  it("shows and enforces minimum availability hours for part-time", async () => {
    const mocks = [
      availabilityWindowsMock([availabilityWindow()]),
      {
        request: {
          query: GET_SUBMISSION,
          variables: { windowId: "w1", employeeId: "e1" },
        },
        result: { data: { staffAvailabilitySubmission: null } },
      },
    ];

    renderWithAuth(
      { id: "e1", employmentType: "part_time", restaurantForStaff: "r1" },
      mocks,
    );

    expect(await screen.findByText("Yêu cầu giờ khả dụng")).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("checkbox"))[0]);
    expect(await screen.findByText(/Còn thiếu: 2 giờ/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Gửi đăng ký ca khả dụng/i }),
    ).toBeDisabled();
  });

  it("shows non-cancelled shifts in weekly schedule", async () => {
    const mocks = [
      staffShiftsMock([
        {
          id: "shift-1",
          employeeId: "e1",
          shiftType: "morning",
          startTime: "2026-05-05T06:00:00.000Z",
          endTime: "2026-05-05T12:00:00.000Z",
          status: "scheduled",
          notes: null,
          restaurantId: "r1",
        },
        {
          id: "shift-2",
          employeeId: "e1",
          shiftType: "evening",
          startTime: "2026-05-06T18:00:00.000Z",
          endTime: "2026-05-06T23:00:00.000Z",
          status: "cancelled",
          notes: null,
          restaurantId: "r1",
        },
      ]),
    ];

    renderWithAuth(
      { id: "e1", employmentType: "part_time", restaurantForStaff: "r1" },
      mocks,
    );

    expect(await screen.findByText("1 ca đã công bố")).toBeInTheDocument();
  });

  it("real form submits shift decline and shows success message", async () => {
    const shiftId = "shift-pending-1";
    const reason = "Bị sốt cao nên không thể đi làm.";
    const reasonCategory = "sick";
    const mocks = [
      staffShiftsMock([
        {
          id: shiftId,
          employeeId: "e1",
          shiftType: "morning",
          startTime: "2026-05-05T06:00:00.000Z",
          endTime: "2026-05-05T12:00:00.000Z",
          status: "scheduled",
          notes: null,
          restaurantId: "r1",
        },
      ]),
      shiftAcksMock([
        {
          id: "ack-1",
          shiftId,
          status: "pending",
          declineClassification: null,
        },
      ]),
      {
        request: {
          query: RESPOND_SHIFT_ACK,
          variables: {
            input: { shiftId, response: "decline", reason, reasonCategory },
          },
        },
        result: {
          data: {
            respondShiftAcknowledgement: {
              id: "ack-1",
              status: "declined",
              declineClassification: "unknown",
            },
          },
        },
      },
      shiftAcksMock([
        {
          id: "ack-1",
          shiftId,
          status: "declined",
          declineClassification: "unknown",
        },
      ]),
    ];

    renderWithAuth(
      { id: "e1", employmentType: "part_time", restaurantForStaff: "r1" },
      mocks,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Từ chối ca" }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: reasonCategory },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Lý do từ chối (>= 5 ký tự)"),
      {
        target: { value: reason },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Gửi từ chối" }));

    expect(
      await screen.findByRole("button", { name: "Đang gửi..." }),
    ).toBeDisabled();
    expect(
      await screen.findByText("Bạn đã gửi từ chối ca. Chờ quản lý xem xét."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Gửi từ chối" }),
      ).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Đã từ chối")).toBeInTheDocument();
  });

  it("keeps decline submit clickable and shows validation for short reason", async () => {
    const shiftId = "shift-pending-2";
    const mocks = [
      staffShiftsMock([
        {
          id: shiftId,
          employeeId: "e1",
          shiftType: "morning",
          startTime: "2026-05-05T06:00:00.000Z",
          endTime: "2026-05-05T12:00:00.000Z",
          status: "scheduled",
          notes: null,
          restaurantId: "r1",
        },
      ]),
      shiftAcksMock([
        {
          id: "ack-2",
          shiftId,
          status: "pending",
          declineClassification: null,
        },
      ]),
    ];

    renderWithAuth(
      { id: "e1", employmentType: "part_time", restaurantForStaff: "r1" },
      mocks,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Từ chối ca" }));
    fireEvent.change(
      screen.getByPlaceholderText("Lý do từ chối (>= 5 ký tự)"),
      {
        target: { value: "abc" },
      },
    );
    const submitBtn = screen.getByRole("button", { name: "Gửi từ chối" });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText("Vui lòng nhập lý do tối thiểu 5 ký tự."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Đang gửi..." }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows backend error and keeps decline form values", async () => {
    const shiftId = "shift-pending-3";
    const reason = "Bận việc gia đình đột xuất";
    const mocks = [
      staffShiftsMock([
        {
          id: shiftId,
          employeeId: "e1",
          shiftType: "morning",
          startTime: "2026-05-05T06:00:00.000Z",
          endTime: "2026-05-05T12:00:00.000Z",
          status: "scheduled",
          notes: null,
          restaurantId: "r1",
        },
      ]),
      shiftAcksMock([
        {
          id: "ack-3",
          shiftId,
          status: "pending",
          declineClassification: null,
        },
      ]),
      {
        request: {
          query: RESPOND_SHIFT_ACK,
          variables: {
            input: {
              shiftId,
              response: "decline",
              reason,
              reasonCategory: "personal",
            },
          },
        },
        error: new Error("Backend down"),
      },
    ];

    renderWithAuth(
      { id: "e1", employmentType: "part_time", restaurantForStaff: "r1" },
      mocks,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Từ chối ca" }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "personal" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Lý do từ chối (>= 5 ký tự)"),
      { target: { value: reason } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Gửi từ chối" }));

    expect(await screen.findByText("Backend down")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Lý do từ chối (>= 5 ký tự)"),
    ).toHaveValue(reason);
    expect(screen.getByRole("combobox")).toHaveValue("personal");
  });

  it("shows stale ack error when decline is not pending", async () => {
    const shiftId = "shift-stale-1";
    const mocks = [
      staffShiftsMock([
        {
          id: shiftId,
          employeeId: "e1",
          shiftType: "morning",
          startTime: "2026-05-05T06:00:00.000Z",
          endTime: "2026-05-05T12:00:00.000Z",
          status: "scheduled",
          notes: null,
          restaurantId: "r1",
        },
      ]),
      shiftAcksMock([
        {
          id: "ack-4",
          shiftId,
          status: "accepted",
          declineClassification: null,
        },
      ]),
    ];

    renderWithAuth(
      { id: "e1", employmentType: "part_time", restaurantForStaff: "r1" },
      mocks,
    );

    expect(await screen.findByText("Đã nhận ca")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Từ chối ca" }),
    ).not.toBeInTheDocument();
  });
});
