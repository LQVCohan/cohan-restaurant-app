import React from "react";
import RecentOrders from "../RecentOrders";
import TopDishes from "../TopDishes";
import "./BottomGrid.scss";

const BottomGrid = () => {
  return (
    <div className="bottom-grid">
      <RecentOrders />
      <TopDishes />
    </div>
  );
};

export default BottomGrid;
