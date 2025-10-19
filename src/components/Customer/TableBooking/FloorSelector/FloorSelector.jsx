import React from "react";
import "./FloorSelector.scss";

const FloorSelector = ({ floors, selectedFloor, onSelect }) => {
  return (
    <div className="floor-selector">
      <h3 className="floor-selector__title">Chọn tầng</h3>
      <div className="floor-selector__buttons">
        {floors.map((floor) => (
          <button
            key={floor.id}
            className={`floor-selector__button ${
              selectedFloor?.id === floor.id ? "floor-selector__button--active" : ""
            }`}
            onClick={() => onSelect(floor)}
          >
            <div className="floor-selector__button-content">
              <span className="floor-selector__icon">{floor.icon}</span>
              <div className="floor-selector__info">
                <div className="floor-selector__name">{floor.name}</div>
                <div className="floor-selector__count">{floor.tables} bàn</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FloorSelector;
