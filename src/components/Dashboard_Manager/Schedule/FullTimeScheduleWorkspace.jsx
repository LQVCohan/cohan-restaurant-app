import React from "react";
import { BriefcaseBusiness, CalendarDays } from "lucide-react";
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
            Xếp ca cố định theo tuần cho nhân sự toàn thời gian và kiểm tra tình trạng
            phân công trước khi công bố.
          </p>
        </div>
        <div className="full-time-schedule-header__status">
          <span>
            <BriefcaseBusiness size={15} /> Toàn thời gian
          </span>
        </div>
      </header>

      <div className="full-time-schedule-core">
        <ScheduleManagement />
      </div>

      <footer className="full-time-schedule-footer-note">
        <CalendarDays size={17} />
        <span>
          Đăng ký lịch được quản lý tại Trung tâm xử lý; màn hình này chỉ dùng để xếp
          ca và công bố lịch tuần.
        </span>
      </footer>
    </section>
  </ScheduleEmploymentScopeProvider>
);

export default FullTimeScheduleWorkspace;
