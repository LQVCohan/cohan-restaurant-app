import React from "react";
import { BriefcaseBusiness, CalendarDays, ShieldCheck } from "lucide-react";
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
            Xếp ca cho nhân sự toàn thời gian theo ngày làm việc đã cấu hình, kiểm
            tra thiếu người và công bố lịch theo tuần trong một workspace riêng.
          </p>
        </div>
        <div className="full-time-schedule-header__status">
          <span>
            <BriefcaseBusiness size={15} /> Toàn thời gian
          </span>
          <strong>
            <ShieldCheck size={15} /> Không trộn với block bán thời gian hoặc ca xoay
          </strong>
        </div>
      </header>

      <div className="full-time-schedule-core">
        <ScheduleManagement />
      </div>

      <footer className="full-time-schedule-footer-note">
        <CalendarDays size={17} />
        <span>
          Đăng ký lịch theo workspace được quản lý tại Trung tâm xử lý; khu vực
          lịch chính chỉ tập trung vào xếp ca và kiểm tra vận hành.
        </span>
      </footer>
    </section>
  </ScheduleEmploymentScopeProvider>
);

export default FullTimeScheduleWorkspace;
