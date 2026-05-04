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
});
