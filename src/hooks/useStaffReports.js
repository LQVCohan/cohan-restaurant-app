import { gql, useQuery } from "@apollo/client";
import { useMemo } from "react";

const STAFF_REPORTS_QUERY = gql`
  query StaffReportsOverview($input: StaffReportsInput!) {
    staffReportsOverview(input: $input) {
      currentPeriod {
        startDate
        endDate
      }
      comparisonPeriod {
        startDate
        endDate
      }
      summary {
        activeEmployees
        terminatedEmployees
        joinedEmployees
        leftEmployees
        attendanceRecords
        presentCount
        absentCount
        lateCount
        earlyLeaveCount
        leaveTotal
        leaveApproved
        leaveRejected
        leavePending
        leaveDaysUsed
        paidLeaveDays
        unpaidLeaveDays
        remainingLeaveBalanceDays
      }
      comparison {
        metric
        current
        previous
        delta
        deltaPct
      }
      attendanceTrend {
        date
        present
        absent
        late
        earlyLeave
      }
      attendanceByShift {
        shiftType
        records
        present
        absent
        late
        earlyLeave
      }
      attendanceIssueDistribution {
        label
        count
      }
      leaveByType {
        leaveType
        count
        days
      }
      leaveStatusDistribution {
        label
        count
      }
      workforceStatusDistribution {
        label
        count
      }
      attendanceDetails {
        employeeId
        employeeName
        employeeCode
        date
        shiftType
        status
        checkInAt
        checkOutAt
        workedMinutes
        lateMinutes
        earlyLeaveMinutes
      }
      leaveDetails {
        requestId
        employeeId
        employeeName
        employeeCode
        leaveType
        status
        startDate
        endDate
        requestedDays
        reason
      }
    }
  }
`;

const toISODate = (d) => d.toISOString().slice(0, 10);

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDateTimeInput = (value, boundary = "start") => {
  if (!value) return undefined;
  if (DATE_ONLY_PATTERN.test(value)) {
    return `${value}T${boundary === "end" ? "23:59:59.999" : "00:00:00.000"}Z`;
  }
  return value;
};

export const buildPresetRange = (preset) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const year = today.getFullYear();
  const month = today.getMonth();

  switch (preset) {
    case "last7":
      return { startDate: toISODate(new Date(today.getTime() - 6 * 86400000)), endDate: toISODate(today) };
    case "last30":
      return { startDate: toISODate(new Date(today.getTime() - 29 * 86400000)), endDate: toISODate(today) };
    case "month":
      return { startDate: toISODate(new Date(year, month, 1)), endDate: toISODate(today) };
    case "quarter": {
      const qStartMonth = Math.floor(month / 3) * 3;
      return { startDate: toISODate(new Date(year, qStartMonth, 1)), endDate: toISODate(today) };
    }
    case "year":
      return { startDate: toISODate(new Date(year, 0, 1)), endDate: toISODate(today) };
    default:
      return { startDate: toISODate(new Date(today.getTime() - 29 * 86400000)), endDate: toISODate(today) };
  }
};

export default function useStaffReports({ startDate, endDate, compareStartDate, compareEndDate }) {
  const variables = useMemo(
    () => ({
      input: {
        startDate: toDateTimeInput(startDate, "start"),
        endDate: toDateTimeInput(endDate, "end"),
        compareStartDate: toDateTimeInput(compareStartDate, "start"),
        compareEndDate: toDateTimeInput(compareEndDate, "end"),
      },
    }),
    [compareEndDate, compareStartDate, endDate, startDate]
  );

  const { data, loading, error, refetch } = useQuery(STAFF_REPORTS_QUERY, {
    variables,
    fetchPolicy: "cache-and-network",
    skip: !startDate || !endDate,
  });

  return {
    report: data?.staffReportsOverview || null,
    loading,
    error,
    refetch,
  };
}
