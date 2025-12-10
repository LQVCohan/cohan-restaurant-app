import React from "react";
import "./ShiftCard.scss"; // Import trực tiếp style của component này
import {
  getJobName,
  getAvatarUrl,
  getJobColor,
} from "../utils/scheduleHelpers";

const ShiftCard = ({ shift, staffList, onClick }) => {
  const assignedStaff = shift.staffIds
    .map((id) => staffList.find((s) => s.id === id))
    .filter(Boolean);
  const missingCount = shift.essentialJobs.length - assignedStaff.length;
  const isWarning = missingCount > 0;

  return (
    <div
      className={`shift-card ${isWarning ? "incomplete" : "complete"}`}
      onClick={() => onClick(shift)}
    >
      <div className="card-header">
        <div className="time-wrapper">
          <div className="status-dot"></div>
          <span>
            {shift.startTime} - {shift.endTime}
          </span>
        </div>
      </div>

      <div
        className="flex items-center justify-between mt-2"
        style={{ display: "flex", alignItems: "center" }}
      >
        <div className="avatar-stack">
          {assignedStaff.slice(0, 3).map((staff) => (
            <img
              key={staff.id}
              src={getAvatarUrl(staff.name)}
              alt={staff.name}
              title={staff.name}
            />
          ))}
          {assignedStaff.length > 3 && (
            <div className="more-count">+{assignedStaff.length - 3}</div>
          )}
          {assignedStaff.length === 0 && (
            <span className="empty-text">Trống</span>
          )}
        </div>

        {isWarning && <div className="missing-badge">-{missingCount}</div>}
      </div>

      <div className="job-pills">
        {shift.essentialJobs.slice(0, 3).map((job, idx) => (
          <span
            key={idx}
            style={{ color: getJobColor(job), backgroundColor: "#f9fafb" }}
          >
            {getJobName(job).split(" ")[0]}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ShiftCard;
