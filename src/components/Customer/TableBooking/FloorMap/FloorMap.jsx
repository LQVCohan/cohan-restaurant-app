import React from "react";
import "./FloorMap.scss";

const FloorMap = ({ tables, onSelectTable, selectedTable }) => {
  return (
    <div className="floor-map">
      <div className="floor-map__header">
        <h2 className="floor-map__title">
          <span className="floor-map__icon">🪑</span>
          Sơ đồ bàn
        </h2>
        <p className="floor-map__description">Chọn bàn còn trống để đặt chỗ.</p>
      </div>

      <div className="floor-map__container">
        <div className="floor-map__wall floor-map__wall--top"></div>
        <div className="floor-map__wall floor-map__wall--bottom"></div>
        <div className="floor-map__wall floor-map__wall--left"></div>
        <div className="floor-map__wall floor-map__wall--right"></div>

        <div className="floor-map__door" style={{ top: "20px", left: "50%" }} />
        <div
          className="floor-map__window"
          style={{ bottom: "40px", right: "60px" }}
        />

        {tables.map((table) => (
          <div
            key={table.id}
            className={`floor-map__table floor-map__table--${table.status} ${
              selectedTable?.id === table.id ? "floor-map__table--selected" : ""
            }`}
            style={{ top: table.position.y, left: table.position.x }}
            onClick={() => table.status === "available" && onSelectTable(table)}
          >
            {table.label}
            <div className="floor-map__table-capacity">{table.capacity}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FloorMap;
