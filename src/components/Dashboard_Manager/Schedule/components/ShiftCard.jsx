import React from "react";
import "./ShiftCard.scss";
import { getJobName } from "../utils/scheduleHelpers";
import { Clock, AlertCircle } from "lucide-react";

// Helper map màu job sang CSS variables hoặc class
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

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase();
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
    .map((id) => staffList.find((s) => s.id === id))
    .filter(Boolean);
  const totalRequired = Math.max(shift.essentialJobs.length, 1);
  const currentCount = assignedStaff.length;
  const missingCount = Math.max(0, totalRequired - currentCount);
  const surplusCount = Math.max(0, currentCount - totalRequired);
  const visibleStaff = assignedStaff.slice(0, MAX_VISIBLE_STAFF);
  const hiddenStaffCount = Math.max(
    0,
    assignedStaff.length - MAX_VISIBLE_STAFF,
  );
  const coverageLabel =
    missingCount > 0
      ? `Thiếu ${missingCount}`
      : surplusCount > 0
        ? `Dư +${surplusCount}`
        : "Đủ yêu cầu";
  const isCritical = missingCount > 0;
  return (
    <div
      className={`shift-card ${isCritical ? "critical" : "optimal"}`}
      onClick={() => onClick(shift)}
    >
      {/* 1. Header: Thời gian & Cảnh báo */}
      <div className="card-header">
        <div className="time-badge">
          <Clock size={12} />
          <span>
            {shift.startTime} - {shift.endTime}
          </span>
        </div>
        {isCritical && (
          <div className="alert-icon" title={`Thiếu ${missingCount} nhân sự`}>
            <AlertCircle size={14} />
          </div>
        )}
      </div>

      {/* 2. Body: Avatar Stack & Ghost Slots */}
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
              className={`avatar-wrapper avatar-tone-${index % 5}`}
              title={`${staff.name} - ${getJobName(staff.roleSlug || staff.job)} · ${
                staff.departmentLabel || "Khác"
              }`}
            >
              <span>{getInitials(staff.name)}</span>
            </div>
          ))}

          {hiddenStaffCount > 0 ? (
            <div className="avatar-wrapper more" title="Bấm để xem chi tiết ca">
              <span>+{hiddenStaffCount}</span>
            </div>
          ) : null}

          {Array.from({ length: Math.min(2, missingCount) }).map((_, idx) => (
            <div key={`ghost-${idx}`} className="avatar-wrapper ghost">
              <span>?</span>
            </div>
          ))}
        </div>

        <div className="staff-summary">
          <span className="staff-count">{currentCount} nhân sự</span>

          {isCritical ? (
            <span className="text-danger">Thiếu {missingCount}</span>
          ) : surplusCount > 0 ? (
            <span className="text-good">Dư +{surplusCount}</span>
          ) : (
            <span className="text-good">Đủ yêu cầu</span>
          )}
        </div>
      </div>

      {/* 3. Footer: Job Pills (Rút gọn) */}
      <div className="card-footer">
        <div className="job-dots">
          {shift.essentialJobs.slice(0, 4).map((job, idx) => (
            <span
              key={idx}
              className={`job-dot ${getJobClass(job)}`}
              title={getJobName(job)}
            ></span>
          ))}
          {shift.essentialJobs.length > 4 && (
            <span className="job-more">+{shift.essentialJobs.length - 4}</span>
          )}
        </div>
        {/* Nút hành động ẩn (chỉ hiện khi hover card cha bên CSS) */}
        <div className="hover-action">Chi tiết &rarr;</div>
      </div>
    </div>
  );
};

export default ShiftCard;
