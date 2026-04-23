import React from "react";
import ScheduleManagement from "../../../Schedule/ScheduleManagement";
import "./SchedulePage.scss";

const SchedulePage = () => {
  return (
    <div className="staff-schedule-page">
      <ScheduleManagement readOnly />
    </div>
  );
};

export default SchedulePage;
