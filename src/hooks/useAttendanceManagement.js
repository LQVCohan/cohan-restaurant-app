import { gql, useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";

const QUERY_ATTENDANCE_PAGE = gql`
  query AttendancePageData(
    $startDate: DateTime!
    $endDate: DateTime!
    $status: String
    $search: String
  ) {
    staffList {
      id
      fullName
      employeeCode
      positionTitle
      roleName
      avatarUrl
      avatar
      primaryRestaurant {
        id
      }
    }
    staffAttendanceRecords(
      startDate: $startDate
      endDate: $endDate
      status: $status
      search: $search
    ) {
      id
      employeeId
      employeeName
      employeeCode
      employeeRole
      employeeAvatar
      workDate
      shiftId
      shiftType
      plannedStartTime
      plannedEndTime
      actualCheckInAt
      actualCheckOutAt
      workedMinutes
      hours
      latenessMinutes
      earlyLeaveMinutes
      overtimeMinutes
      status
      isOffSchedule
      source
      note
      approved
    }
  }
`;

const MUTATION_UPSERT_ATTENDANCE = gql`
  mutation UpsertAttendance($input: UpsertStaffAttendanceInput!) {
    upsertStaffAttendance(input: $input) {
      id
      employeeId
      status
      actualCheckInAt
      actualCheckOutAt
      workedMinutes
      latenessMinutes
      earlyLeaveMinutes
      overtimeMinutes
      shiftId
      plannedStartTime
      plannedEndTime
      isOffSchedule
      note
      source
    }
  }
`;

export default function useAttendanceManagement({ selectedDate, status, search }) {
  const queryVars = useMemo(
    () => ({
      startDate: selectedDate,
      endDate: selectedDate,
      status: status === "all" ? undefined : status,
      search: search?.trim() || undefined,
    }),
    [search, selectedDate, status]
  );

  const { data, loading, error, refetch } = useQuery(QUERY_ATTENDANCE_PAGE, {
    variables: queryVars,
    fetchPolicy: "cache-and-network",
  });

  const [mutateQuickAttendance, mutationState] = useMutation(
    MUTATION_UPSERT_ATTENDANCE
  );

  const employees = useMemo(() => data?.staffList || [], [data?.staffList]);
  const records = useMemo(
    () => data?.staffAttendanceRecords || [],
    [data?.staffAttendanceRecords]
  );

  const stats = useMemo(() => {
    const total = records.length;
    const present = records.filter((a) => Boolean(a.actualCheckInAt)).length;
    const lateOrEarly = records.filter(
      (a) =>
        ["late", "early_leave", "late_early_leave"].includes(a.status) ||
        Number(a.latenessMinutes || 0) > 0 ||
        Number(a.earlyLeaveMinutes || 0) > 0
    ).length;
    const absent = records.filter((a) => a.status === "scheduled_absent").length;

    return { total, present, lateOrEarly, absent };
  }, [records]);

  return {
    employees,
    records,
    stats,
    loading,
    error,
    refetch,
    mutateQuickAttendance,
    mutationState,
  };
}
