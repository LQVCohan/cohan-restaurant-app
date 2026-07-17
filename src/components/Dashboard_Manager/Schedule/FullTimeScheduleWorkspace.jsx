import React from "react";
import { CalendarDays } from "lucide-react";
import ScheduleManagement from "./ScheduleManagement";
import {
  ScheduleEmploymentScopeProvider,
  SCHEDULE_EMPLOYMENT_SCOPES,
} from "./ScheduleEmploymentScope";
import "./FullTimeScheduleWorkspace.scss";

const FullTimeScheduleWorkspace = () => (
  <ScheduleEmploymentScopeProvider scope={SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME}>
    <section
      className="full-time-schedule-workspace"
      aria-labelledby="full-time-schedule-workspace-title"
      data-layout="single-column"
    >
      <header className="full-time-schedule-header">
        <div>
          <span className="full-time-schedule-header__eyebrow">
            Lịch toàn thời gian
          </span>
          <h2 id="full-time-schedule-workspace-title">
            Ca cố định theo ngày làm việc
          </h2>
          <p>
            Xếp ca cố định theo tuần, kiểm tra phân công và công bố lịch cho nhân sự
            toàn thời gian.
          </p>
        </div>
      </header>

      <div className="full-time-schedule-core">
        <ScheduleManagement />
      </div>

      <footer className="full-time-schedule-footer-note">
        <CalendarDays size={17} />
        <span>
          Đăng ký lịch được quản lý tại Trung tâm xử lý; màn hình này tập trung vào
          xếp ca và công bố lịch tuần.
        </span>
      </footer>
    </section>
  </ScheduleEmploymentScopeProvider>
);

export default FullTimeScheduleWorkspace;
