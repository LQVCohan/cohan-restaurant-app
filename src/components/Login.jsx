import React, { useState, useContext, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";
import ReCAPTCHA from "react-google-recaptcha";
import { useNotification } from "@/hooks/useNotification"; // Hook thông báo (tuỳ project bạn)
import { getRoleHomeRoute, resolveRoleName } from "@/routes/routeGuard";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  GoogleOutlined,
  FacebookFilled,
  EyeInvisibleOutlined,
  EyeTwoTone,
  PhoneOutlined,
  IdcardOutlined,
} from "@ant-design/icons";

// Import file SCSS đã cấu hình Scope
import "./Login.scss";

// Lấy Site Key từ biến môi trường
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

// ==========================================
// 1. GRAPHQL QUERIES & MUTATIONS
// ==========================================

const LOGIN_MUTATION = gql`
  mutation login(
    $email: String
    $username: String
    $phone: String
    $password: String!
    $captchaToken: String
  ) {
    login(
      email: $email
      username: $username
      phone: $phone
      password: $password
      captchaToken: $captchaToken
    ) {
      token
      user {
        id
        fullName
        username
        email
        phone
        roleName
        role {
          id
          slug
          name
        }
        emailVerified
        avatarUrl
      }
    }
  }
`;

const CREATE_USER_MUTATION = gql`
  mutation CreateUser($i: CreateUserInput!) {
    createUser(input: $i) {
      token
      user {
        id
        roleName
        emailVerified
        fullName
      }
    }
  }
`;

// Lấy Role Customer để gán khi đăng ký
const ROLES_QUERY = gql`
  query Roles($search: String) {
    role(search: $search) {
      id
      slug
      name
    }
  }
`;

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

// Hàm tách định danh (Email/Phone/Username)
function splitIdentifier(val) {
  val = (val || "").trim();
  if (val.includes("@")) return { email: val };
  // Regex đơn giản cho số điện thoại VN
  if (/^(\+?84|0)\d{8,12}$/.test(val))
    return { phone: val.replace(/\s+/g, "") };
  return { username: val };
}

// ==========================================
// 3. MAIN COMPONENT
// ==========================================

const LoginPage = () => {
  const navigate = useNavigate();
  const { login: authLogin, user, isAuthenticated, loading } = useContext(AuthContext);
  const { showNotification } = useNotification();



  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;

    navigate(getRoleHomeRoute(resolveRoleName(user)), { replace: true });
  }, [isAuthenticated, loading, navigate, user]);

  // --- STATE ---
  const [isRightPanelActive, setIsRightPanelActive] = useState(false); // Controls Sliding Animation
  const [mobileMode, setMobileMode] = useState("login"); // 'login' | 'register' (Cho mobile)

  // Form Data
  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
    remember: true,
  });
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");

  // Refs cho Captcha (để reset thủ công)
  const recaptchaLoginRef = useRef(null);
  const recaptchaRegisterRef = useRef(null);

  // Lấy danh sách Role (mặc định lấy role customer)
  const { data: rolesData } = useQuery(ROLES_QUERY, {
    variables: { search: "customer" },
  });

  // --- MUTATIONS ---
  const [loginMutation, { loading: loginLoading }] = useMutation(
    LOGIN_MUTATION,
    {
      onError: (err) => {
        showNotification(err.message || "Đăng nhập thất bại", "error");
        resetCaptcha();
      },
      onCompleted: (data) => {
        const { token, user } = data.login;
        // Lưu token vào Context/LocalStorage
        authLogin(token, user, null, loginForm.remember);
        showNotification(
          `Chào mừng ${user.fullName || user.username}!`,
          "success",
        );
        navigate(getRoleHomeRoute(resolveRoleName(user)), { replace: true });
      },
    },
  );

  const [registerMutation, { loading: registerLoading }] = useMutation(
    CREATE_USER_MUTATION,
    {
      onError: (err) => {
        showNotification(err.message || "Đăng ký thất bại", "error");
        resetCaptcha();
      },
      onCompleted: () => {
        showNotification("Đăng ký thành công! Hãy đăng nhập ngay.", "success");
        togglePanel(false); // Chuyển về tab Login
        // Reset form đăng ký
        setRegisterForm({
          fullName: "",
          email: "",
          username: "",
          password: "",
          confirmPassword: "",
          terms: false,
        });
      },
    },
  );

  // --- HANDLERS ---

  const resetCaptcha = () => {
    setCaptchaToken("");
    recaptchaLoginRef.current?.reset();
    recaptchaRegisterRef.current?.reset();
  };

  // Hàm chuyển đổi Tab (Login <-> Register)
  const togglePanel = (isRegister) => {
    setIsRightPanelActive(isRegister);
    setMobileMode(isRegister ? "register" : "login");
    resetCaptcha(); // Quan trọng: Reset Captcha để tránh lỗi token cũ
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!loginForm.identifier || !loginForm.password) {
      return showNotification("Vui lòng nhập tài khoản và mật khẩu", "warning");
    }
    if (!captchaToken) {
      return showNotification("Vui lòng xác thực Captcha", "warning");
    }

    const variables = {
      ...splitIdentifier(loginForm.identifier),
      password: loginForm.password,
      captchaToken,
    };

    loginMutation({ variables });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    // Validate cơ bản
    if (
      !registerForm.fullName ||
      !registerForm.email ||
      !registerForm.username ||
      !registerForm.password
    ) {
      return showNotification("Vui lòng nhập đầy đủ thông tin", "warning");
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      return showNotification("Mật khẩu xác nhận không khớp", "error");
    }
    if (!registerForm.terms) {
      return showNotification(
        "Bạn cần đồng ý với điều khoản sử dụng",
        "warning",
      );
    }
    if (!captchaToken) {
      return showNotification("Vui lòng xác thực Captcha", "warning");
    }

    // Lấy Role ID (Customer)
    const roleId =
      rolesData?.role?.find((r) => r.slug === "customer")?.id ||
      rolesData?.role?.[0]?.id;

    const variables = {
      i: {
        ...registerForm,
        roleId,
        captchaToken,
        status: "active",
        customerType: "NEW",
      },
    };

    registerMutation({ variables });
  };

  // ==========================================
  // 4. RENDER UI
  // ==========================================
  return (
    <div className="login-page-wrapper">
      {/* MOBILE SWITCHER (Chỉ hiện trên màn hình nhỏ do CSS xử lý) */}
      <div className="mobile-switcher">
        <button
          className={mobileMode === "login" ? "active" : ""}
          onClick={() => togglePanel(false)}
        >
          Đăng nhập
        </button>
        <button
          className={mobileMode === "register" ? "active" : ""}
          onClick={() => togglePanel(true)}
        >
          Đăng ký
        </button>
      </div>

      <div
        className={`container ${isRightPanelActive ? "right-panel-active" : ""}`}
        id="container"
      >
        {/* =========================================
            FORM ĐĂNG KÝ (SIGN UP CONTAINER)
            Lớp overlay sẽ trượt ra để lộ phần này
           ========================================= */}
        <div
          className={`form-container sign-up-container ${mobileMode === "login" ? "mobile-hidden" : ""}`}
        >
          <form onSubmit={handleRegister}>
            <h1>Tạo tài khoản</h1>

            <div className="social-container">
              <a
                href="#"
                className="social"
                onClick={(e) => e.preventDefault()}
              >
                <FacebookFilled style={{ color: "#3b5998" }} />
              </a>
              <a
                href="#"
                className="social"
                onClick={(e) => e.preventDefault()}
              >
                <GoogleOutlined style={{ color: "#db4437" }} />
              </a>
            </div>
            <p className="social-text">hoặc đăng ký bằng email</p>

            <div className="input-wrapper">
              <UserOutlined className="field-icon" />
              <input
                type="text"
                placeholder="Họ và tên"
                value={registerForm.fullName}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, fullName: e.target.value })
                }
              />
            </div>

            <div className="input-wrapper">
              <MailOutlined className="field-icon" />
              <input
                type="email"
                placeholder="Email"
                value={registerForm.email}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, email: e.target.value })
                }
              />
            </div>

            <div className="input-wrapper">
              <IdcardOutlined className="field-icon" />
              <input
                type="text"
                placeholder="Username (Tên đăng nhập)"
                value={registerForm.username}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, username: e.target.value })
                }
              />
            </div>

            <div className="input-wrapper">
              <LockOutlined className="field-icon" />
              <input
                type="password"
                placeholder="Mật khẩu"
                value={registerForm.password}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, password: e.target.value })
                }
              />
            </div>

            <div className="input-wrapper">
              <LockOutlined className="field-icon" />
              <input
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={registerForm.confirmPassword}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    confirmPassword: e.target.value,
                  })
                }
              />
            </div>

            {/* Checkbox Terms */}
            <div
              style={{
                width: "100%",
                textAlign: "left",
                margin: "5px 0",
                fontSize: "12px",
                paddingLeft: "5px",
              }}
            >
              <label
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <input
                  type="checkbox"
                  checked={registerForm.terms}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      terms: e.target.checked,
                    })
                  }
                  style={{ width: "auto", margin: 0 }}
                />
                <span style={{ color: "#636e72" }}>
                  Tôi đồng ý với chính sách & điều khoản
                </span>
              </label>
            </div>

            {/* CAPTCHA REGISTER */}
            <div className="captcha-container">
              <ReCAPTCHA
                ref={recaptchaRegisterRef}
                sitekey={SITE_KEY}
                size="normal"
                onChange={setCaptchaToken}
              />
            </div>

            <button className="btn-primary" disabled={registerLoading}>
              {registerLoading ? "Đang tạo..." : "Đăng ký ngay"}
            </button>
          </form>
        </div>

        {/* =========================================
            FORM ĐĂNG NHẬP (SIGN IN CONTAINER)
            Mặc định hiển thị
           ========================================= */}
        <div
          className={`form-container sign-in-container ${mobileMode === "register" ? "mobile-hidden" : ""}`}
        >
          <form onSubmit={handleLogin}>
            <h1>Đăng nhập</h1>

            <div className="social-container">
              <a
                href="#"
                className="social"
                onClick={(e) => e.preventDefault()}
              >
                <FacebookFilled style={{ color: "#3b5998" }} />
              </a>
              <a
                href="#"
                className="social"
                onClick={(e) => e.preventDefault()}
              >
                <GoogleOutlined style={{ color: "#db4437" }} />
              </a>
            </div>
            <p className="social-text">hoặc sử dụng tài khoản của bạn</p>

            <div className="input-wrapper">
              <UserOutlined className="field-icon" />
              <input
                type="text"
                placeholder="Email / Username / SĐT"
                value={loginForm.identifier}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, identifier: e.target.value })
                }
              />
            </div>

            <div className="input-wrapper">
              <LockOutlined className="field-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mật khẩu"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
              />
              <button
                type="button"
                className="toggle-pw-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeTwoTone twoToneColor="#FF6B6B" />
                ) : (
                  <EyeInvisibleOutlined />
                )}
              </button>
            </div>

            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                fontSize: "13px",
                color: "#333",
                textDecoration: "none",
                margin: "8px 0",
              }}
            >
              Quên mật khẩu?
            </a>

            {/* CAPTCHA LOGIN */}
            <div className="captcha-container">
              <ReCAPTCHA
                ref={recaptchaLoginRef}
                sitekey={SITE_KEY}
                size="normal"
                onChange={setCaptchaToken}
              />
            </div>

            <button className="btn-primary" disabled={loginLoading}>
              {loginLoading ? "Đang xử lý..." : "Đăng nhập"}
            </button>
          </form>
        </div>

        {/* =========================================
            OVERLAY CONTAINER (PHẦN TRƯỢT)
            Chứa Pattern đồ ăn/bút viết và nút chuyển đổi
           ========================================= */}
        <div className="overlay-container">
          <div className="overlay">
            {/* PANEL TRÁI (Hiện khi đang ở form Đăng Ký -> Mời Đăng Nhập) */}
            <div className="overlay-panel overlay-left">
              <h1>Chào mừng!</h1>
              <p>
                Để duy trì kết nối với chúng tôi, vui lòng đăng nhập bằng thông
                tin cá nhân của bạn.
              </p>
              <button className="ghost" onClick={() => togglePanel(false)}>
                Đăng nhập
              </button>
            </div>

            {/* PANEL PHẢI (Hiện khi đang ở form Đăng Nhập -> Mời Đăng Ký) */}
            <div className="overlay-panel overlay-right">
              <h1>Xin chào!</h1>
              <p>
                Nhập thông tin cá nhân và bắt đầu hành trình ẩm thực cùng
                FoodHub.
              </p>
              <button className="ghost" onClick={() => togglePanel(true)}>
                Đăng ký
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
