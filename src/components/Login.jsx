import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import "../styles/login.scss";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      console.log("Sending login request:", { email });
      const response = await axios.post("/api/auth/login", { email, password });
      console.log("Login response:", response.data);
      const { token, role, restaurantId, avatar } = response.data;

      if (!role) throw new Error("Role không được trả về từ server");
      console.log(
        "Navigating to:",
        role === "admin"
          ? "/admin/dashboard"
          : role === "manager" && restaurantId
          ? `/restaurants/${restaurantId}/layout`
          : "/staff/orders"
      );

      login(token, role, avatar);

      if (rememberMe) {
        localStorage.setItem("token", token);
        sessionStorage.removeItem("token");
      } else {
        sessionStorage.setItem("token", token);
        localStorage.removeItem("token");
      }
      console.log("Stored token:", token, "Role:", role);

      if (role === "admin") {
        navigate("/admin/dashboard");
      } else if (role === "manager" && restaurantId) {
        navigate(`/restaurants/${restaurantId}/layout`);
      } else {
        navigate("/");
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Đã xảy ra lỗi khi đăng nhập";
      setError(errorMessage);
      console.error("Lỗi đăng nhập:", error);
    }
  };

  return (
    <div className="login-container">
      <nav className="navbar">
        <div className="logo">
          <img src="/src/assets/logo.png" alt="Logo" />
        </div>
        <div className="nav-links">
          <a href="/">HOME</a>
          <a href="/about">ABOUT US</a>
          <a href="/contact">CONTACT</a>
          <a href="/login">LOG IN</a>
        </div>
      </nav>
      <div className="content">
        <div className="login-form">
          <div className="login-card">
            <h2>Đăng nhập</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <span className="icon">👤</span>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <span className="icon">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span
                  className="eye-icon"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </span>
              </div>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <a href="/forgot-password">Quên mật khẩu?</a>
              </div>
              <button type="submit">Đăng nhập</button>
              <p className="signup-text">
                hoặc <a href="/signup">Đăng ký</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
