// src/components/Home.jsx
import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../styles/home.scss";

const Home = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="logo">
          <img
            src="/src/assets/logo.png"
            alt="Logo"
            style={{ height: "40px" }}
          />
        </div>
        <div className="nav-links">
          <a href="/">HOME</a>
          <a href="/about">ABOUT US</a>
          <a href="/contact">CONTACT</a>
          {user ? (
            <div className="avatar-container" style={{ position: "relative" }}>
              <img
                src={user.avatar || "/default-avatar.png"}
                alt="Avatar"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  cursor: "pointer",
                }}
                onClick={() => setShowDropdown(!showDropdown)}
              />
              {showDropdown && (
                <ul
                  style={{
                    position: "absolute",
                    right: 0,
                    background: "#fff",
                    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                    listStyle: "none",
                    padding: "10px",
                    borderRadius: "4px",
                    zIndex: 1000,
                  }}
                >
                  <li
                    onClick={() => {
                      navigate("/profile");
                      setShowDropdown(false);
                    }}
                  >
                    Thông tin cá nhân
                  </li>
                  <li
                    onClick={() => {
                      navigate("/reserved-tables");
                      setShowDropdown(false);
                    }}
                  >
                    Bàn đã đặt
                  </li>
                  <li
                    onClick={() => {
                      navigate("/order-history");
                      setShowDropdown(false);
                    }}
                  >
                    Lịch sử đặt bàn
                  </li>
                  <li
                    onClick={() => {
                      navigate("/vouchers");
                      setShowDropdown(false);
                    }}
                  >
                    Voucher
                  </li>
                  <li
                    onClick={() => {
                      logout();
                      setShowDropdown(false);
                    }}
                  >
                    Đăng xuất
                  </li>
                </ul>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("/login")}>LOG IN</button>
          )}
        </div>
      </nav>
      <div className="hero-section">
        <h1>Chào mừng đến với Cohan Restaurant</h1>
        <p>Hãy khám phá menu ngon miệng và đặt bàn ngay hôm nay!</p>
        <div className="buttons">
          <button onClick={() => navigate("/order")}>ĐẶT MÓN</button>
          <button onClick={() => navigate("/restaurants")}>
            TRA CỨU NHÀ HÀNG
          </button>
        </div>
      </div>
      <footer>© 2025 Cohan Restaurant. All rights reserved.</footer>
    </div>
  );
};

export default Home;
