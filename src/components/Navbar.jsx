// src/components/Navbar.jsx
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import "../styles/navbar.scss";

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="navbar">
      <div className="logo">
        <img src="/src/assets/logo.png" alt="Logo" />
      </div>
      <div className="nav-links">
        <a href="/" className="nav-link">
          HOME
        </a>
        <a href="/about" className="nav-link">
          ABOUT US
        </a>
        <a href="/contact" className="nav-link">
          CONTACT
        </a>
        {user ? (
          <div className="avatar-container">
            <img
              src={user.avatar || "/default-avatar.png"}
              alt="Avatar"
              onClick={() => setShowDropdown(!showDropdown)}
            />
            {showDropdown && (
              <ul className="dropdown">
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
                  <FontAwesomeIcon icon={faSignOutAlt} />
                </li>
              </ul>
            )}
          </div>
        ) : (
          <button className="login-btn" onClick={() => navigate("/login")}>
            LOG IN
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
