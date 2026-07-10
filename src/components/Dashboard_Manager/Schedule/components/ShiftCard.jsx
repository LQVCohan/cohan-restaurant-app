import React from "react";
import "./ShiftCard.scss";
import { getJobName } from "../utils/scheduleHelpers";
import { Clock, AlertCircle } from "lucide-react";

const getJobClass = (job) => {
  const map = {
    chef: "job-purple",
    cook: "job-indigo",
    kitchen_helper: "job-indigo",
    server: "job-blue",
    supervisor: "job-teal",
    bartender: "job-pink",
    cashier: "job-teal",
    cleaner: "job-gray",
    host: "job-orange",
    shipper: "job-blue",
    storekeeper: "job-gray",
  };
  return map[job] || "job-gray";
};

const MAX_VISIBLE_STAFF = 3;

const getInitials = (name = "") => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase();
};

const parseTimeToMinutes = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const formatHours = (hours) =>
  (Number.isInteger(hours) ? String(hours) : hours.toFixed(1)).replace(".", ",");

export const getShiftDurationMeta = (startTime, endTime) => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return null;

  let durationMinutes = end - start;
  if (durationMinutes <= 0) durationMinutes += 24 * 60;
  const durationHours = durationMinutes / 60;
  const hoursLabel = `${formatHours(durationHours)} giờ`;

  if (durationHours >= 3.5 && durationHours <= 4.5) {
    return { tone: "part-time", label: `Bán thời gian · ${hoursLabel}` };
  }
  if (durationHours >= 7 && durationHours <= 9) {
    return { tone: "full-time", label: `Toàn thời gian · ${hoursLabel}` };
  }
  return { tone: "flexible", label: `Ca linh hoạt · ${hoursLabel}` };
};

const getStaffTitle = (staff) => {
  const roleLabel = getJobName(staff.roleSlug || staff.job);
  const departmentLabel = staff.departmentLabel;
  if (!departmentLabel || departmentLabel === roleLabel) {
    return `${staff.name} - ${roleLabel}`;
  }
  return `${staff.name} - ${roleLabel} · ${departmentLabel}`;
};

const ShiftCard = ({ shift, staffList, onClick }) => {
  const assignedStaff = shift.staffIds
    .map((id) => staffList.find((staff) => staff.id === id))
    .filter(Boolean);
  const totalRequired = Math.max(shift.essentialJobs.length, 1);
  const currentCount = assignedStaff.length;
  const missingCount = Math.max(0, totalRequired - currentCount);
  const surplusCount = Math.max(0, currentCount - totalRequired);
  const visibleStaff = assignedStaff.slice(0, MAX_VISIBLE_STAFF);
  const hiddenStaffCount = Math.max(0, assignedStaff.length - MAX_VISIBLE_STAFF);
  const coverageLabel =
    missingCount > 0
      ? `Thiếu ${missingCount}`
      : surplusCount > 0
        ? `Dư +${surplusCount}`
        : "Đủ yêu cầu";
  const isCritical = missingCount > 0;
  const durationMeta = getShiftDurationMeta(shift.startTime, shift.endTime);

  return (
    <button
      type="button"
      className={`shift-card ${isCritical ? "critical" : "optimal"}`}
      onClick={() => onClick(shift)}
      aria-label={`Xem chi tiết ca ${shift.startTime} - ${shift.endTime}${durationMeta ? `, ${durationMeta.label}` : ""}, ${currentCount} nhân sự, ${coverageLabel}`}
    >
      <div className="card-header">
        <div className="shift-time-group">
          <div className="time-badge">
            <Clock size={12} />
            <span>
              {shift.startTime} - {shift.endTime}
            </span>
          </div>
          {durationMeta ? (
            <span
              className={`shift-duration-badge ${durationMeta.tone}`}
              title="Phân loại theo thời lượng ca"
            >
              {durationMeta.label}
            </span>
          ) : null}
        </div>
        {isCritical && (
          <div className="alert-icon" title={`Thiếu ${missingCount} nhân sự`}>
            <AlertCircle size={14} />
          </div>
        )}
      </div>

      <div className="card-body">
        <div
          className="staff-visuals"
          title={
            assignedStaff.length
              ? assignedStaff.map((staff) => staff.name).join(", ")
              : "Chưa có nhân viên"
          }
        >
          {visibleStaff.map((staff, index) => (
            <div
              key={staff.id}
              className={`avatar-wrapper staff-avatar avatar-tone-${index % 5}`}
              title={getStaffTitle(staff)}
              aria-label={getStaffTitle(staff)}
            >
              <span className="avatar-initials">{getInitials(staff.name)}</span>
            </div>
          ))}

          {hiddenStaffCount > 0 ? (
            <div
              className="avatar-wrapper more"
              title={`${hiddenStaffCount} nhân viên khác`}
            >
              <span className="avatar-initials">+{hiddenStaffCount}</span>
            </div>
          ) : null}

          {Array.from({ length: Math.min(2, missingCount) }).map((_, index) => (
            <div key={`ghost-${index}`} className="avatar-wrapper ghost">
              <span className="avatar-initials">?</span>
            </div>
          ))}
        </div>

        <div className="staff-summary">
          <span className="staff-count">{currentCount} nhân sự</span>
          <span
            className={`staff-coverage ${isCritical ? "text-danger" : "text-good"}`}
          >
            {coverageLabel}
          </span>
        </div>
      </div>

      <div className="card-footer">
        <div className="job-dots">
          {shift.essentialJobs.slice(0, 4).map((job, index) => (
            <span
              key={index}
              className={`job-dot ${getJobClass(job)}`}
              title={getJobName(job)}
            />
          ))}
          {shift.essentialJobs.length > 4 && (
            <span className="job-more">+{shift.essentialJobs.length - 4}</span>
          )}
        </div>
        <div className="hover-action" aria-hidden="true">
          Xem chi tiết →
        </div>
      </div>
    </button>
  );
};

export default ShiftCard;
