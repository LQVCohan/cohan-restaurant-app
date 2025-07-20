import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.scss";

const Home = () => {
  const navigate = useNavigate();

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
          <button onClick={() => navigate("/login")}>LOG IN</button>
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
