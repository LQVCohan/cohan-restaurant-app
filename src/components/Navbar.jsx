import React, { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);
  const [showDropdown, setShowDropdown] = useState(false);
  const isHome = location.pathname === "/";
  const navbarStyle = { height: isHome ? "80px" : "60px" };

  return (
    <nav className="navbar" style={navbarStyle}>
      <div className="logo">
        <img src="/src/assets/logo.png" alt="Logo" style={{ height: "40px" }} />
      </div>
      <div className="nav-links">
        <a href="/">HOME</a>
        <a href="/about">ABOUT US</a>
        <a href="/contact">CONTACT</a>
        {user ? (
          <div style={{ position: "relative" }}>
            <img
              src={user.avatar}
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
                }}
              >
                <li onClick={() => navigate("/profile")}>Thông tin cá nhân</li>
                <li onClick={() => navigate("/reserved-tables")}>Bàn đã đặt</li>
                <li onClick={() => navigate("/order-history")}>
                  Lịch sử đặt bàn
                </li>
                <li onClick={() => navigate("/vouchers")}>Voucher</li>
                <li onClick={logout}>Đăng xuất</li>
              </ul>
            )}
          </div>
        ) : (
          <button onClick={() => navigate("/login")}>LOG IN</button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
