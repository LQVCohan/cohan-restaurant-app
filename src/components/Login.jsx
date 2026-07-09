import React, { useState, useContext, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { gql, useMutation } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";
import ReCAPTCHA from "react-google-recaptcha";
import { useNotification } from "@/hooks/useNotification";
import { getRoleHomeRoute, resolveRoleName } from "@/routes/routeGuard";
import { isAccountVerified } from "@/utils/accountVerification";

import "./Login.scss";
import "./LoginAuthA11yPolish.scss";

const CAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
const CAPTCHA_ENABLED =
  String(import.meta.env.VITE_ENABLE_RECAPTCHA ?? "true").toLowerCase() !==
  "false";
const shouldRenderCaptcha = CAPTCHA_ENABLED && Boolean(CAPTCHA_SITE_KEY);
const captchaConfigMissing = CAPTCHA_ENABLED && !CAPTCHA_SITE_KEY;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let googleIdentityScriptPromise;

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

const LOGIN_WITH_GOOGLE_MUTATION = gql`
  mutation LoginWithGoogle($idToken: String!) {
    loginWithGoogle(idToken: $idToken) {
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

const REGISTER_BUSINESS_OWNER = gql`
  mutation RegisterBusinessOwner($input: RegisterBusinessOwnerInput!) {
    registerBusinessOwner(input: $input) {
      user { id fullName email roleName status }
      brand { id name slug }
      restaurant { id name brandId }
      accessToken
      refreshToken
    }
  }
`;

const CUSTOMER_REGISTER_INITIAL = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  terms: false,
};

const BRAND_REGISTER_INITIAL = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  brandName: "",
  firstRestaurantName: "",
  address: "",
  terms: false,
};

function loadGoogleIdentityScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Identity is browser-only"));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);
    const script = existing || document.createElement("script");

    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      googleIdentityScriptPromise = null;
      reject(new Error("Google Identity script failed to load"));
    };

    if (!existing) document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
}

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
    phone: (
      <>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
      </>
    ),
    building: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M9 21v-4h6v4" />
      </>
    ),
    mapPin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
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
      {paths[type] || paths.user}
    </svg>
  );
};

const PasswordToggleButton = ({ visible, onToggle, label = "mật khẩu" }) => (
  <button
    type="button"
    className="toggle-pw-btn"
    aria-label={`${visible ? "Ẩn" : "Hiện"} ${label}`}
    aria-pressed={visible}
    onClick={onToggle}
  >
    <FieldIcon type={visible ? "eye" : "eyeOff"} />
  </button>
);

function getPasswordStrength(password = "") {
  if (!password) return { score: 0, tone: "empty", label: "Chưa nhập" };

  const score = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (score <= 1) return { score, tone: "weak", label: "Yếu" };
  if (score <= 3) return { score, tone: "medium", label: "Trung bình" };
  return { score, tone: "strong", label: "Mạnh" };
}

const PasswordStrengthMeter = ({ password, id }) => {
  const strength = getPasswordStrength(password);
  const helperText = password
    ? `Độ mạnh: ${strength.label}`
    : "Dùng ít nhất 8 ký tự, gồm chữ hoa, số và ký tự đặc biệt";

  return (
    <div
      id={id}
      className={`password-strength password-strength--${strength.tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="password-strength__label">{helperText}</span>
      <span className="password-strength__bars" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={index < strength.score ? "is-active" : ""} />
        ))}
      </span>
    </div>
  );
};

const FloatingFoodIcons = () => (
  <div className="floating-food-layer" aria-hidden="true">
    <span className="food-float food-float--1">VPOS</span>
    <span className="food-float food-float--2">BÀN</span>
    <span className="food-float food-float--3">ĐƠN</span>
    <span className="food-float food-float--4">CA</span>
  </div>
);

const AuthBrand = () => (
  <div className="auth-brand-row" aria-label="Cohan Restaurant App">
    <span className="auth-brand-mark">COHAN</span>
    <span className="auth-brand-name">Restaurant App</span>
  </div>
);

const LoginAudience = () => (
  <div className="auth-audience-grid" aria-label="Nền tảng cho khách hàng và thương hiệu">
    <span>
      <strong>Khách hàng</strong>
      <small>Đặt món, ví, khẩu vị</small>
    </span>
    <span>
      <strong>Thương hiệu</strong>
      <small>Thương hiệu, chi nhánh, POS</small>
    </span>
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

  if (msg.includes("already in use") || msg.includes("duplicate") || msg.includes("already exists")) return "Email hoặc thương hiệu này đã được sử dụng.";
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
  const [registerMode, setRegisterMode] = useState("customer");
  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
    rememberIdentifier: true,
  });
  const [registerForm, setRegisterForm] = useState(CUSTOMER_REGISTER_INITIAL);
  const [brandRegisterForm, setBrandRegisterForm] = useState(BRAND_REGISTER_INITIAL);
  const [showPassword, setShowPassword] = useState(false);
  const [registerPasswordVisibility, setRegisterPasswordVisibility] = useState({
    customer: false,
    customerConfirm: false,
    brand: false,
    brandConfirm: false,
  });
  const [captchaToken, setCaptchaToken] = useState("");

  const recaptchaLoginRef = useRef(null);
  const recaptchaRegisterRef = useRef(null);
  const googleButtonRef = useRef(null);

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

  const switchRegisterMode = (mode) => {
    setRegisterMode(mode);
    resetCaptcha();
  };

  const toggleRegisterPasswordVisibility = (field) => {
    setRegisterPasswordVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  useEffect(() => {
    if (location?.state?.authMode !== "register") return;
    setIsRightPanelActive(true);
    setMobileMode("register");
    if (location.state.registerMode === "brand") setRegisterMode("brand");
  }, [location?.state]);

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
        rememberIdentifier: loginForm.rememberIdentifier,
        identifier: loginForm.identifier,
      });
      showNotification(`Chào mừng ${loggedInUser.fullName || loggedInUser.username}.`, "success");
    },
  });

  const [loginWithGoogle, { loading: googleLoginLoading }] = useMutation(LOGIN_WITH_GOOGLE_MUTATION, {
    errorPolicy: "none",
    onError: (error) => showNotification(resolveLoginErrorMessage(error), "error"),
    onCompleted: (data) => {
      const token = data?.loginWithGoogle?.token;
      const loggedInUser = data?.loginWithGoogle?.user;
      if (!token || !loggedInUser) {
        showNotification("Đăng nhập Google không thành công. Vui lòng thử lại.", "error");
        return;
      }
      authLogin(token, loggedInUser, null, {
        rememberIdentifier: true,
        identifier: loggedInUser.email || "",
      });
      showNotification(`Chào mừng ${loggedInUser.fullName || loggedInUser.email}.`, "success");
    },
  });

  const handleGoogleCredential = useCallback(
    (response) => {
      const idToken = response?.credential;
      if (!idToken) {
        showNotification("Google không trả về mã đăng nhập. Vui lòng thử lại.", "error");
        return;
      }
      loginWithGoogle({ variables: { idToken } });
    },
    [loginWithGoogle, showNotification],
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || mobileMode !== "login" || isRightPanelActive) return undefined;
    let cancelled = false;

    loadGoogleIdentityScript()
      .then((google) => {
        if (cancelled || !google?.accounts?.id || !googleButtonRef.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          ux_mode: "popup",
        });
        googleButtonRef.current.innerHTML = "";
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 300,
        });
      })
      .catch(() => {
        if (!cancelled) showNotification("Không tải được Google Sign-In. Vui lòng thử lại sau.", "error");
      });

    return () => {
      cancelled = true;
    };
  }, [handleGoogleCredential, isRightPanelActive, mobileMode, showNotification]);

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

      setRegisterForm(CUSTOMER_REGISTER_INITIAL);
    },
  });

  const [registerBusinessOwner, { loading: brandRegisterLoading }] = useMutation(REGISTER_BUSINESS_OWNER, {
    errorPolicy: "none",
    onError: (error) => showNotification(resolveRegisterErrorMessage(error), "error"),
    onCompleted: (data) => {
      const payload = data?.registerBusinessOwner;
      if (!payload?.accessToken || !payload?.user) {
        showNotification("Đăng ký thương hiệu thành công. Vui lòng đăng nhập để tiếp tục.", "success");
        togglePanel(false);
        return;
      }
      authLogin(payload.accessToken, payload.user);
      showNotification(`Đã tạo thương hiệu ${payload.brand?.name || "mới"}.`, "success");
      navigate("/manager", { replace: true });
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

  const handleCustomerRegister = () => {
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

  const handleBrandRegister = () => {
    const fullName = brandRegisterForm.fullName.trim();
    const email = brandRegisterForm.email.trim().toLowerCase();
    const brandName = brandRegisterForm.brandName.trim();
    const firstRestaurantName = brandRegisterForm.firstRestaurantName.trim();
    const address = brandRegisterForm.address.trim();

    if (!fullName || !email || !brandName || !brandRegisterForm.password) return showNotification("Vui lòng nhập người đại diện, email, mật khẩu và tên thương hiệu", "warning");
    if (brandRegisterForm.password !== brandRegisterForm.confirmPassword) return showNotification("Mật khẩu xác nhận không khớp", "error");
    if (!brandRegisterForm.terms) return showNotification("Bạn cần đồng ý với chính sách & điều khoản", "warning");

    registerBusinessOwner({
      variables: {
        input: {
          fullName,
          email,
          phone: brandRegisterForm.phone.trim() || undefined,
          password: brandRegisterForm.password,
          brandName,
          businessName: brandName,
          businessEmail: email,
          businessPhone: brandRegisterForm.phone.trim() || undefined,
          createFirstRestaurant: true,
          firstRestaurantName: firstRestaurantName || brandName,
          firstRestaurantAddress: address ? { line1: address, country: "Vietnam" } : undefined,
        },
      },
    });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (registerMode === "brand") return handleBrandRegister();
    return handleCustomerRegister();
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

  const renderRegisterModeSwitch = () => (
    <div className="auth-mode-switch" role="tablist" aria-label="Chọn loại tài khoản đăng ký">
      <button type="button" role="tab" aria-selected={registerMode === "customer"} className={registerMode === "customer" ? "active" : ""} onClick={() => switchRegisterMode("customer")}>Khách hàng</button>
      <button type="button" role="tab" aria-selected={registerMode === "brand"} className={registerMode === "brand" ? "active" : ""} onClick={() => switchRegisterMode("brand")}>Thương hiệu</button>
    </div>
  );

  const isBrandRegister = registerMode === "brand";
  const submitLoading = isBrandRegister ? brandRegisterLoading : registerLoading;

  return (
    <main className="login-page-wrapper" aria-labelledby="login-form-title">
      <div className="login-bg-grain" aria-hidden="true" />
      <a className="login-skip-link" href="#login-form-title">Bỏ qua đến form đăng nhập</a>

      <div className="mobile-switcher" role="tablist" aria-label="Chuyển chế độ đăng nhập">
        <button type="button" role="tab" aria-selected={mobileMode === "login"} aria-controls="login-panel" className={mobileMode === "login" ? "active" : ""} onClick={() => togglePanel(false)}>Đăng nhập</button>
        <button type="button" role="tab" aria-selected={mobileMode === "register"} aria-controls="register-panel" className={mobileMode === "register" ? "active" : ""} onClick={() => togglePanel(true)}>Đăng ký</button>
      </div>

      <section className={`container ${isRightPanelActive ? "right-panel-active" : ""}`} id="container" aria-label="Đăng nhập và đăng ký Cohan">
        <div id="register-panel" className={`form-container sign-up-container ${mobileMode === "login" ? "mobile-hidden" : ""}`}>
          <form className={`auth-form auth-form--register ${isBrandRegister ? "auth-form--brand-register" : ""}`} onSubmit={handleRegister} aria-labelledby="register-form-title">
            <AuthBrand />
            <h1 id="register-form-title">Đăng ký</h1>
            {renderRegisterModeSwitch()}

            {isBrandRegister ? (
              <>
                <p className="auth-subtitle">Tạo thương hiệu trước, sau đó hệ thống sẽ tạo chi nhánh đầu tiên cho thương hiệu đó.</p>
                <label className="field-label" htmlFor="brand-register-full-name">Người đại diện</label>
                <div className="input-wrapper"><FieldIcon type="user" /><input id="brand-register-full-name" type="text" placeholder="Họ và tên" autoComplete="name" value={brandRegisterForm.fullName} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, fullName: e.target.value })} /></div>

                <label className="field-label" htmlFor="brand-register-email">Email quản trị</label>
                <div className="input-wrapper"><FieldIcon type="mail" /><input id="brand-register-email" type="email" placeholder="Email" autoComplete="email" value={brandRegisterForm.email} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, email: e.target.value })} /></div>

                <label className="field-label" htmlFor="brand-register-phone">Số điện thoại</label>
                <div className="input-wrapper"><FieldIcon type="phone" /><input id="brand-register-phone" type="tel" placeholder="Số điện thoại" autoComplete="tel" value={brandRegisterForm.phone} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, phone: e.target.value })} /></div>

                <label className="field-label" htmlFor="brand-register-password">Mật khẩu</label>
                <div className="password-field">
                  <div className="input-wrapper">
                    <FieldIcon type="lock" />
                    <input id="brand-register-password" type={registerPasswordVisibility.brand ? "text" : "password"} placeholder="Mật khẩu" autoComplete="new-password" aria-describedby="brand-register-password-strength" value={brandRegisterForm.password} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, password: e.target.value })} />
                    <PasswordToggleButton visible={registerPasswordVisibility.brand} onToggle={() => toggleRegisterPasswordVisibility("brand")} />
                  </div>
                  <PasswordStrengthMeter id="brand-register-password-strength" password={brandRegisterForm.password} />
                </div>

                <label className="field-label" htmlFor="brand-register-confirm-password">Nhập lại mật khẩu</label>
                <div className="input-wrapper">
                  <FieldIcon type="lock" />
                  <input id="brand-register-confirm-password" type={registerPasswordVisibility.brandConfirm ? "text" : "password"} placeholder="Nhập lại mật khẩu" autoComplete="new-password" value={brandRegisterForm.confirmPassword} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, confirmPassword: e.target.value })} />
                  <PasswordToggleButton visible={registerPasswordVisibility.brandConfirm} label="mật khẩu xác nhận" onToggle={() => toggleRegisterPasswordVisibility("brandConfirm")} />
                </div>

                <label className="field-label" htmlFor="brand-register-name">Tên thương hiệu</label>
                <div className="input-wrapper"><FieldIcon type="building" /><input id="brand-register-name" type="text" placeholder="VD: Cohan Restaurant" autoComplete="organization" value={brandRegisterForm.brandName} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, brandName: e.target.value })} /></div>

                <label className="field-label" htmlFor="brand-register-restaurant">Chi nhánh đầu tiên</label>
                <div className="input-wrapper"><FieldIcon type="building" /><input id="brand-register-restaurant" type="text" placeholder="Để trống sẽ dùng tên thương hiệu" autoComplete="organization" value={brandRegisterForm.firstRestaurantName} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, firstRestaurantName: e.target.value })} /></div>

                <label className="field-label" htmlFor="brand-register-address">Địa chỉ chi nhánh</label>
                <div className="input-wrapper"><FieldIcon type="mapPin" /><input id="brand-register-address" type="text" placeholder="Địa chỉ" autoComplete="street-address" value={brandRegisterForm.address} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, address: e.target.value })} /></div>

                <label className="check-card check-card--terms"><input type="checkbox" checked={brandRegisterForm.terms} onChange={(e) => setBrandRegisterForm({ ...brandRegisterForm, terms: e.target.checked })} /><span>Tôi đồng ý với chính sách & điều khoản</span></label>
              </>
            ) : (
              <>
                <label className="field-label" htmlFor="register-full-name">Họ và tên</label>
                <div className="input-wrapper"><FieldIcon type="user" /><input id="register-full-name" type="text" placeholder="Họ và tên" aria-label="Họ và tên" autoComplete="name" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} /></div>

                <label className="field-label" htmlFor="register-email">Email</label>
                <div className="input-wrapper"><FieldIcon type="mail" /><input id="register-email" type="email" placeholder="Email" aria-label="Email" autoComplete="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} /></div>

                <label className="field-label" htmlFor="register-password">Mật khẩu</label>
                <div className="password-field">
                  <div className="input-wrapper">
                    <FieldIcon type="lock" />
                    <input id="register-password" type={registerPasswordVisibility.customer ? "text" : "password"} placeholder="Mật khẩu" aria-label="Mật khẩu" aria-describedby="register-password-strength" autoComplete="new-password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
                    <PasswordToggleButton visible={registerPasswordVisibility.customer} onToggle={() => toggleRegisterPasswordVisibility("customer")} />
                  </div>
                  <PasswordStrengthMeter id="register-password-strength" password={registerForm.password} />
                </div>

                <label className="field-label" htmlFor="register-confirm-password">Nhập lại mật khẩu</label>
                <div className="input-wrapper">
                  <FieldIcon type="lock" />
                  <input id="register-confirm-password" type={registerPasswordVisibility.customerConfirm ? "text" : "password"} placeholder="Nhập lại mật khẩu" aria-label="Nhập lại mật khẩu" autoComplete="new-password" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} />
                  <PasswordToggleButton visible={registerPasswordVisibility.customerConfirm} label="mật khẩu xác nhận" onToggle={() => toggleRegisterPasswordVisibility("customerConfirm")} />
                </div>

                <label className="check-card check-card--terms"><input type="checkbox" checked={registerForm.terms} onChange={(e) => setRegisterForm({ ...registerForm, terms: e.target.checked })} /><span>Tôi đồng ý với chính sách & điều khoản</span></label>
                {renderCaptcha(recaptchaRegisterRef)}
              </>
            )}
            <button type="submit" className="btn-primary" disabled={submitLoading || (!isBrandRegister && captchaConfigMissing)}>{submitLoading ? "Đang tạo..." : isBrandRegister ? "Đăng ký thương hiệu" : "Đăng ký"}</button>
          </form>
        </div>

        <div id="login-panel" className={`form-container sign-in-container ${mobileMode === "register" ? "mobile-hidden" : ""}`}>
          <form className="auth-form auth-form--login" onSubmit={handleLogin} aria-labelledby="login-form-title">
            <AuthBrand />
            <h1 id="login-form-title">Đăng nhập</h1>
            <LoginAudience />

            <label className="field-label" htmlFor="login-identifier">Email, username hoặc số điện thoại</label>
            <div className="input-wrapper"><FieldIcon type="user" /><input id="login-identifier" type="text" placeholder="Email / Username / SĐT" aria-label="Email, username hoặc số điện thoại" autoComplete="username" value={loginForm.identifier} onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })} /></div>

            <label className="field-label" htmlFor="login-password">Mật khẩu</label>
            <div className="input-wrapper"><FieldIcon type="lock" /><input id="login-password" type={showPassword ? "text" : "password"} placeholder="Mật khẩu" aria-label="Mật khẩu" autoComplete="current-password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} /><PasswordToggleButton visible={showPassword} onToggle={() => setShowPassword((current) => !current)} /></div>

            <button type="button" className="forgot-link" onClick={() => showNotification("Vui lòng liên hệ quản trị viên nhà hàng hoặc bộ phận hỗ trợ để đặt lại mật khẩu.", "info")}>Quên mật khẩu?</button>
            {renderCaptcha(recaptchaLoginRef)}
            <div className="remember-card"><label className="check-row"><input type="checkbox" checked={loginForm.rememberIdentifier} onChange={(e) => setLoginForm({ ...loginForm, rememberIdentifier: e.target.checked })} /><span>Ghi nhớ tài khoản trên thiết bị này (chỉ lưu email/số điện thoại)</span></label></div>
            <button type="submit" className="btn-primary" disabled={loginLoading || captchaConfigMissing}>{loginLoading ? "Đang xử lý..." : "Đăng nhập"}</button>
            <div className="google-login-row" aria-label="Đăng nhập bằng Google">
              <div className="google-login-divider"><span>Hoặc</span></div>
              {GOOGLE_CLIENT_ID ? (
                <div ref={googleButtonRef} className="google-login-button" aria-busy={googleLoginLoading} />
              ) : (
                <button type="button" className="google-login-fallback" disabled>Google chưa cấu hình</button>
              )}
            </div>
          </form>
        </div>

        <div className="overlay-container">
          <div className="overlay">
            <FloatingFoodIcons />
            <div className="overlay-panel overlay-left">
              <h1>Chào mừng</h1>
              <p>Đăng ký khách hàng để đặt món, hoặc đăng ký thương hiệu để tạo thương hiệu và chi nhánh đầu tiên.</p>
              <div className="overlay-access-stack">
                <span><strong>Khách hàng</strong><small>Đặt món, ví, khẩu vị</small></span>
                <span><strong>Thương hiệu</strong><small>Tạo thương hiệu, chi nhánh, POS</small></span>
              </div>
              <button type="button" className="ghost" onClick={() => togglePanel(false)}>Đăng nhập</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Xin chào</h1>
              <p>Đăng nhập Cohan để tiếp tục với đúng vai trò: khách hàng hoặc đội vận hành thương hiệu.</p>
              <div className="overlay-access-stack">
                <span><strong>Khách hàng</strong><small>Theo dõi đơn & ưu đãi</small></span>
                <span><strong>Thương hiệu</strong><small>Kiểm soát thương hiệu, bàn, ca, POS</small></span>
              </div>
              <button type="button" className="ghost" onClick={() => togglePanel(true)}>Đăng ký</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
