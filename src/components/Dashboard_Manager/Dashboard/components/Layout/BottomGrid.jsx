import React from "react";
import RecentOrders from "../RecentOrders";
import TopDishes from "../TopDishes";
import "./BottomGrid.scss";

const BottomGrid = () => {
  return (
    <div className="bottom-grid fade-in-up">
      <div className="grid-item orders-section">
        <RecentOrders />
      </div>
      <div className="grid-item dishes-section">
        <TopDishes />
      </div>
    </div>
  );
};

export default BottomGrid;
