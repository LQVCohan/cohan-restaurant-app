import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toBackendRootUrl } from "@/lib/apiBaseUrl";
import { getRoleHomeRoute, resolveRoleName } from "@/routes/routeGuard";
import { isAccountVerified } from "@/utils/accountVerification";
import "./AccountVerification.product.css";
import "./BrandInvitationAccept.css";

const ACCEPT_BRAND_INVITATION = gql`
  mutation AcceptBrandInvitation($token: String!, $password: String) {
    acceptBrandInvitation(token: $token, password: $password) {
      id
      role
      status
      brand {
        id
        name
      }
    }
  }
`;

const CHANGE_MY_PASSWORD = gql`
  mutation ChangeRequiredPassword(
    $currentPassword: String!
    $newPassword: String!
  ) {
    changeMyPassword(
      currentPassword: $currentPassword
      newPassword: $newPassword
    )
  }
`;

const pathChannel = (pathname) => {
  if (pathname.includes("verify-phone")) return "SMS";
  return "EMAIL";
};

const PasswordEyeIcon = ({ visible }) => (
  <svg
    aria-hidden="true"
    className="brand-password-toggle__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {visible ? (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
        <path d="M7.1 7.6C4.2 9.2 2.5 12 2.5 12s3.5 6 9.5 6c1.6 0 3-.4 4.2-1" />
        <path d="M14.2 6.3C19 7.1 21.5 12 21.5 12a17 17 0 0 1-2.2 3" />
      </>
    )}
  </svg>
);

const PasswordVisibilityButton = ({ visible, onToggle, label }) => (
  <button
    type="button"
    className="brand-password-toggle"
    aria-label={`${visible ? "Ẩn" : "Hiện"} ${label}`}
    aria-pressed={visible}
    onClick={onToggle}
  >
    <PasswordEyeIcon visible={visible} />
  </button>
);

function getPasswordStrength(value = "") {
  if (!value) return { score: 0, tone: "empty", label: "Chưa nhập" };
  const score = [
    value.length >= 8,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
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
          <span
            key={index}
            className={index < strength.score ? "is-active" : ""}
          />
        ))}
      </span>
    </div>
  );
};

function resolveVerifyError(error) {
  const graphError = error?.graphQLErrors?.[0];
  const code = String(
    graphError?.extensions?.code || error?.code || "",
  ).toUpperCase();
  const message = graphError?.message || error?.message || "";

  if (
    code === "BAD_USER_INPUT" ||
    /expired|invalid|hết hạn|không hợp lệ/i.test(message)
  ) {
    return (
      message ||
      "Liên kết xác minh không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại email."
    );
  }

  if (code === "NETWORK_ERROR") {
    return "Không thể kết nối hệ thống để xác minh. Vui lòng kiểm tra kết nối hoặc thử lại sau.";
  }

  return message || "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}

async function verifyAccountByToken({ token, channel }) {
  let response;
  try {
    response = await fetch(toBackendRootUrl("/auth/verify-account"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, channel }),
    });
  } catch (err) {
    const error = new Error(err?.message || "Không thể kết nối hệ thống.");
    error.code = "NETWORK_ERROR";
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.message || "Không thể xác minh tài khoản.");
    error.code = data?.code || response.status;
    throw error;
  }
  return data;
}

export default function VerifyAccountConfirm({ forcedChannel }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get("token");
  const invitationToken = searchParams.get("inviteToken");
  const invitedEmail = String(searchParams.get("email") || "")
    .trim()
    .toLowerCase();
  const isBrandInvitation = Boolean(invitationToken);
  const isForcedPasswordChange =
    searchParams.get("forcePasswordChange") === "1";
  const autoAcceptInvitation =
    isBrandInvitation && searchParams.get("auto") === "1";
  const requiresInvitationPassword =
    isBrandInvitation && searchParams.get("new") === "1";
  const channel = useMemo(
    () =>
      forcedChannel ||
      String(
        searchParams.get("channel") || pathChannel(location.pathname),
      ).toUpperCase(),
    [forcedChannel, location.pathname, searchParams],
  );
  const navigate = useNavigate();
  const {
    login: authLogin,
    token: currentToken,
    user,
    isAuthenticated,
    loading: authLoading,
  } = useContext(AuthContext) || {};
  const [acceptBrandInvitation] = useMutation(ACCEPT_BRAND_INVITATION);
  const [changeMyPassword] = useMutation(CHANGE_MY_PASSWORD);
  const [status, setStatus] = useState(
    token || invitationToken ? "ready" : "checking-session",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [redirectPath, setRedirectPath] = useState("/");
  const [verifying, setVerifying] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const autoAcceptedRef = useRef(false);
  const isSms = channel === "SMS";

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  useEffect(() => {
    if (token || invitationToken) {
      setStatus((current) =>
        current === "error" || current === "checking-session"
          ? "ready"
          : current,
      );
      return;
    }

    if (authLoading) {
      setStatus("checking-session");
      return;
    }

    if (isForcedPasswordChange) {
      if (!isAuthenticated || !currentToken || !user) {
        setStatus("error");
        setErrorMessage(
          "Vui lòng đăng nhập bằng mật khẩu tạm trong email trước khi đổi mật khẩu.",
        );
        return;
      }
      if (user.forcePasswordChange || user.status === "force_password_change") {
        setStatus("ready");
        setErrorMessage("");
        return;
      }
      const nextPath = getRoleHomeRoute(
        resolveRoleName({ ...user, status: "active" }),
      );
      setRedirectPath(nextPath);
      setStatus("success");
      return;
    }

    if (isAuthenticated && user && isAccountVerified(user)) {
      setRedirectPath(getRoleHomeRoute(resolveRoleName(user)));
      setStatus("success");
      setErrorMessage("");
      return;
    }

    setStatus("error");
    setErrorMessage(
      "Thiếu mã xác minh trong liên kết. Vui lòng mở lại link từ email hoặc yêu cầu gửi lại email xác minh.",
    );
  }, [
    authLoading,
    currentToken,
    invitationToken,
    isAuthenticated,
    isForcedPasswordChange,
    token,
    user,
  ]);

  const acceptInvitation = async () => {
    if (!invitationToken) throw new Error("Thiếu mã lời mời.");
    if (requiresInvitationPassword) {
      if (!password) throw new Error("Vui lòng nhập mật khẩu mới.");
      if (password !== confirmPassword)
        throw new Error("Mật khẩu xác nhận không khớp.");
    }

    await acceptBrandInvitation({
      variables: {
        token: invitationToken,
        password: requiresInvitationPassword ? password : null,
      },
    });
    const loginPath = invitedEmail
      ? `/login?email=${encodeURIComponent(invitedEmail)}&invited=1`
      : "/login";
    setRedirectPath(loginPath);
    window.history.replaceState(null, "", "/verify-email/confirm");
    if (autoAcceptInvitation) navigate(loginPath, { replace: true });
  };

  const changeRequiredPassword = async () => {
    if (!isAuthenticated || !currentToken || !user) {
      throw new Error(
        "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.",
      );
    }
    if (!currentPassword) throw new Error("Vui lòng nhập mật khẩu tạm.");
    if (!password) throw new Error("Vui lòng nhập mật khẩu mới.");
    if (password !== confirmPassword)
      throw new Error("Mật khẩu xác nhận không khớp.");
    if (password === currentPassword)
      throw new Error("Mật khẩu mới phải khác mật khẩu tạm.");

    await changeMyPassword({
      variables: { currentPassword, newPassword: password },
    });

    const nextUser = {
      ...user,
      status: "active",
      forcePasswordChange: false,
    };
    await authLogin?.(currentToken, nextUser, null, { persistSession: true });
    const nextPath = getRoleHomeRoute(resolveRoleName(nextUser));
    setRedirectPath(nextPath);
    window.history.replaceState(null, "", "/verify-account/confirm");
  };

  const verifyAccount = async () => {
    if (!token) throw new Error("Thiếu mã xác minh trong liên kết.");
    const payload = await verifyAccountByToken({ token, channel });
    const verifiedUser = payload?.user;
    const issuedToken = payload?.token || currentToken;

    if (issuedToken && verifiedUser) {
      authLogin?.(issuedToken, verifiedUser, null, {
        persistSession: true,
        rememberIdentifier: true,
        identifier:
          verifiedUser.email || verifiedUser.phone || verifiedUser.username,
      });
      setRedirectPath(getRoleHomeRoute(resolveRoleName(verifiedUser)));
    } else if (currentToken && user) {
      const fallbackUser = {
        ...user,
        status: "active",
        emailVerified: channel === "EMAIL" ? true : user.emailVerified,
        phoneVerified: channel === "SMS" ? true : user.phoneVerified,
        verifiedAt: new Date().toISOString(),
      };
      authLogin?.(currentToken, fallbackUser, null, { persistSession: true });
      setRedirectPath(getRoleHomeRoute(resolveRoleName(fallbackUser)));
    } else {
      setRedirectPath("/login");
    }

    window.history.replaceState(
      null,
      "",
      isSms ? "/verify-phone/confirm" : "/verify-email/confirm",
    );
  };

  const handleConfirm = async () => {
    setVerifying(true);
    setStatus("verifying");
    setErrorMessage("");

    try {
      if (isBrandInvitation) await acceptInvitation();
      else if (isForcedPasswordChange) await changeRequiredPassword();
      else await verifyAccount();
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(resolveVerifyError(err));
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!autoAcceptInvitation || autoAcceptedRef.current) return;
    autoAcceptedRef.current = true;
    handleConfirm();
    // handleConfirm intentionally runs once for the one-use invitation token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAcceptInvitation]);

  const icon = isForcedPasswordChange
    ? "🔐"
    : isBrandInvitation
      ? "🏢"
      : isSms
        ? "📱"
        : "📧";

  return (
    <main
      className="account-verification-page"
      aria-labelledby="account-verification-title"
    >
      <section
        className="account-verification-card"
        aria-labelledby="account-verification-title"
        aria-live="polite"
      >
        {status === "checking-session" && (
          <>
            <div className="account-verification-spinner" aria-hidden="true" />
            <div className="account-verification-icon" aria-hidden="true">
              {icon}
            </div>
            <h1
              className="account-verification-title"
              id="account-verification-title"
            >
              Đang kiểm tra phiên đăng nhập
            </h1>
            <p className="account-verification-text">
              Cohan đang kiểm tra thông tin tài khoản trước khi tiếp tục.
            </p>
          </>
        )}

        {status === "ready" && (
          <>
            <div className="account-verification-icon" aria-hidden="true">
              {icon}
            </div>
            <h1
              className="account-verification-title"
              id="account-verification-title"
            >
              {isForcedPasswordChange
                ? "Đổi mật khẩu lần đầu"
                : isBrandInvitation
                  ? "Xác nhận lời mời tham gia chuỗi"
                  : "Xác nhận kích hoạt tài khoản"}
            </h1>
            <p className="account-verification-text">
              {isForcedPasswordChange
                ? "Bạn đang dùng mật khẩu tạm. Hãy tạo mật khẩu mới trước khi sử dụng các chức năng của Cohan."
                : isBrandInvitation
                  ? "Xác nhận lời mời để kích hoạt đúng vai trò và phạm vi chi nhánh đã được phân công."
                  : "Cohan đã nhận được liên kết xác minh. Nhấn nút bên dưới để kích hoạt tài khoản và đăng nhập tự động."}
            </p>
            <div
              className="account-verification-contact"
              aria-label="Thông tin yêu cầu"
            >
              <p>
                <strong>Loại yêu cầu:</strong>{" "}
                {isForcedPasswordChange
                  ? "Bảo mật lần đăng nhập đầu tiên"
                  : isBrandInvitation
                    ? "Lời mời thành viên chuỗi"
                    : isSms
                      ? "Xác minh số điện thoại"
                      : "Xác minh email"}
              </p>
              <p>
                <strong>Trạng thái:</strong>{" "}
                {isForcedPasswordChange
                  ? "Bắt buộc hoàn tất trước khi tiếp tục"
                  : "Liên kết chỉ dùng được một lần và có thời hạn"}
              </p>
            </div>

            {isForcedPasswordChange && (
              <div
                className="brand-invitation-password"
                aria-label="Đổi mật khẩu bắt buộc"
              >
                <label>
                  <span>Mật khẩu tạm</span>
                  <div className="brand-password-field">
                    <input
                      type={visiblePasswords.current ? "text" : "password"}
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Nhập mật khẩu trong email"
                    />
                    <PasswordVisibilityButton
                      visible={visiblePasswords.current}
                      label="mật khẩu tạm"
                      onToggle={() => togglePasswordVisibility("current")}
                    />
                  </div>
                </label>
                <label>
                  <span>Mật khẩu mới</span>
                  <div className="brand-password-field">
                    <input
                      type={visiblePasswords.new ? "text" : "password"}
                      autoComplete="new-password"
                      aria-describedby="forced-new-password-strength"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Tối thiểu 8 ký tự, đủ mạnh"
                    />
                    <PasswordVisibilityButton
                      visible={visiblePasswords.new}
                      label="mật khẩu mới"
                      onToggle={() => togglePasswordVisibility("new")}
                    />
                  </div>
                  <PasswordStrengthMeter
                    id="forced-new-password-strength"
                    password={password}
                  />
                </label>
                <label>
                  <span>Nhập lại mật khẩu mới</span>
                  <div className="brand-password-field">
                    <input
                      type={visiblePasswords.confirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                    />
                    <PasswordVisibilityButton
                      visible={visiblePasswords.confirm}
                      label="mật khẩu xác nhận"
                      onToggle={() => togglePasswordVisibility("confirm")}
                    />
                  </div>
                </label>
              </div>
            )}

            {requiresInvitationPassword && (
              <div
                className="brand-invitation-password"
                aria-label="Thiết lập mật khẩu tài khoản"
              >
                <label>
                  <span>Mật khẩu mới</span>
                  <div className="brand-password-field">
                    <input
                      type={visiblePasswords.new ? "text" : "password"}
                      autoComplete="new-password"
                      aria-describedby="invitation-new-password-strength"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Tối thiểu 8 ký tự, đủ mạnh"
                    />
                    <PasswordVisibilityButton
                      visible={visiblePasswords.new}
                      label="mật khẩu mới"
                      onToggle={() => togglePasswordVisibility("new")}
                    />
                  </div>
                  <PasswordStrengthMeter
                    id="invitation-new-password-strength"
                    password={password}
                  />
                </label>
                <label>
                  <span>Nhập lại mật khẩu</span>
                  <div className="brand-password-field">
                    <input
                      type={visiblePasswords.confirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Nhập lại mật khẩu"
                    />
                    <PasswordVisibilityButton
                      visible={visiblePasswords.confirm}
                      label="mật khẩu xác nhận"
                      onToggle={() => togglePasswordVisibility("confirm")}
                    />
                  </div>
                </label>
              </div>
            )}

            <div className="account-verification-actions">
              <button
                type="button"
                className="account-verification-button is-primary"
                onClick={handleConfirm}
                disabled={verifying}
              >
                {verifying
                  ? "Đang xử lý..."
                  : isForcedPasswordChange
                    ? "Đổi mật khẩu và tiếp tục"
                    : isBrandInvitation
                      ? "Xác nhận lời mời"
                      : "Xác nhận & đăng nhập"}
              </button>
              {!isForcedPasswordChange && (
                <button
                  type="button"
                  className="account-verification-button is-muted"
                  onClick={() =>
                    navigate(
                      invitedEmail
                        ? `/login?email=${encodeURIComponent(invitedEmail)}`
                        : "/login",
                      { replace: true },
                    )
                  }
                >
                  Để sau
                </button>
              )}
            </div>
          </>
        )}

        {status === "verifying" && (
          <>
            <div className="account-verification-spinner" aria-hidden="true" />
            <div className="account-verification-icon" aria-hidden="true">
              {icon}
            </div>
            <h1
              className="account-verification-title"
              id="account-verification-title"
            >
              {isForcedPasswordChange
                ? "Đang đổi mật khẩu"
                : isBrandInvitation
                  ? "Đang kích hoạt lời mời"
                  : "Đang xác minh tài khoản"}
            </h1>
            <p className="account-verification-text">
              {isForcedPasswordChange
                ? "Cohan đang lưu mật khẩu mới và mở quyền truy cập cho tài khoản."
                : isBrandInvitation
                  ? "Cohan đang kích hoạt tài khoản và chuyển bạn đến trang đăng nhập."
                  : "Cohan đang kiểm tra mã xác minh, kích hoạt tài khoản và tạo phiên đăng nhập cho bạn."}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              className="account-verification-icon is-success"
              aria-hidden="true"
            >
              ✓
            </div>
            <h1
              className="account-verification-title"
              id="account-verification-title"
            >
              {isForcedPasswordChange
                ? "Đã đổi mật khẩu"
                : isBrandInvitation
                  ? "Đã tham gia chuỗi"
                  : "Xác minh thành công"}
            </h1>
            <p className="account-verification-text">
              {isForcedPasswordChange
                ? "Mật khẩu mới đã được lưu. Bạn có thể tiếp tục sử dụng Cohan."
                : isBrandInvitation
                  ? "Quyền thành viên đã được kích hoạt. Hãy đăng nhập bằng thông tin được cung cấp trong email."
                  : "Tài khoản đã được kích hoạt và đăng nhập tự động trên thiết bị này."}
            </p>
            <div className="account-verification-actions">
              <button
                type="button"
                className="account-verification-button is-primary"
                onClick={() => navigate(redirectPath, { replace: true })}
              >
                {isForcedPasswordChange
                  ? "Tiếp tục vào Cohan"
                  : isBrandInvitation
                    ? "Đến trang đăng nhập"
                    : "Vào Cohan ngay"}
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className="account-verification-icon is-error"
              aria-hidden="true"
            >
              !
            </div>
            <h1
              className="account-verification-title"
              id="account-verification-title"
            >
              {isForcedPasswordChange
                ? "Không thể đổi mật khẩu"
                : isBrandInvitation
                  ? "Không thể xác nhận lời mời"
                  : "Không thể xác minh"}
            </h1>
            <p className="account-verification-text" role="alert">
              {errorMessage ||
                "Yêu cầu không thể hoàn tất. Vui lòng quay lại đăng nhập và thử lại."}
            </p>
            <div className="account-verification-actions">
              {isForcedPasswordChange && isAuthenticated ? (
                <button
                  type="button"
                  className="account-verification-button is-primary"
                  onClick={() => setStatus("ready")}
                >
                  Thử lại
                </button>
              ) : (
                <button
                  type="button"
                  className="account-verification-button is-primary"
                  onClick={() => navigate("/login")}
                >
                  Quay lại đăng nhập
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
