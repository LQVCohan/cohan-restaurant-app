import React from "react";
import { describe, it, expect } from "vitest";
import { gql } from "@apollo/client";
import { MockedProvider } from "@apollo/client/testing";
import { render, screen } from "@testing-library/react";
import StaffSchedulePage from "./StaffSchedulePage";
import { AuthContext } from "@/context/AuthContext";

const GET_AVAILABILITY_WINDOWS = gql`
  query StaffAvailabilityWindows($restaurantId: ID!, $from: DateTime, $to: DateTime) {
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
  query StaffMyShifts($restaurantId: ID, $employeeId: ID, $startDate: DateTime, $endDate: DateTime) {
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
  query MyScheduleAck($restaurantId: ID!, $periodStart: DateTime!, $periodEnd: DateTime!) {
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

function renderWithAuth(user, mocks = []) {
  const defaultMocks = [
    {
      request: {
        query: GET_AVAILABILITY_WINDOWS,
        variables: {
          restaurantId: "r1",
          from: "2026-05-10T00:00:00.000Z",
          to: "2026-05-18T23:59:59.999Z",
        },
      },
      result: {
        data: { availabilityWindows: [] },
      },
    },
    {
      request: {
        query: GET_AVAILABILITY_WINDOWS,
        variables: {
          restaurantId: "r1",
          from: "2026-05-10T00:00:00.000Z",
          to: "2026-05-18T23:59:59.999Z",
        },
      },
      result: {
        data: { availabilityWindows: [] },
      },
    },
    {
      request: {
        query: GET_MY_SCHEDULE_ACK,
        variables: {
          restaurantId: "r1",
          periodStart: "2026-05-04T00:00:00.000Z",
          periodEnd: "2026-05-10T23:59:59.999Z",
        },
      },
      result: { data: { myScheduleAcknowledgement: null } },
    },
    {
      request: {
        query: GET_MY_SCHEDULE_ACK,
        variables: {
          restaurantId: "r1",
          periodStart: "2026-05-04T00:00:00.000Z",
          periodEnd: "2026-05-10T23:59:59.999Z",
        },
      },
      result: { data: { myScheduleAcknowledgement: null } },
    },
    {
      request: {
        query: GET_STAFF_SHIFTS,
        variables: {
          restaurantId: "r1",
          employeeId: "e1",
          startDate: "2026-05-04T00:00:00.000Z",
          endDate: "2026-05-10T23:59:59.999Z",
        },
      },
      result: {
        data: { staffShifts: [] },
      },
    },
  ];

  return render(
    <AuthContext.Provider value={{ user, restaurants: [{ id: "r1" }] }}>
      <MockedProvider mocks={[...mocks, ...defaultMocks]}>
        <StaffSchedulePage />
      </MockedProvider>
    </AuthContext.Provider>,
  );
}

describe("StaffSchedulePage", () => {
  it("shows page title", async () => {
    renderWithAuth({ id: "e1", employmentType: "part_time", restaurantForStaff: "r1" });
    expect(await screen.findByText("Lịch làm việc của tôi")).toBeInTheDocument();
  });

  it("shows full-time unavailable copy", async () => {
    renderWithAuth({ id: "e1", employmentType: "full_time", restaurantForStaff: "r1" });
    expect((await screen.findAllByText(/Báo ca không khả dụng/i)).length).toBeGreaterThan(0);
  });

  it("does not render manager controls", async () => {
    renderWithAuth({ id: "e1", employmentType: "part_time", restaurantForStaff: "r1" });
    expect(screen.queryByText(/Tạo cửa đăng ký/i)).not.toBeInTheDocument();
  });

  it("matches and renders open availability window for next-week target period", async () => {
    const mocks = [
      {
        request: {
          query: GET_AVAILABILITY_WINDOWS,
          variables: {
            restaurantId: "r1",
            from: "2026-05-10T00:00:00.000Z",
            to: "2026-05-18T23:59:59.999Z",
          },
        },
        result: {
          data: {
            availabilityWindows: [
              {
                id: "w1",
                periodStart: "2026-05-11T00:00:00.000Z",
                periodEnd: "2026-05-17T23:59:59.999Z",
                openAt: "2026-05-10T00:00:00.000Z",
                closeAt: "2026-05-17T23:59:59.999Z",
                status: "open",
                effectiveStatus: "open",
                registrationMode: "manual",
                targetEmploymentTypes: ["part_time", "seasonal"],
                allowFullTimeUnavailableException: true,
                lateChangeRequiresApproval: true,
              },
            ],
          },
        },
      },
      {
        request: {
          query: GET_MY_SCHEDULE_ACK,
          variables: {
            restaurantId: "r1",
            periodStart: "2026-05-04T00:00:00.000Z",
            periodEnd: "2026-05-10T23:59:59.999Z",
          },
        },
        result: { data: { myScheduleAcknowledgement: null } },
      },
      {
        request: {
          query: GET_STAFF_SHIFTS,
          variables: {
            restaurantId: "r1",
            employeeId: "e1",
            startDate: "2026-05-04T00:00:00.000Z",
            endDate: "2026-05-10T23:59:59.999Z",
          },
        },
        result: {
          data: { staffShifts: [] },
        },
      },
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
      { id: "e1", employmentType: "part_time", restaurantForStaff: { id: "r1" } },
      mocks,
    );

    expect((await screen.findAllByText("Đang mở")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Chưa có kỳ đăng ký lịch")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ca sáng").length).toBeGreaterThan(0);
  });

  it("renders approved submission summary and approved badge", async () => {
    const mocks = [{ request: { query: GET_SUBMISSION, variables: { windowId: "w1", employeeId: "e1" } }, result: { data: { staffAvailabilitySubmission: { id: "s1", status: "approved", submissionType: "weekly_availability", reviewNote: null, pendingSubmittedAt: null, pendingSlots: [], slots: [{ date: "2026-05-11T00:00:00.000Z", shiftType: "morning", status: "available", note: null }] } } } },{ request: { query: GET_AVAILABILITY_WINDOWS, variables: { restaurantId: "r1", from: "2026-05-10T00:00:00.000Z", to: "2026-05-18T23:59:59.999Z" } }, result: { data: { availabilityWindows: [{ id: "w1", periodStart: "2026-05-11T00:00:00.000Z", periodEnd: "2026-05-17T23:59:59.999Z", openAt: "2026-05-10T00:00:00.000Z", closeAt: "2026-05-17T23:59:59.999Z", status: "open", effectiveStatus: "open", registrationMode: "manual", targetEmploymentTypes: ["part_time"], allowFullTimeUnavailableException: true, lateChangeRequiresApproval: true }] } } }];
    renderWithAuth({ id: "e1", employmentType: "part_time", restaurantForStaff: "r1" }, mocks);
    expect(await screen.findByText("Các ca đã đăng ký")).toBeInTheDocument();
    expect(await screen.findByText("Đã được quản lý duyệt")).toBeInTheDocument();
  });

  it("renders late change pending slots and rejected note", async () => {
    const baseWindow = { request: { query: GET_AVAILABILITY_WINDOWS, variables: { restaurantId: "r1", from: "2026-05-10T00:00:00.000Z", to: "2026-05-18T23:59:59.999Z" } }, result: { data: { availabilityWindows: [{ id: "w1", periodStart: "2026-05-11T00:00:00.000Z", periodEnd: "2026-05-17T23:59:59.999Z", openAt: "2026-05-10T00:00:00.000Z", closeAt: "2026-05-17T23:59:59.999Z", status: "open", effectiveStatus: "open", registrationMode: "manual", targetEmploymentTypes: ["part_time"], allowFullTimeUnavailableException: true, lateChangeRequiresApproval: true }] } } };
    const mocks = [baseWindow,{ request: { query: GET_SUBMISSION, variables: { windowId: "w1", employeeId: "e1" } }, result: { data: { staffAvailabilitySubmission: { id: "s2", status: "late_change_requested", submissionType: "weekly_availability", reviewNote: null, pendingSubmittedAt: null, pendingSlots: [{ date: "2026-05-12T00:00:00.000Z", shiftType: "morning", status: "available", note: null }], slots: [] } } } }];
    renderWithAuth({ id: "e1", employmentType: "part_time", restaurantForStaff: "r1" }, mocks);
    expect(await screen.findByText("Yêu cầu thay đổi muộn đang chờ duyệt")).toBeInTheDocument();
    expect(await screen.findByText(/Các thay đổi này chỉ được dùng để xếp lịch sau khi quản lý duyệt/)).toBeInTheDocument();
  });

  it("shows non-cancelled shifts in weekly schedule", async () => {
    const mocks = [
      {
        request: {
          query: GET_STAFF_SHIFTS,
          variables: {
            restaurantId: "r1",
            employeeId: "e1",
            startDate: "2026-05-04T00:00:00.000Z",
            endDate: "2026-05-10T23:59:59.999Z",
          },
        },
        result: {
          data: {
            staffShifts: [
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
            ],
          },
        },
      },
    ];

    renderWithAuth({ id: "e1", employmentType: "part_time", restaurantForStaff: "r1" }, mocks);

    expect(await screen.findByText("1 ca đã công bố")).toBeInTheDocument();
  });

});
