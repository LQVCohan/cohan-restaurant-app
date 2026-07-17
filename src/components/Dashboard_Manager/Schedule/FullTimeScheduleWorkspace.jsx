import React from "react";
import ScheduleManagement from "./ScheduleManagement";
import {
  ScheduleEmploymentScopeProvider,
  SCHEDULE_EMPLOYMENT_SCOPES,
} from "./ScheduleEmploymentScope";

const FullTimeScheduleWorkspace = () => (
  <ScheduleEmploymentScopeProvider scope={SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME}>
    <ScheduleManagement />
  </ScheduleEmploymentScopeProvider>
);

export default FullTimeScheduleWorkspace;
