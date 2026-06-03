import React from "react";

const StaffScoreAdjustmentsTable = ({ adjustments = [] }) => {
  if (!adjustments.length) {
    return (
      <div className="staff-performance-empty">
        <h3>Chưa có điểm nào được áp dụng</h3>
        <p>Các điều chỉnh đã duyệt sẽ xuất hiện tại đây để bạn đối chiếu.</p>
      </div>
    );
  }

  return (
    <div className="staff-performance-table-wrap">
      <table className="staff-performance-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Lý do / sự kiện</th>
            <th>Delta</th>
            <th>Điểm cũ</th>
            <th>Điểm mới</th>
            <th>Ghi chú</th>
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
    </div>
  );
};

export default StaffScoreAdjustmentsTable;
