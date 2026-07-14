import React, { createContext, useContext, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";

export const SCHEDULE_EMPLOYMENT_SCOPES = {
  ALL: "all",
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
  ROTATING: "rotating",
};

const FULL_TIME_TYPES = new Set(["full_time", "probation", "contract"]);
const PART_TIME_TYPES = new Set(["part_time", "seasonal"]);

const GET_SCHEDULE_STAFF_SHIFT_TYPES = gql`
  query ScheduleStaffShiftTypes {
    staffList {
      id
      shiftType
    }
  }
`;

const ScheduleEmploymentScopeContext = createContext(
  SCHEDULE_EMPLOYMENT_SCOPES.ALL,
);
const ScheduleStaffShiftTypeContext = createContext(new Map());

const idString = (value) => String(value?.id || value?._id || value || "");

export function normalizeEmploymentType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeStaffShiftType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function resolveStaffShiftType(staff, shiftTypeByStaffId = new Map()) {
  const directShiftType = normalizeStaffShiftType(staff?.shiftType);
  if (directShiftType) return directShiftType;
  return normalizeStaffShiftType(
    shiftTypeByStaffId?.get?.(idString(staff?.id || staff?._id)),
  );
}

export function matchesScheduleEmploymentScope(
  staff,
  scope,
  shiftTypeByStaffId = new Map(),
) {
  if (!scope || scope === SCHEDULE_EMPLOYMENT_SCOPES.ALL) return true;

  const shiftType = resolveStaffShiftType(staff, shiftTypeByStaffId);
  const isRotatingStaff = shiftType === SCHEDULE_EMPLOYMENT_SCOPES.ROTATING;

  if (scope === SCHEDULE_EMPLOYMENT_SCOPES.ROTATING) {
    return isRotatingStaff;
  }

  // Nhân viên được cấu hình xoay ca có khu vực riêng, tránh bị lẫn hoặc biến mất
  // trong hai khu vực toàn thời gian / bán thời gian.
  if (isRotatingStaff) return false;

  const employmentType = normalizeEmploymentType(staff?.employmentType);
  if (scope === SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME) {
    return PART_TIME_TYPES.has(employmentType);
  }
  if (scope === SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME) {
    return FULL_TIME_TYPES.has(employmentType);
  }
  return true;
}

export function filterStaffForScheduleScope(
  staffList = [],
  scope = "all",
  shiftTypeByStaffId = new Map(),
) {
  return (staffList || []).filter((staff) =>
    matchesScheduleEmploymentScope(staff, scope, shiftTypeByStaffId),
  );
}

export function ScheduleEmploymentScopeProvider({ scope = "all", children }) {
  const value = useMemo(() => scope || "all", [scope]);
  const { data } = useQuery(GET_SCHEDULE_STAFF_SHIFT_TYPES, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });
  const shiftTypeByStaffId = useMemo(
    () =>
      new Map(
        (data?.staffList || []).map((staff) => [
          idString(staff?.id),
          normalizeStaffShiftType(staff?.shiftType),
        ]),
      ),
    [data?.staffList],
  );

  return (
    <ScheduleEmploymentScopeContext.Provider value={value}>
      <ScheduleStaffShiftTypeContext.Provider value={shiftTypeByStaffId}>
        {children}
      </ScheduleStaffShiftTypeContext.Provider>
    </ScheduleEmploymentScopeContext.Provider>
  );
}

export function useScheduleEmploymentScope() {
  return useContext(ScheduleEmploymentScopeContext);
}

export function useScheduleStaffShiftTypes() {
  return useContext(ScheduleStaffShiftTypeContext);
}
