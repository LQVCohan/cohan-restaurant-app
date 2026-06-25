import React, { useState, useContext, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { gql, useMutation } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";
import ReCAPTCHA from "react-google-recaptcha";
import { useNotification } from "@/hooks/useNotification";
import { getRoleHomeRoute, resolveRoleName } from "@/routes/routeGuard";
import { isAccountVerified } from "@/utils/accountVerification";

import "./Login.scss";

const CAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
const CAPTCHA_ENABLED =
  String(import.meta.env.VITE_ENABLE_RECAPTCHA ?? "true").toLowerCase() !==
  "false";
const shouldRenderCaptcha = CAPTCHA_ENABLED && Boolean(CAPTCHA_SITE_KEY);
const captchaConfigMissing = CAPTCHA_ENABLED && !CAPTCHA_SITE_KEY;

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
        status
        emailVerified
        phoneVerified
        avatarUrl
        wallet {
          provider
          status
          balance
          currency
        }
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
        status
        email
        phone
        emailVerified
        phoneVerified
        fullName
        username
      }
    }
  }
`;

const FieldIcon = ({ type }) => {
  const paths = {
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="8" r="4" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="3" />
        <path d="M8 10V8a4 4 0 0 1 8 0v2" />
        <path d="M12 14v3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
        <path d="M7.1 7.6C4.2 9.2 2.5 12 2.5 12s3.5 6 9.5 6c1.6 0 3-.4 4.2-1" />
        <path d="M14.2 6.3C19 7.1 21.5 12 21.5 12a17 17 0 0 1-2.2 3" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="field-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[type]}
    </svg>
  );
};

const FloatingFoodIcons = () => (
  <div className="floating-food-layer" aria-hidden="true">
    <span className="food-float food-float--1">🍜</span>
    <span className="food-float food-float--2">🍕</span>
    <span className="food-float food-float--3">🥗</span>
    <span className="food-float food-float--4">🍔</span>
    <span className="food-float food-float--5">🥤</span>
    <span className="food-float food-float--6">🍣</span>
  </div>
);

function splitIdentifier(val) {
  val = (val || "").trim();
  if (val.includes("@")) return { email: val };
  if (/^(\+?84|0)\d{8,12}$/.test(val)) return { phone: val.replace(/\s+/g, "") };
  return { username: val };
}

function buildGeneratedUsername(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const username = normalizedEmail
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return username || `user_${Date.now()}`;
}

function resolveLoginErrorMessage(error) {
  const first = error?.graphQLErrors?.[0];
  const code = first?.extensions?.code || "";
  const msg = String(first?.message || "").toLowerCase();

  if (code === "UNAUTHENTICATED" || msg.includes("invalid credentials")) return "Sai tài khoản hoặc mật khẩu.";
  if (code === "TOO_MANY_REQUESTS") return "Bạn đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.";
  if (code === "FORBIDDEN") return "Tài khoản hiện không thể đăng nhập.";
  if (code === "BAD_USER_INPUT") return first?.message || "Dữ liệu đăng nhập chưa hợp lệ.";
  if (error?.networkError) return "Không thể kết nối máy chủ. Vui lòng thử lại.";
  return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.";
}

function resolveRegisterErrorMessage(error) {
  const first = error?.graphQLErrors?.[0];
  const code = first?.extensions?.code || "";
  const msg = String(first?.message || "").toLowerCase();

  if (msg.includes("already in use") || msg.includes("duplicate")) return "Email hoặc tài khoản này đã được sử dụng.";
  if (msg.includes("weak password")) return first?.message || "Mật khẩu chưa đủ mạnh.";
  if (code === "BAD_USER_INPUT") return first?.message || "Dữ liệu đăng ký chưa hợp lệ.";
  if (error?.networkError) return "Không thể kết nối máy chủ. Vui lòng thử lại.";
  return "Đăng ký thất bại. Vui lòng thử lại.";
}

const safeRedirectPath = (candidate, fallback) => {
  if (typeof candidate !== "string") return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  return candidate;
};

const getRedirectPathFromLocationState = (state, fallback) => {
  const from = state?.from;
  if (typeof from === "string") return safeRedirectPath(from, fallback);
  if (from?.pathname) return safeRedirectPath(`${from.pathname}${from.search || ""}${from.hash || ""}`, fallback);
  return fallback;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login: authLogin,
    user,
    isAuthenticated,
    loading,
    rememberedLoginIdentifier,
  } = useContext(AuthContext);
  const { showNotification } = useNotification();

  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [mobileMode, setMobileMode] = useState("login");
  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
    rememberSession: true,
    rememberIdentifier: true,
  });
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");

  const recaptchaLoginRef = useRef(null);
  const recaptchaRegisterRef = useRef(null);

  const resetCaptcha = () => {
    setCaptchaToken("");
    recaptchaLoginRef.current?.reset();
    recaptchaRegisterRef.current?.reset();
  };

  const togglePanel = (isRegister) => {
    setIsRightPanelActive(isRegister);
    setMobileMode(isRegister ? "register" : "login");
    resetCaptcha();
  };

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    const redirectTo = getRedirectPathFromLocationState(location?.state, getRoleHomeRoute(resolveRoleName(user)));
    if (location.pathname === redirectTo) return;
    navigate(redirectTo, { replace: true });
  }, [isAuthenticated, loading, location.pathname, location?.state, navigate, user]);

  useEffect(() => {
    if (!rememberedLoginIdentifier) return;
    setLoginForm((prev) => ({ ...prev, identifier: prev.identifier || rememberedLoginIdentifier }));
  }, [rememberedLoginIdentifier]);

  const [loginMutation, { loading: loginLoading }] = useMutation(LOGIN_MUTATION, {
    errorPolicy: "none",
    onError: (error) => {
      showNotification(resolveLoginErrorMessage(error), "error");
      resetCaptcha();
    },
    onCompleted: (data) => {
      const token = data?.login?.token;
      const loggedInUser = data?.login?.user;
      if (!token || !loggedInUser) {
        showNotification("Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản/mật khẩu.", "error");
        resetCaptcha();
        return;
      }
      authLogin(token, loggedInUser, null, {
        persistSession: loginForm.rememberSession,
        rememberIdentifier: loginForm.rememberIdentifier,
        identifier: loginForm.identifier,
      });
      showNotification(`Chào mừng ${loggedInUser.fullName || loggedInUser.username}.`, "success");
    },
  });

  const [registerMutation, { loading: registerLoading }] = useMutation(CREATE_USER_MUTATION, {
    errorPolicy: "none",
    onError: (error) => {
      showNotification(resolveRegisterErrorMessage(error), "error");
      resetCaptcha();
    },
    onCompleted: (data) => {
      const createdUser = data?.createUser?.user;
      const needsVerification = createdUser?.status === "pending" || (createdUser && !isAccountVerified(createdUser));

      if (needsVerification) {
        showNotification("Đăng ký thành công. Vui lòng xác minh tài khoản trước khi đăng nhập.", "success");
        navigate("/verify-email", {
          replace: true,
          state: {
            email: createdUser?.email || registerForm.email,
            phone: createdUser?.phone,
            fromRegistration: true,
          },
        });
      } else {
        showNotification("Đăng ký thành công. Hãy đăng nhập ngay.", "success");
        togglePanel(false);
      }

      setRegisterForm({ fullName: "", email: "", password: "", confirmPassword: "", terms: false });
    },
  });

  const handleLogin = (e) => {
    e.preventDefault();
    if (!loginForm.identifier || !loginForm.password) return showNotification("Vui lòng nhập tài khoản và mật khẩu", "warning");
    if (captchaConfigMissing) return showNotification("Captcha chưa được cấu hình. Vui lòng kiểm tra VITE_RECAPTCHA_SITE_KEY.", "error");
    if (shouldRenderCaptcha && !captchaToken) return showNotification("Vui lòng xác thực Captcha", "warning");

    loginMutation({
      variables: {
        ...splitIdentifier(loginForm.identifier),
        password: loginForm.password,
        captchaToken: shouldRenderCaptcha ? captchaToken : undefined,
      },
    });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    const fullName = registerForm.fullName.trim();
    const email = registerForm.email.trim().toLowerCase();

    if (!fullName || !email || !registerForm.password) return showNotification("Vui lòng nhập đầy đủ thông tin", "warning");
    if (registerForm.password !== registerForm.confirmPassword) return showNotification("Mật khẩu xác nhận không khớp", "error");
    if (!registerForm.terms) return showNotification("Bạn cần đồng ý với điều khoản sử dụng", "warning");
    if (captchaConfigMissing) return showNotification("Captcha chưa được cấu hình. Vui lòng kiểm tra VITE_RECAPTCHA_SITE_KEY.", "error");
    if (shouldRenderCaptcha && !captchaToken) return showNotification("Vui lòng xác thực Captcha", "warning");

    registerMutation({
      variables: {
        i: {
          fullName,
          email,
          password: registerForm.password,
          username: buildGeneratedUsername(email),
          customerType: "NEW",
          captchaToken: shouldRenderCaptcha ? captchaToken : undefined,
        },
      },
    });
  };

  const renderCaptcha = (ref) => {
    if (!shouldRenderCaptcha && !captchaConfigMissing) return null;
    return (
      <div className="captcha-container">
        {shouldRenderCaptcha ? (
          <ReCAPTCHA ref={ref} sitekey={CAPTCHA_SITE_KEY} size="normal" onChange={setCaptchaToken} />
        ) : (
          <p className="captcha-message captcha-message--danger">
            Captcha chưa được cấu hình. Vui lòng kiểm tra VITE_RECAPTCHA_SITE_KEY.
          </p>
        )}
      </div>
    );
  };

  return (
    <main className="login-page-wrapper">
      <div className="login-bg-grain" aria-hidden="true" />
      <a className="login-skip-link" href="#login-form-title">Bỏ qua đến form đăng nhập</a>

      <div className="mobile-switcher" aria-label="Chuyển chế độ đăng nhập">
        <button type="button" className={mobileMode === "login" ? "active" : ""} onClick={() => togglePanel(false)}>Đăng nhập</button>
        <button type="button" className={mobileMode === "register" ? "active" : ""} onClick={() => togglePanel(true)}>Đăng ký</button>
      </div>

      <section className={`container ${isRightPanelActive ? "right-panel-active" : ""}`} id="container" aria-label="Đăng nhập và đăng ký FoodHub">
        <div className={`form-container sign-up-container ${mobileMode === "login" ? "mobile-hidden" : ""}`}>
          <form className="auth-form auth-form--register" onSubmit={handleRegister}>
            <h1>Tạo tài khoản</h1>

            <label className="field-label" htmlFor="register-full-name">Họ và tên</label>
            <div className="input-wrapper"><FieldIcon type="user" /><input id="register-full-name" type="text" placeholder="Họ và tên" aria-label="Họ và tên" autoComplete="name" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} /></div>

            <label className="field-label" htmlFor="register-email">Email</label>
            <div className="input-wrapper"><FieldIcon type="mail" /><input id="register-email" type="email" placeholder="Email" aria-label="Email" autoComplete="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} /></div>

            <label className="field-label" htmlFor="register-password">Mật khẩu</label>
            <div className="input-wrapper"><FieldIcon type="lock" /><input id="register-password" type="password" placeholder="Mật khẩu" aria-label="Mật khẩu" autoComplete="new-password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} /></div>

            <label className="field-label" htmlFor="register-confirm-password">Nhập lại mật khẩu</label>
            <div className="input-wrapper"><FieldIcon type="lock" /><input id="register-confirm-password" type="password" placeholder="Nhập lại mật khẩu" aria-label="Nhập lại mật khẩu" autoComplete="new-password" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} /></div>

            <label className="check-card check-card--terms"><input type="checkbox" checked={registerForm.terms} onChange={(e) => setRegisterForm({ ...registerForm, terms: e.target.checked })} /><span>Tôi đồng ý với chính sách & điều khoản</span></label>
            {renderCaptcha(recaptchaRegisterRef)}
            <button type="submit" className="btn-primary" disabled={registerLoading || captchaConfigMissing}>{registerLoading ? "Đang tạo..." : "Đăng ký ngay"}</button>
            <div className="social-container" aria-label="Đăng ký bằng mạng xã hội"><button type="button" className="social social-facebook" aria-label="Đăng ký bằng Facebook sắp ra mắt" disabled>f</button><button type="button" className="social social-google" aria-label="Đăng ký bằng Google sắp ra mắt" disabled>G</button></div>
          </form>
        </div>

        <div className={`form-container sign-in-container ${mobileMode === "register" ? "mobile-hidden" : ""}`}>
          <form className="auth-form auth-form--login" onSubmit={handleLogin}>
            <h1 id="login-form-title">Đăng nhập</h1>

            <label className="field-label" htmlFor="login-identifier">Email, username hoặc số điện thoại</label>
            <div className="input-wrapper"><FieldIcon type="user" /><input id="login-identifier" type="text" placeholder="Email / Username / SĐT" aria-label="Email, username hoặc số điện thoại" autoComplete="username" value={loginForm.identifier} onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })} /></div>

            <label className="field-label" htmlFor="login-password">Mật khẩu</label>
            <div className="input-wrapper"><FieldIcon type="lock" /><input id="login-password" type={showPassword ? "text" : "password"} placeholder="Mật khẩu" aria-label="Mật khẩu" autoComplete="current-password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} /><button type="button" className="toggle-pw-btn" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword(!showPassword)}><FieldIcon type={showPassword ? "eye" : "eyeOff"} /></button></div>

            <a href="#" className="forgot-link" onClick={(e) => e.preventDefault()}>Quên mật khẩu?</a>
            {renderCaptcha(recaptchaLoginRef)}
            <div className="remember-card"><label className="check-row"><input type="checkbox" checked={loginForm.rememberSession} onChange={(e) => setLoginForm({ ...loginForm, rememberSession: e.target.checked })} /><span>Duy trì đăng nhập tối đa 30 ngày trên thiết bị này</span></label><label className="check-row"><input type="checkbox" checked={loginForm.rememberIdentifier} onChange={(e) => setLoginForm({ ...loginForm, rememberIdentifier: e.target.checked })} /><span>Ghi nhớ tài khoản (chỉ lưu email/số điện thoại)</span></label></div>
            <button type="submit" className="btn-primary" disabled={loginLoading || captchaConfigMissing}>{loginLoading ? "Đang xử lý..." : "Đăng nhập"}</button>
            <div className="social-container" aria-label="Đăng nhập bằng mạng xã hội"><button type="button" className="social social-facebook" aria-label="Đăng nhập bằng Facebook sắp ra mắt" disabled>f</button><button type="button" className="social social-google" aria-label="Đăng nhập bằng Google sắp ra mắt" disabled>G</button></div>
          </form>
        </div>

        <div className="overlay-container" aria-hidden="true">
          <div className="overlay">
            <FloatingFoodIcons />
            <div className="overlay-panel overlay-left">
              <h1>Chào mừng</h1>
              <p>Đăng nhập để tiếp tục đặt món, theo dõi đơn và lưu các lựa chọn yêu thích.</p>
              <button type="button" className="ghost" onClick={() => togglePanel(false)}>Đăng nhập</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Xin chào</h1>
              <p>Tạo tài khoản để đặt món nhanh hơn và cá nhân hóa trải nghiệm FoodHub.</p>
              <button type="button" className="ghost" onClick={() => togglePanel(true)}>Đăng ký</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
