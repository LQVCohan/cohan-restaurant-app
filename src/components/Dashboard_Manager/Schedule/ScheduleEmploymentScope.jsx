import React, { createContext, useContext, useMemo } from "react";

export const SCHEDULE_EMPLOYMENT_SCOPES = {
  ALL: "all",
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
};

const FULL_TIME_TYPES = new Set(["full_time", "probation", "contract"]);
const PART_TIME_TYPES = new Set(["part_time", "seasonal"]);

const ScheduleEmploymentScopeContext = createContext(
  SCHEDULE_EMPLOYMENT_SCOPES.ALL,
);

export function normalizeEmploymentType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function matchesScheduleEmploymentScope(staff, scope) {
  if (!scope || scope === SCHEDULE_EMPLOYMENT_SCOPES.ALL) return true;
  const employmentType = normalizeEmploymentType(staff?.employmentType);
  if (scope === SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME) {
    return PART_TIME_TYPES.has(employmentType);
  }
  if (scope === SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME) {
    return FULL_TIME_TYPES.has(employmentType);
  }
  return true;
}

export function filterStaffForScheduleScope(staffList = [], scope = "all") {
  return (staffList || []).filter((staff) =>
    matchesScheduleEmploymentScope(staff, scope),
  );
}

export function ScheduleEmploymentScopeProvider({ scope = "all", children }) {
  const value = useMemo(() => scope || "all", [scope]);
  return (
    <ScheduleEmploymentScopeContext.Provider value={value}>
      {children}
    </ScheduleEmploymentScopeContext.Provider>
  );
}

export function useScheduleEmploymentScope() {
  return useContext(ScheduleEmploymentScopeContext);
}
