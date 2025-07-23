// src/components/RestaurantDetail.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/RestaurantDetail.scss"; // Import SCSS for styling

const RestaurantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const response = await axios.get(`/api/restaurants/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRestaurant(response.data);
      } catch (err) {
        setError(
          "Lỗi khi lấy thông tin nhà hàng: " +
            (err.response?.data?.error || err.message)
        );
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurant();
  }, [id, token]);

  const handleBookTable = () => {
    if (restaurant.emptyTables > 0) {
      navigate(`/restaurants/${id}/layout`);
    } else {
      // Logic thông báo khi có bàn trống (có thể dùng socket hoặc API)
      alert("Bạn sẽ được thông báo khi có bàn trống.");
    }
  };

  const handleBack = () => {
    navigate("/restaurants");
  };

  if (loading)
    return <div className="loading">Đang tải thông tin nhà hàng...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!restaurant) return <div className="error">Nhà hàng không tồn tại.</div>;

  return (
    <div className="restaurant-detail-page">
      <button className="back-button" onClick={handleBack}>
        Trở về danh sách
      </button>
      <div className="cover-section">
        <img
          src={restaurant.coverImage || "/default-cover.png"}
          alt="Ảnh bìa nhà hàng"
          className="cover-image"
        />
        <img
          src={restaurant.image || "/default-restaurant.png"}
          alt="Ảnh đại diện nhà hàng"
          className="avatar-image"
        />
      </div>
      <div className="details-section">
        <h1>{restaurant.name}</h1>
        <p className="description">
          {restaurant.description || "Mô tả nhà hàng chưa có."}
        </p>
        <p>
          <strong>Tên quản lý:</strong>{" "}
          {restaurant.managerName || "Chưa chỉ định"}
        </p>
        <p>
          <strong>Số điện thoại:</strong> {restaurant.phone}
        </p>
        <p>
          <strong>Địa chỉ:</strong> {restaurant.address}
        </p>
        <p>
          <strong>Giờ mở cửa:</strong> {restaurant.openingHours}
        </p>
        <div className="promotions">
          <strong>Chương trình khuyến mãi:</strong>
          <p>{restaurant.promotions || "Không có khuyến mãi hiện tại."}</p>
        </div>
        <div className="menu-section">
          <strong>Menu:</strong>
          <select className="menu-select">
            {restaurant.menus.map((menu) => (
              <option key={menu._id} value={menu._id}>
                {menu.category}
              </option>
            ))}
          </select>
          {/* Có thể thêm chi tiết menu ở đây nếu cần */}
        </div>
      </div>
      <button
        className="book-table-button"
        onClick={handleBookTable}
        disabled={restaurant.emptyTables === 0}
      >
        {restaurant.emptyTables > 0 ? "Đặt bàn" : "Thông báo khi có bàn trống"}
      </button>
    </div>
  );
};

export default RestaurantDetail;
