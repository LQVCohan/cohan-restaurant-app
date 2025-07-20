// src/components/RestaurantsList.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/RestaurantsList.scss"; // Import the SCSS for styling

const RestaurantsList = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await axios.get("/api/restaurants", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRestaurants(response.data);
      } catch (err) {
        setError(
          "Lỗi khi lấy danh sách nhà hàng: " +
            (err.response?.data?.error || err.message)
        );
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, [token]);

  if (loading)
    return <div className="loading">Đang tải danh sách nhà hàng...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="restaurants-list">
      <h2>Danh sách nhà hàng</h2>
      {restaurants.length === 0 ? (
        <p>Không có nhà hàng nào hiện có.</p>
      ) : (
        restaurants.map((restaurant) => (
          <div key={restaurant._id} className="restaurant-item">
            <img
              src={restaurant.image || "/default-restaurant.png"}
              alt={restaurant.name}
            />
            <div className="restaurant-details">
              <h3>{restaurant.name}</h3>
              <p>Giờ mở cửa: {restaurant.openingHours}</p>
              <p>Món chủ đạo: {restaurant.signatureDishes.join(", ")}</p>
              <p className="highlight">Bàn trống: {restaurant.emptyTables}</p>
              <p>Số điện thoại: {restaurant.phone}</p>
              <p>Địa chỉ: {restaurant.address}</p>
            </div>
            <button
              className="book-button"
              onClick={() => navigate(`/restaurants/${restaurant._id}/layout`)}
            >
              Đặt bàn
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default RestaurantsList;
