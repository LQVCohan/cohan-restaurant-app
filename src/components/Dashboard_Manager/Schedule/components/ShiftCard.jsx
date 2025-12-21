import React from "react";
import "./ShiftCard.scss";
import { getAvatarUrl } from "../utils/scheduleHelpers";
import { Clock, AlertCircle } from "lucide-react";

// Helper map màu job sang CSS variables hoặc class
const getJobClass = (job) => {
  const map = {
    chef: "job-purple",
    cook: "job-indigo",
    waiter: "job-blue",
    bartender: "job-pink",
    cashier: "job-teal",
    cleaner: "job-gray",
    host: "job-orange",
  };
  return map[job] || "job-gray";
};

const getJobLabel = (job) => {
  const map = {
    chef: "Bếp trưởng",
    cook: "Bếp",
    waiter: "Phục vụ",
    bartender: "Pha chế",
    cashier: "Thu ngân",
    cleaner: "Tạp vụ",
    host: "Lễ tân",
  };
  return map[job] || job;
};

const ShiftCard = ({ shift, staffList, onClick }) => {
  const assignedStaff = shift.staffIds
    .map((id) => staffList.find((s) => s.id === id))
    .filter(Boolean);

  const totalRequired = shift.essentialJobs.length;
  const currentCount = assignedStaff.length;
  const missingCount = Math.max(0, totalRequired - currentCount);

  // Logic trạng thái
  const isCritical = missingCount > 0;
  const isFull = missingCount === 0;

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
        <div className="staff-visuals">
          {/* Render nhân viên đã gán */}
          {assignedStaff.slice(0, 4).map((staff) => (
            <div key={staff.id} className="avatar-wrapper">
              <img
                src={getAvatarUrl(staff.name)}
                alt={staff.name}
                title={`${staff.name} - ${getJobLabel(staff.job)}`}
              />
            </div>
          ))}

          {/* Render số lượng ẩn nếu quá nhiều */}
          {assignedStaff.length > 4 && (
            <div className="avatar-wrapper more">
              <span>+{assignedStaff.length - 4}</span>
            </div>
          )}

          {/* Render Ghost Slots (Vị trí trống) */}
          {Array.from({ length: Math.min(3, missingCount) }).map((_, idx) => (
            <div key={`ghost-${idx}`} className="avatar-wrapper ghost">
              <span>?</span>
            </div>
          ))}
        </div>

        {/* Text summary */}
        <div className="staff-summary">
          <span className={isCritical ? "text-danger" : "text-sub"}>
            {currentCount}/{totalRequired} Nhân sự
          </span>
        </div>
      </div>

      {/* 3. Footer: Job Pills (Rút gọn) */}
      <div className="card-footer">
        <div className="job-dots">
          {shift.essentialJobs.slice(0, 4).map((job, idx) => (
            <span
              key={idx}
              className={`job-dot ${getJobClass(job)}`}
              title={getJobLabel(job)}
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
