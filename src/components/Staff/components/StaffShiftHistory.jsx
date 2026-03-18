import React from "react";
import { ArrowLeft, MapPin, Clock } from "lucide-react";
import "./StaffProfileDetails.scss";

const fmtDateTime = (v) =>
  v
    ? new Date(v).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const getStatusClass = (status) => {
  const s = String(status).toLowerCase();
  if (s.includes("completed") || s.includes("hoàn thành")) return "completed";
  if (s.includes("pending") || s.includes("đang chờ")) return "pending";
  return "default";
};

export default function StaffShiftHistory({ shifts, onBack }) {
  return (
    <div className="detail-page-wrapper">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={24} className="icon-back" /> Lịch sử ca làm
        </button>
      </div>

      <div className="detail-content">
        {(shifts || []).length === 0 ? (
          <div
            className="info-card"
            style={{ textAlign: "center", color: "#6b7280" }}
          >
            Chưa có dữ liệu ca làm việc
          </div>
        ) : (
          shifts.map((s) => (
            <div className="shift-card" key={s.id}>
              <div className="shift-header">
                <div className="shift-title-group">
                  <span className="shift-type">
                    {s.shiftType || "Ca làm việc"}
                  </span>
                  <span className="shift-location">
                    <MapPin size={12} /> {s.restaurant?.name || "—"}
                  </span>
                </div>
                <span className={`status-badge ${getStatusClass(s.status)}`}>
                  {s.status || "N/A"}
                </span>
              </div>

              <div className="shift-time">
                <Clock size={16} className="text-primary" />
                {fmtDateTime(s.startTime)} ➔ {fmtDateTime(s.endTime)}
              </div>

              {s.notes && <div className="shift-notes">Ghi chú: {s.notes}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
