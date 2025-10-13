import React from "react";
import TableItem from "../TableItem/TableItem";
import "./TableGrid.scss";

const TableGrid = ({
  tables,
  selectedDate,
  selectedTimeSlot,
  guestCount,
  onTableSelect,
  getTableAvailability,
}) => {
  // Group tables by area
  const tablesByArea = tables.reduce((acc, table) => {
    const area = table.area || "Khu vực chính";
    if (!acc[area]) {
      acc[area] = [];
    }
    acc[area].push(table);
    return acc;
  }, {});

  if (tables.length === 0) {
    return (
      <div className="table-grid-empty">
        <div className="empty-icon">🪑</div>
        <h3>Không có bàn nào</h3>
        <p>Vui lòng chọn ngày và giờ để xem bàn trống.</p>
      </div>
    );
  }

  return (
    <div className="table-grid">
      {Object.entries(tablesByArea).map(([area, areaTables]) => (
        <div key={area} className="table-area">
          <h3 className="area-title">📍 {area}</h3>

          <div className="area-tables">
            {areaTables.map((table) => {
              const availability = getTableAvailability(
                table.id,
                selectedDate,
                selectedTimeSlot
              );
              const isRecommended =
                table.capacity >= guestCount &&
                table.capacity <= guestCount + 2 &&
                availability.isAvailable;

              return (
                <TableItem
                  key={table.id}
                  table={table}
                  availability={availability}
                  isRecommended={isRecommended}
                  guestCount={guestCount}
                  onClick={() => onTableSelect(table)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TableGrid;
