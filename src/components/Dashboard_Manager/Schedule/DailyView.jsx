import React from "react";
import { format } from "date-fns";
import { Clock, AlertCircle } from "lucide-react";
import "./DailyView.scss";
import { shiftTypes } from "./utils/scheduleHelpers";

const DailyView = ({ currentDate, shifts, staffList, shiftConfig = shiftTypes }) => {
  // 1. Lọc ca làm việc trong ngày
  const currentDateStr = format(currentDate, "yyyy-MM-dd");
  const dayShifts = shifts.filter((s) => s.date === currentDateStr);

  // 2. Cấu hình trục thời gian (6h -> 24h)
  const startHour = 6;
  const endHour = 24; // Hiển thị đến 24h
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => i + startHour
  );

  // Helper: Tính toán vị trí Left (%) và Width (%)
  const getHorizontalPosition = (start, end) => {
    const [sH, sM] = start.split(":").map(Number);
    const [eH, eM] = end.split(":").map(Number);

    const totalMinutesInDay = (endHour - startHour) * 60;
    const startMinutes = (sH - startHour) * 60 + sM;
    const durationMinutes = eH * 60 + eM - (sH * 60 + sM);

    const left = (startMinutes / totalMinutesInDay) * 100;
    const width = (durationMinutes / totalMinutesInDay) * 100;

    return { left: `${left}%`, width: `${width}%` };
  };

  const shiftRows = Object.entries(shiftConfig);

  return (
    <div className="daily-view-horizontal">
      {/* --- HEADER: TRỤC THỜI GIAN NGANG --- */}
      <div className="timeline-header">
        <div className="label-col">Ca / Giờ</div>
        <div className="time-scale">
          {hours.map((h) => (
            <div key={h} className="time-mark">
              <span>{h}:00</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- BODY: CÁC DÒNG (TRACKS) --- */}
      <div className="timeline-body">
        {/* Lưới dọc mờ làm nền (Background Grid) */}
        <div className="grid-background">
          <div className="label-placeholder"></div>
          <div className="grid-lines">
            {hours.map((h) => (
              <div key={h} className="line"></div>
            ))}
          </div>
        </div>

        {shiftRows.map(([type, config]) => (
          <div className="timeline-row" key={type}>
            <div className="row-label">
              <div className={`icon ${type}`}>{config.icon || "⏱️"}</div>
              <span>{config.label}</span>
            </div>
            <div className="row-track">
              {dayShifts
                .filter((shift) => shift.shiftType === type)
                .map((shift) => (
                  <ShiftItem
                    key={shift.id}
                    shift={shift}
                    staffList={staffList}
                    getPos={getHorizontalPosition}
                  />
                ))}
            </div>
          </div>
        ))}

        {/* Hiển thị thông báo nếu không có ca */}
        {dayShifts.length === 0 && (
          <div className="empty-state">Chưa có lịch làm việc cho ngày này</div>
        )}
      </div>
    </div>
  );
};

// Component con để render từng thẻ Shift nhỏ gọn
const ShiftItem = ({ shift, staffList, getPos }) => {
  const { left, width } = getPos(shift.startTime, shift.endTime);
  const missingStaff = shift.essentialJobs.length - shift.staffIds.length;
  const isWarning = missingStaff > 0;

  return (
    <div
      className={`shift-item-horizontal ${isWarning ? "warning" : "success"}`}
      style={{ left, width }}
      title={`${shift.startTime} - ${shift.endTime}`}
    >
      <div className="shift-content">
        <div className="time-badge">
          <Clock size={10} /> {shift.startTime}-{shift.endTime}
        </div>
        <div className="staff-avatars">
          {shift.staffIds.slice(0, 3).map((id) => {
            const s = staffList.find((x) => x.id === id);
            return s ? (
              <div key={id} className="avatar-dot" title={s.name}>
                {s.name.charAt(0)}
              </div>
            ) : null;
          })}
          {shift.staffIds.length > 3 && (
            <div className="avatar-more">+{shift.staffIds.length - 3}</div>
          )}
        </div>
        {isWarning && (
          <div className="warning-badge">
            <AlertCircle size={10} /> Thiếu {missingStaff}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyView;
