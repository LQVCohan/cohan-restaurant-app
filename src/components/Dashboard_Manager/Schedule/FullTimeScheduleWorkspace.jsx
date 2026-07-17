import React from "react";
import ScheduleManagement from "./ScheduleManagement";
import {
  ScheduleEmploymentScopeProvider,
  SCHEDULE_EMPLOYMENT_SCOPES,
} from "./ScheduleEmploymentScope";
import "./FullTimeScheduleWorkspace.scss";
import "./FullTimeScheduleWorkspaceTrim.scss";

const FullTimeScheduleWorkspace = () => (
  <ScheduleEmploymentScopeProvider scope={SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME}>
    <section
      className="full-time-schedule-workspace"
      aria-labelledby="full-time-schedule-workspace-title"
      data-layout="integrated-header-compact-toolbar"
      data-visual-density="compact"
      data-content="essential-only"
    >
      <header className="full-time-schedule-header">
        <h2 id="full-time-schedule-workspace-title">
          Ca cố định theo ngày làm việc
        </h2>
      </header>

      <div className="full-time-schedule-core">
        <ScheduleManagement />
      </div>
    </section>
  </ScheduleEmploymentScopeProvider>
);

export default FullTimeScheduleWorkspace;
