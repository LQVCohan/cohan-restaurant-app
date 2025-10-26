import React from "react";
import "./MenuItem.scss";

export default function MenuItem({ item, onAdd }) {
  return (
    <div
      className="menu-item"
      role="button"
      onClick={() => onAdd?.(item)}
      tabIndex={0}
    >
      <div className="menu-item-image">
        <div className="menu-item-emoji">{item.emoji || "🍽️"}</div>
      </div>
      <div className="menu-item-info">
        <div className="menu-item-name">{item.name}</div>
        <div className="menu-item-price">
          {item.price?.toLocaleString?.("vi-VN")}₫
        </div>
        {item.description ? (
          <div className="menu-item-description">{item.description}</div>
        ) : null}
      </div>
    </div>
  );
}
