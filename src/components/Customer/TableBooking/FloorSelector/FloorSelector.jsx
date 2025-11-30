import React from "react";
import "./FloorSelector.scss";

const FloorSelector = ({ floors, selectedFloor, onSelect }) => {
  return (
    <div className="floor-selector-tabs">
      {floors.map((floor) => (
        <button
          key={floor.id}
          className={`floor-tab ${
            selectedFloor?.id === floor.id ? "active" : ""
          }`}
          onClick={() => onSelect(floor)}
        >
          {floor.name}
        </button>
      ))}
    </div>
  );
};

export default FloorSelector;
