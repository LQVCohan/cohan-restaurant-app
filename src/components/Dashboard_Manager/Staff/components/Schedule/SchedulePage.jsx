import React from "react";
import ScheduleManagement from "../../../Schedule/ScheduleManagement";
import "./SchedulePage.scss";

const SchedulePage = ({ restaurantId = "" }) => {
  return (
    <div className="staff-schedule-page">
      <ScheduleManagement readOnly restaurantId={restaurantId} />
    </div>
  );
};

export default SchedulePage;
