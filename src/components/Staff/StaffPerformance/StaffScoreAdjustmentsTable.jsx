import React from "react";

const StaffScoreAdjustmentsTable = ({ adjustments = [] }) => {
  if (!adjustments.length) return <p>Chưa có điểm nào được áp dụng.</p>;

  return (
    <table className="staff-performance-table">
      <thead>
        <tr>
          <th>Ngày</th><th>Lý do/Sự kiện</th><th>Delta</th><th>Điểm cũ</th><th>Điểm mới</th><th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {adjustments.map((item) => (
          <tr key={item.id}>
            <td>{item.appliedAt ? new Date(item.appliedAt).toLocaleString("vi-VN") : "-"}</td>
            <td>{item.reason || item.eventType || "-"}</td>
            <td>{item.scoreDelta}</td>
            <td>{item.previousScore ?? "-"}</td>
            <td>{item.newScore ?? "-"}</td>
            <td>{item.note || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default StaffScoreAdjustmentsTable;
