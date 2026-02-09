// src/pages/LoginPage.jsx
import React, {
  useState,
  useContext,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { AuthContext } from "../context/AuthContext";
import { useRouter } from "../hooks/useRouter";
import "../styles/login.scss";
import process from "process";
import ReCAPTCHA from "react-google-recaptcha";
import { useNotification } from "@/hooks/useNotification";
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
/* ========== GraphQL ========== */
// LOGIN
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

        address {
          line1
          line2
          ward
          district
          city
          country
        }

        role {
          id
          slug
          name
        }

        status
        provider
        avatarUrl

        # restaurants
        refRestaurants {
          id
          name
        }

        # customer info
        loyaltyPoints
        customerType
        totalOrders
        totalSpending
        emailVerified
        isGuest
        guestExpiresAt

        # staff info
        userType
        taxCode
        employeeCode
        positionTitle
        baseSalary

        employmentType
        employmentStatus

        primaryRestaurant {
          id
          name
        }

        shiftType
        workingDays

        dateJoined
        dateLeft

        lastLoginAt
        lastLoginIp

        forcePasswordChange
        noteInternal

        emergencyContact {
          name
          phone
          relation
        }

        # rating
        rate
        rateCount

        # audit fields
        createdAt
        updatedAt
      }
    }
  }
`;

// CREATE USER
const CREATE_USER_MUTATION = gql`
  mutation CreateUser($i: CreateUserInput!) {
    createUser(input: $i) {
      token
      user {
        id
        fullName
        username
        email
        phone
        roleName
        role {
          name
          slug
        }
        status
        createdAt
        emailVerified
      }
    }
  }
`;

const ROLES_QUERY = gql`
  query Roles($search: String) {
    role(search: $search) {
      id
      name
      slug
    }
  }
`;

const REQUEST_VERIFY_MUTATION = gql`
  mutation RequestEmailVerification($email: String!) {
    requestEmailVerification(email: $email)
  }
`;

/* ========== Helpers ========== */
const TOKEN_KEYS = { token: "auth_token", legacy: "token", user: "auth_user" };

function clearAuthStorage() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEYS.token);
    s.removeItem(TOKEN_KEYS.legacy);
    s.removeItem(TOKEN_KEYS.user);
  });
}
function saveAuth({ token, user, remember }) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEYS.token, token);
  storage.setItem(TOKEN_KEYS.legacy, token);
  storage.setItem(TOKEN_KEYS.user, JSON.stringify(user));
}
function pickRole(user) {
  return user?.roleName || user?.role?.slug || user?.role?.name || "customer";
}

/** Nhận diện tài khoản: email / phone / username */
function splitIdentifier(identifier) {
  const id = (identifier || "").trim();
  if (!id) return { email: null, phone: null, username: null };
  const looksEmail = id.includes("@");
  const looksPhone = /^(\+?84|0)\d{8,12}$/.test(id.replace(/\s+/g, ""));
  if (looksEmail) return { email: id, phone: null, username: null };
  if (looksPhone)
    return { email: null, phone: id.replace(/\s+/g, ""), username: null };
  return { email: null, phone: null, username: id };
}

/** Kiểm tra password (FE hint) */
function checkPasswordPolicy(pw) {
  const length = pw.length >= 8;
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const number = /\d/.test(pw);
  const symbol = /[^A-Za-z0-9]/.test(pw);
  const ok = length && upper && lower && number && symbol;
  return { ok, length, upper, lower, number, symbol };
}

/* ========== Toast ========== */
function Toast({ visible, message }) {
  const baseStyle = {
    position: "fixed",
    top: 20,
    right: 20,
    zIndex: 1000,
    minWidth: 280,
    maxWidth: "90vw",
    padding: "12px 16px",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    background: "#10b981",
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    transform: "translateX(120%)",
    opacity: 0,
    transition: "transform 280ms ease, opacity 280ms ease",
    pointerEvents: "none",
  };
  const show = visible ? { transform: "translateX(0)", opacity: 1 } : null;
  return <div style={{ ...baseStyle, ...(show || {}) }}>{message}</div>;
}

/* ========== Modal Xác nhận Email ========== */
function VerifyEmailModal({ open, email, onClose, onResend, loading }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M16 12H8m8 0H8m12 0a8 8 0 11-16 0 8 8 0 0116 0z"
            />
          </svg>
        </div>
        <h3 className="modal-title">Xác nhận email</h3>
        <p className="modal-message">
          Tài khoản của bạn chưa xác minh email. Vui lòng kiểm tra hộp thư:{" "}
          <b>{email}</b>.<br />
          Bạn có thể yêu cầu gửi lại liên kết xác minh.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="modal-button" onClick={onClose}>
            Để sau
          </button>
          <button
            className="modal-button"
            onClick={onResend}
            disabled={loading}
          >
            {loading ? "Đang gửi..." : "Gửi lại email xác minh"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== Component ========== */
const LoginPage = () => {
  const [activeTab, setActiveTab] = useState("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [errorGlobal, setErrorGlobal] = useState("");
  const [errorsLogin, setErrorsLogin] = useState({});
  const [errorsRegister, setErrorsRegister] = useState({});

  // toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // modal verify email
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  // forms
  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
    remember: true,
  });
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { goBack } = useRouter();
  const { login: authLogin } = useContext(AuthContext);

  const fromPath =
    location.state?.from?.pathname ||
    localStorage.getItem("last_visited_route") ||
    "/";

  const loginValid = useMemo(
    () => Boolean(loginForm.identifier.trim() && loginForm.password),
    [loginForm]
  );
  const pwRules = checkPasswordPolicy(registerForm.password);
  // sau các useState khác
  const [captchaLogin, setCaptchaLogin] = useState("");
  const [captchaRegister, setCaptchaRegister] = useState("");
  const recaptchaLoginRef = React.useRef(null);
  const recaptchaRegisterRef = React.useRef(null);
  const { showNotification } = useNotification();
  /* ======= Lấy role customer ngầm ======= */
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useQuery(ROLES_QUERY, {
    variables: { search: "customer" },
    fetchPolicy: "cache-first",
  });
  useEffect(() => {
    if (rolesError) {
      showNotification(rolesError.message, "error");
    }
  }, [rolesError, showNotification]);
  const customerRoleId = useMemo(() => {
    const list = rolesData?.role || [];
    if (!list.length) return "";
    const exact = list.find((r) => (r.slug || "").toLowerCase() === "customer");
    if (exact) return exact.id;
    const byName = list.find((r) => /kh(á|a)ch\s*h(à|a)ng/i.test(r.name || ""));
    return (byName && byName.id) || list[0].id || "";
  }, [rolesData]);

  const fireSuccessThenNavigate = useCallback(
    (message) => {
      setToastMsg(message || "Thành công!");
      setToastVisible(true);
      setTimeout(() => {
        setToastVisible(false);
        navigate(fromPath, { replace: true });
      }, 900);
    },
    [navigate, fromPath]
  );

  /* ======= Mutations ======= */
  const [requestVerify] = useMutation(REQUEST_VERIFY_MUTATION, {
    onError: (e) => console.error("requestVerify error:", e),
  });

  const [loginMutation, { loading: loginLoading }] = useMutation(
    LOGIN_MUTATION,
    {
      onError: (e) => {
        const msg =
          e?.graphQLErrors?.[0]?.message ||
          e?.networkError?.message ||
          "Đã xảy ra lỗi khi đăng nhập";
        setErrorGlobal(msg);
      },
      onCompleted: (data) => {
        const { token, user } = data?.login || {};
        if (!token || !user) {
          setErrorGlobal("Phản hồi đăng nhập không hợp lệ");
          return;
        }

        const role = pickRole(user);
        const avatar = null;

        authLogin(token, role, avatar, loginForm.remember);
        clearAuthStorage();
        saveAuth({ token, user, remember: loginForm.remember });

        // 👉 Quy tắc: chưa verify thì luôn đi tới verify-email
        if (user?.emailVerified === false) {
          const back = localStorage.getItem("last_visited_route") || "/";
          sessionStorage.setItem("verify_back_to", back);
          navigate("/verify-email", { replace: true });
          return;
        }

        fireSuccessThenNavigate("Đăng nhập thành công!");
      },
    }
  );
  const [createUser, { loading: registerLoading }] = useMutation(
    CREATE_USER_MUTATION,
    {
      onError: (e) => {
        const msg =
          e?.graphQLErrors?.[0]?.message ||
          e?.networkError?.message ||
          "Đã xảy ra lỗi khi tạo tài khoản";
        setErrorGlobal(msg);
        console.error("CreateUser GQL error:", e);
      },
      onCompleted: (data) => {
        const { token, user } = data?.createUser || {};
        if (!token || !user) {
          setErrorGlobal("Phản hồi đăng ký không hợp lệ");
          return;
        }
        const role = pickRole(user);
        const avatar = null;

        authLogin(token, role, avatar, true);
        clearAuthStorage();
        saveAuth({ token, user, remember: true });

        // Nếu BE yêu cầu xác minh email trước khi dùng, có thể bật modal:
        if (user?.email && process.env?.ENABLE_EMAIL_VERIFICATION === "true") {
          setVerifyEmail(user.email);
          setVerifyOpen(true);
        }
        if (
          user &&
          (user.emailVerified === false || user.emailVerified === null)
        ) {
          return navigate("/verify-email");
        }
        fireSuccessThenNavigate("Tạo tài khoản & đăng nhập thành công!");
      },
    }
  );

  /* ======= Validate helpers ======= */
  const setLoginError = (field, msg) =>
    setErrorsLogin((prev) => ({ ...prev, [field]: msg }));
  const setRegisterError = (field, msg) =>
    setErrorsRegister((prev) => ({ ...prev, [field]: msg }));

  /* ======= Submit handlers ======= */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorGlobal("");
    setErrorsLogin({});

    if (!loginForm.identifier.trim()) {
      setLoginError(
        "identifier",
        "Vui lòng nhập email / số điện thoại / username"
      );
      return;
    }
    if (!loginForm.password) {
      setLoginError("password", "Vui lòng nhập mật khẩu");
      return;
    }
    if (!captchaLogin) {
      setLoginError("captcha", "Vui lòng xác nhận reCAPTCHA");
      return;
    }

    const parsed = splitIdentifier(loginForm.identifier);
    try {
      await loginMutation({
        variables: {
          ...parsed,
          password: loginForm.password,
          captchaToken: captchaLogin,
        },
      });
      captchaLogin.current?.reset();
      setCaptchaRegister("");
    } finally {
      // reset captcha sau submit (để token mới mỗi lần)
      recaptchaLoginRef.current?.reset();
      setCaptchaLogin("");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorGlobal("");
    setErrorsRegister({});

    // Validate cơ bản + hiển thị dưới input
    if (!registerForm.fullName.trim()) {
      setRegisterError("fullName", "Vui lòng nhập họ tên");
      return;
    }
    if (!registerForm.email && !registerForm.phone && !registerForm.username) {
      setRegisterError(
        "email",
        "Cần ít nhất một trong các trường: email / số điện thoại / username"
      );
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError("confirmPassword", "Mật khẩu xác nhận không khớp");
      return;
    }
    if (!pwRules.ok) {
      setRegisterError("password", "Mật khẩu chưa đáp ứng đủ yêu cầu");
      return;
    }
    if (!registerForm.terms) {
      setRegisterError("terms", "Bạn cần đồng ý điều khoản sử dụng");
      return;
    }
    if (rolesLoading) {
      setErrorGlobal(
        "Đang tải quyền mặc định (Khách hàng). Vui lòng thử lại trong giây lát."
      );
      return;
    }
    if (rolesError || !customerRoleId) {
      setErrorGlobal(
        "Không tìm thấy quyền 'Khách hàng'. Vui lòng liên hệ quản trị."
      );
      return;
    }
    if (!captchaRegister) {
      setRegisterError("captcha", "Vui lòng xác nhận reCAPTCHA");
      return;
    }

    const input = {
      fullName: registerForm.fullName.trim(),
      username: registerForm.username || null,
      email: registerForm.email || null,
      phone: registerForm.phone || null,
      password: registerForm.password,
      provider: "local",
      status: "active",
      customerType: "NEW",
      roleId: customerRoleId,
      captchaToken: captchaRegister,
    };

    try {
      await createUser({ variables: { i: input } });
      captchaRegister.current?.reset();
      setCaptchaRegister("");
    } finally {
      recaptchaRegisterRef.current?.reset();
      setCaptchaRegister("");
    }
  };

  /* ======= UI helpers ======= */
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
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </>
      )}
    </svg>
  );

  return (
    <div className="login-page">
      {/* Background Pattern */}
      <div className="background-pattern" aria-hidden="true">
        <div className="pattern-circle pattern-circle--1"></div>
        <div className="pattern-circle pattern-circle--2"></div>
        <div className="pattern-circle pattern-circle--3"></div>
        <div className="pattern-circle pattern-circle--4"></div>
      </div>

      {/* Toast */}
      <Toast visible={toastVisible} message={toastMsg} />

      {/* Modal verify email */}
      <VerifyEmailModal
        open={verifyOpen}
        email={verifyEmail}
        loading={resendLoading}
        onClose={() => setVerifyOpen(false)}
        onResend={async () => {
          if (!verifyEmail) return;
          setResendLoading(true);
          try {
            await requestVerify({ variables: { email: verifyEmail } });
            setToastMsg("Đã gửi lại email xác minh.");
            setToastVisible(true);
            setTimeout(() => setToastVisible(false), 1200);
          } finally {
            setResendLoading(false);
          }
        }}
      />

      <div className="login-container">
        {/* Logo */}
        <div className="logo-section">
          <div className="logo-icon" aria-hidden="true">
            <span>🍽️</span>
          </div>
          <h1 className="logo-title">FoodHub</h1>
          <p className="logo-subtitle">Hệ thống quản lý nhà hàng</p>
        </div>

        {/* Main Form */}
        <div className="form-container">
          {/* Tabs */}
          <div
            className="tab-buttons"
            role="tablist"
            aria-label="Chọn tác vụ xác thực"
          >
            <button
              role="tab"
              aria-selected={activeTab === "login"}
              className={`tab-button ${
                activeTab === "login" ? "tab-button--active" : ""
              }`}
              onClick={() => setActiveTab("login")}
            >
              Đăng nhập
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "register"}
              className={`tab-button ${
                activeTab === "register" ? "tab-button--active" : ""
              }`}
              onClick={() => setActiveTab("register")}
            >
              Tạo tài khoản
            </button>
          </div>

          {/* LOGIN */}
          {activeTab === "login" && (
            <form className="auth-form" onSubmit={handleLoginSubmit} noValidate>
              {errorGlobal && (
                <div className="error-message" role="status" aria-live="polite">
                  {errorGlobal}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="loginIdentifier" className="form-label">
                  Tài khoản
                </label>
                <input
                  type="text"
                  id="loginIdentifier"
                  className={`form-input ${
                    errorsLogin.identifier ? "has-error" : ""
                  }`}
                  placeholder="Email / Số điện thoại / Username"
                  value={loginForm.identifier}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, identifier: e.target.value })
                  }
                  required
                  autoComplete="username"
                />
                {errorsLogin.identifier && (
                  <p className="input-error">{errorsLogin.identifier}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="loginPassword" className="form-label">
                  Mật khẩu
                </label>
                <div
                  className={`password-input ${
                    errorsLogin.password ? "has-error" : ""
                  }`}
                >
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
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={
                      showLoginPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                  >
                    <EyeIcon isVisible={showLoginPassword} />
                  </button>
                </div>
                {errorsLogin.password && (
                  <p className="input-error">{errorsLogin.password}</p>
                )}
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
                <a
                  href="#"
                  className="forgot-link"
                  onClick={(e) => e.preventDefault()}
                >
                  Quên mật khẩu?
                </a>
              </div>
              <ReCAPTCHA
                ref={recaptchaLoginRef}
                sitekey={SITE_KEY}
                onChange={(tok) => setCaptchaLogin(tok || "")}
                onExpired={() => setCaptchaLogin("")}
              />
              {errorsLogin.captcha && (
                <p className="input-error">{errorsLogin.captcha}</p>
              )}
              <button
                type="submit"
                className="submit-button"
                disabled={loginLoading}
                aria-disabled={loginLoading}
              >
                {loginLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>
          )}

          {/* REGISTER */}
          {activeTab === "register" && (
            <form
              className="auth-form"
              onSubmit={handleRegisterSubmit}
              noValidate
            >
              {errorGlobal && (
                <div className="error-message" role="status" aria-live="polite">
                  {errorGlobal}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="fullName" className="form-label">
                  Họ và tên
                </label>
                <input
                  type="text"
                  id="fullName"
                  className={`form-input ${
                    errorsRegister.fullName ? "has-error" : ""
                  }`}
                  placeholder="Nguyễn Văn A"
                  value={registerForm.fullName}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      fullName: e.target.value,
                    })
                  }
                  required
                  autoComplete="name"
                />
                {errorsRegister.fullName && (
                  <p className="input-error">{errorsRegister.fullName}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="registerEmail" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="registerEmail"
                  className={`form-input ${
                    errorsRegister.email ? "has-error" : ""
                  }`}
                  placeholder="your@email.com"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  autoComplete="email"
                />
                {errorsRegister.email && (
                  <p className="input-error">{errorsRegister.email}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  id="phone"
                  className={`form-input ${
                    errorsRegister.phone ? "has-error" : ""
                  }`}
                  placeholder="0123456789"
                  value={registerForm.phone}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, phone: e.target.value })
                  }
                  autoComplete="tel"
                />
                {errorsRegister.phone && (
                  <p className="input-error">{errorsRegister.phone}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  className={`form-input ${
                    errorsRegister.username ? "has-error" : ""
                  }`}
                  placeholder="ten_dang_nhap"
                  value={registerForm.username}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      username: e.target.value,
                    })
                  }
                  autoComplete="username"
                />
                {errorsRegister.username && (
                  <p className="input-error">{errorsRegister.username}</p>
                )}
              </div>

              {/* Quyền: holder hiển thị, không cho chọn */}
              <div className="form-group">
                <label className="form-label">Quyền</label>
                <div
                  className="form-input"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    opacity: 0.85,
                  }}
                >
                  <span>Khách hàng</span>
                  {rolesLoading && (
                    <span style={{ fontSize: 12 }}>Đang tải…</span>
                  )}
                </div>
              </div>

              {/* Password + Hints */}
              <div className="form-group">
                <label htmlFor="registerPassword" className="form-label">
                  Mật khẩu
                </label>
                <div
                  className={`password-input ${
                    errorsRegister.password ? "has-error" : ""
                  }`}
                >
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
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowRegisterPassword(!showRegisterPassword)
                    }
                    aria-label={
                      showRegisterPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                  >
                    <EyeIcon isVisible={showRegisterPassword} />
                  </button>
                </div>
                {errorsRegister.password && (
                  <p className="input-error">{errorsRegister.password}</p>
                )}

                {/* Hints yêu cầu mật khẩu */}
                <ul className="password-hints">
                  <li className={pwRules.length ? "ok" : ""}>
                    Ít nhất 8 ký tự
                  </li>
                  <li className={pwRules.upper ? "ok" : ""}>
                    Chứa chữ hoa (A-Z)
                  </li>
                  <li className={pwRules.lower ? "ok" : ""}>
                    Chứa chữ thường (a-z)
                  </li>
                  <li className={pwRules.number ? "ok" : ""}>Chứa số (0-9)</li>
                  <li className={pwRules.symbol ? "ok" : ""}>
                    Chứa ký tự đặc biệt (!@#$...)
                  </li>
                </ul>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className={`form-input ${
                    errorsRegister.confirmPassword ? "has-error" : ""
                  }`}
                  placeholder="••••••••"
                  value={registerForm.confirmPassword}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                  autoComplete="new-password"
                />
                {errorsRegister.confirmPassword && (
                  <p className="input-error">
                    {errorsRegister.confirmPassword}
                  </p>
                )}
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
                  <a
                    href="#"
                    className="terms-link"
                    onClick={(e) => e.preventDefault()}
                  >
                    Điều khoản sử dụng
                  </a>{" "}
                  và{" "}
                  <a
                    href="#"
                    className="terms-link"
                    onClick={(e) => e.preventDefault()}
                  >
                    Chính sách bảo mật
                  </a>
                </label>
                {errorsRegister.terms && (
                  <p className="input-error">{errorsRegister.terms}</p>
                )}
              </div>
              <ReCAPTCHA
                ref={recaptchaRegisterRef}
                sitekey={SITE_KEY}
                onChange={(tok) => setCaptchaRegister(tok || "")}
                onExpired={() => setCaptchaRegister("")}
              />
              {errorsRegister.captcha && (
                <p className="input-error">{errorsRegister.captcha}</p>
              )}
              <button
                type="submit"
                className="submit-button"
                disabled={registerLoading}
                aria-disabled={registerLoading}
              >
                {registerLoading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="footer">
          <p>© 2024 FoodHub. Hệ thống quản lý nhà hàng chuyên nghiệp.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
