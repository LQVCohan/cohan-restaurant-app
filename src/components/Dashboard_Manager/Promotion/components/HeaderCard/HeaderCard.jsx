import React from "react";
import { Store, Ticket, Activity, TrendingUp, Gift } from "lucide-react";
import "./HeaderCard.scss";

const HeaderCard = ({
  stats,
  selectedRestaurant,
  onRestaurantChange,
  restaurants = [],
}) => {
  return (
    <div className="header-card">
      <div className="header-top">
        <div className="title-section">
          <div className="icon-box">
            <Gift size={24} color="#fff" />
          </div>
          <div className="text-content">
            <h1>Quan Ly Khuyen Mai</h1>
            <p className="subtitle">He thong toi uu doanh thu Cohan</p>
          </div>
        </div>

        <div className="action-section">
          <div className="custom-select-wrapper">
            <Store size={16} className="select-icon" />
            <select
              className="restaurant-selector"
              value={selectedRestaurant}
              onChange={(event) => onRestaurantChange(event.target.value)}
              disabled={!restaurants.length}
            >
              {restaurants.length ? (
                restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name || `Nha hang ${restaurant.id}`}
                  </option>
                ))
              ) : (
                <option value="">Chua co nha hang kha dung</option>
              )}
            </select>
            <div className="arrow-icon" />
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="header-bottom">
        <div className="stat-card blue">
          <div className="stat-icon">
            <Ticket size={22} />
          </div>
          <div className="stat-content">
            <span className="label">Tổng Coupon</span>
            <span className="value">{stats.total}</span>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon">
            <Activity size={22} />
          </div>
          <div className="stat-content">
            <span className="label">Dang chay</span>
            <span className="value">{stats.active}</span>
          </div>
        </div>

        <div className="stat-card orange">
          <div className="stat-icon">
            <TrendingUp size={22} />
          </div>
          <div className="stat-content">
            <span className="label">Luot su dung</span>
            <span className="value">{stats.totalUsage}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderCard;
