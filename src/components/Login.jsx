// src/pages/LoginPage.jsx
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { gql, useMutation } from "@apollo/client";

import { AuthContext } from "../context/AuthContext";
import "../styles/Login.scss";

// ✅ GraphQL mutation
const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        name
        email
        roleNames
      }
    }
  }
`;

const LoginPage = () => {
  const [activeTab, setActiveTab] = useState("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "" });
  const [error, setError] = useState("");

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });

  const navigate = useNavigate();
  const { login: authLogin } = useContext(AuthContext);

  // 🔗 Apollo useMutation
  const [loginMutation, { loading: loginLoading }] = useMutation(
    LOGIN_MUTATION,
    {
      onError: (e) => {
        // Lấy message thân thiện
        const msg =
          e?.graphQLErrors?.[0]?.message ||
          e?.networkError?.message ||
          "Đã xảy ra lỗi khi đăng nhập";
        setError(msg);
        // eslint-disable-next-line no-console
        console.error("Login GQL error:", e);
      },
      onCompleted: (data) => {
        const { token, user } = data?.login || {};
        // Map role theo backend GraphQL: user.roleNames là mảng
        const role = user?.roleNames?.[0] || "customer";
        const avatar = null; // (chưa có từ API GQL)

        // Gọi context login (giữ nguyên chữ ký bạn đang dùng)
        authLogin(token, role, avatar);

        // Lưu token (giữ logic remember của bạn)
        if (loginForm.remember) {
          localStorage.setItem("token", token);
          sessionStorage.removeItem("token");
        } else {
          sessionStorage.setItem("token", token);
          localStorage.removeItem("token");
        }

        // Điều hướng theo vai trò
        if (role === "admin") {
          navigate("/admin/dashboard");
        } else if (role === "manager") {
          navigate(`/manager`);
        } else {
          navigate("/");
        }
      },
    }
  );

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // Gọi GQL mutation
    await loginMutation({
      variables: { email: loginForm.email, password: loginForm.password },
    });
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();

    if (registerForm.password !== registerForm.confirmPassword) {
      alert("Mật khẩu xác nhận không khớp!");
      return;
    }

    const roleNames = {
      customer: "Khách hàng",
      staff: "Nhân viên",
      manager: "Quản lý",
      owner: "Chủ nhà hàng",
    };

    setModalContent({
      title: "Tạo tài khoản thành công!",
      message: `Chào mừng ${roleNames[registerForm.role]} mới đến với FoodHub`,
    });
    setShowModal(true);
  };

  const EyeIcon = ({ isVisible }) => (
    <svg
      className="eye-icon"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {isVisible ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
        />
      ) : (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </>
      )}
    </svg>
  );

  return (
    <div className="login-page">
      {/* Background Pattern */}
      <div className="background-pattern">
        <div className="pattern-circle pattern-circle--1"></div>
        <div className="pattern-circle pattern-circle--2"></div>
        <div className="pattern-circle pattern-circle--3"></div>
        <div className="pattern-circle pattern-circle--4"></div>
      </div>

      <div className="login-container">
        {/* Logo Section */}
        <div className="logo-section">
          <div className="logo-icon">
            <span>🍽️</span>
          </div>
          <h1 className="logo-title">FoodHub</h1>
          <p className="logo-subtitle">Hệ thống quản lý nhà hàng</p>
        </div>

        {/* Main Form Container */}
        <div className="form-container">
          {/* Tab Buttons */}
          <div className="tab-buttons">
            <button
              className={`tab-button ${
                activeTab === "login" ? "tab-button--active" : ""
              }`}
              onClick={() => setActiveTab("login")}
            >
              Đăng nhập
            </button>
            <button
              className={`tab-button ${
                activeTab === "register" ? "tab-button--active" : ""
              }`}
              onClick={() => setActiveTab("register")}
            >
              Tạo tài khoản
            </button>
          </div>

          {/* Login Form */}
          {activeTab === "login" && (
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              {(error || loginLoading) && (
                <div
                  className={`error-message ${
                    loginLoading ? "is-loading" : ""
                  }`}
                >
                  {loginLoading ? "Đang đăng nhập..." : error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="loginEmail" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="loginEmail"
                  className="form-input"
                  placeholder="your@email.com"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="loginPassword" className="form-label">
                  Mật khẩu
                </label>
                <div className="password-input">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    id="loginPassword"
                    className="form-input"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                  >
                    <EyeIcon isVisible={showLoginPassword} />
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={loginForm.remember}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, remember: e.target.checked })
                    }
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <a href="#" className="forgot-link">
                  Quên mật khẩu?
                </a>
              </div>

              <button
                type="submit"
                className="submit-button"
                disabled={loginLoading}
              >
                {loginLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>
          )}

          {/* Register Form (giữ nguyên UI demo) */}
          {activeTab === "register" && (
            <form className="auth-form" onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <label htmlFor="fullName" className="form-label">
                  Họ và tên
                </label>
                <input
                  type="text"
                  id="fullName"
                  className="form-input"
                  placeholder="Nguyễn Văn A"
                  value={registerForm.fullName}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      fullName: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="registerEmail" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="registerEmail"
                  className="form-input"
                  placeholder="your@email.com"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  id="phone"
                  className="form-input"
                  placeholder="0123456789"
                  value={registerForm.phone}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, phone: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="role" className="form-label">
                  Vai trò
                </label>
                <select
                  id="role"
                  className="form-input"
                  value={registerForm.role}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, role: e.target.value })
                  }
                  required
                >
                  <option value="">Chọn vai trò</option>
                  <option value="customer">👤 Khách hàng</option>
                  <option value="staff">👨‍🍳 Nhân viên</option>
                  <option value="manager">👨‍💼 Quản lý</option>
                  <option value="owner">👑 Chủ nhà hàng</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="registerPassword" className="form-label">
                  Mật khẩu
                </label>
                <div className="password-input">
                  <input
                    type={showRegisterPassword ? "text" : "password"}
                    id="registerPassword"
                    className="form-input"
                    placeholder="••••••••"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        password: e.target.value,
                      })
                    }
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowRegisterPassword(!showRegisterPassword)
                    }
                  >
                    <EyeIcon isVisible={showRegisterPassword} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className="form-input"
                  placeholder="••••••••"
                  value={registerForm.confirmPassword}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="terms-group">
                <input
                  type="checkbox"
                  id="terms"
                  className="checkbox"
                  checked={registerForm.terms}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      terms: e.target.checked,
                    })
                  }
                  required
                />
                <label htmlFor="terms" className="terms-label">
                  Tôi đồng ý với{" "}
                  <a href="#" className="terms-link">
                    Điều khoản sử dụng
                  </a>{" "}
                  và{" "}
                  <a href="#" className="terms-link">
                    Chính sách bảo mật
                  </a>
                </label>
              </div>

              <button type="submit" className="submit-button">
                Tạo tài khoản
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="footer">
          <p>© 2024 FoodHub. Hệ thống quản lý nhà hàng chuyên nghiệp.</p>
        </div>
      </div>

      {/* Success Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="modal-title">{modalContent.title}</h3>
            <p className="modal-message">{modalContent.message}</p>
            <button
              className="modal-button"
              onClick={() => setShowModal(false)}
            >
              Tiếp tục
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
