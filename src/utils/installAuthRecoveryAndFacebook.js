import { gql } from "@apollo/client";
import { apolloClient } from "@/apollo/client";
import { setAuth } from "@/lib/authStorage";

const FACEBOOK_APP_ID = String(
  import.meta.env.VITE_FACEBOOK_APP_ID || "",
).trim();
const FACEBOOK_API_VERSION = String(
  import.meta.env.VITE_FACEBOOK_GRAPH_API_VERSION || "v23.0",
).trim();
const FACEBOOK_SDK_URL = "https://connect.facebook.net/vi_VN/sdk.js";

const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

const LOGIN_WITH_FACEBOOK = gql`
  mutation LoginWithFacebook($accessToken: String!) {
    loginWithFacebook(accessToken: $accessToken) {
      token
      user {
        id
        fullName
        email
        roleName
        status
        emailVerified
        phoneVerified
        avatarUrl
      }
    }
  }
`;

let installed = false;
let facebookSdkPromise = null;
let modalRoot = null;

function errorMessage(error, fallback) {
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.message ||
    fallback
  );
}

function currentResetToken() {
  if (typeof window === "undefined") return "";
  return new URL(window.location.href).searchParams.get("resetToken") || "";
}

function clearResetTokenFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("resetToken");
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function ensureModalRoot() {
  if (modalRoot?.isConnected) return modalRoot;

  modalRoot = document.createElement("div");
  modalRoot.className = "auth-recovery-modal";
  modalRoot.hidden = true;
  modalRoot.innerHTML = `
    <div class="auth-recovery-modal__backdrop" data-auth-modal-close></div>
    <section class="auth-recovery-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="auth-recovery-title">
      <button class="auth-recovery-modal__close" type="button" aria-label="Đóng" data-auth-modal-close>×</button>
      <div class="auth-recovery-modal__brand">COHAN SECURITY</div>
      <form class="auth-recovery-form" data-auth-recovery-request>
        <h2 id="auth-recovery-title">Quên mật khẩu</h2>
        <p>Nhập email đã đăng ký. Hệ thống sẽ gửi liên kết tạo mật khẩu mới, có hiệu lực trong thời gian ngắn.</p>
        <label for="auth-recovery-email">Email tài khoản</label>
        <input id="auth-recovery-email" name="email" type="email" autocomplete="email" required placeholder="ban@example.com" />
        <div class="auth-recovery-form__status" aria-live="polite"></div>
        <button type="submit" class="auth-recovery-form__submit">Gửi liên kết đặt lại</button>
      </form>
      <form class="auth-recovery-form" data-auth-recovery-reset hidden>
        <h2 id="auth-reset-title">Tạo mật khẩu mới</h2>
        <p>Mật khẩu nên có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</p>
        <label for="auth-recovery-password">Mật khẩu mới</label>
        <input id="auth-recovery-password" name="password" type="password" autocomplete="new-password" minlength="8" required />
        <label for="auth-recovery-confirm">Nhập lại mật khẩu</label>
        <input id="auth-recovery-confirm" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
        <div class="auth-recovery-form__status" aria-live="polite"></div>
        <button type="submit" class="auth-recovery-form__submit">Cập nhật mật khẩu</button>
      </form>
    </section>
  `;

  document.body.appendChild(modalRoot);

  modalRoot.addEventListener("click", (event) => {
    if (event.target.closest("[data-auth-modal-close]")) closeModal();
  });

  modalRoot
    .querySelector("[data-auth-recovery-request]")
    .addEventListener("submit", handlePasswordResetRequest);
  modalRoot
    .querySelector("[data-auth-recovery-reset]")
    .addEventListener("submit", handlePasswordResetSubmit);

  return modalRoot;
}

function showForm(mode) {
  const root = ensureModalRoot();
  const requestForm = root.querySelector("[data-auth-recovery-request]");
  const resetForm = root.querySelector("[data-auth-recovery-reset]");
  const isReset = mode === "reset";
  requestForm.hidden = isReset;
  resetForm.hidden = !isReset;
  root.querySelector(".auth-recovery-modal__dialog").setAttribute(
    "aria-labelledby",
    isReset ? "auth-reset-title" : "auth-recovery-title",
  );
}

function openModal(mode = "request") {
  const root = ensureModalRoot();
  showForm(mode);
  root.hidden = false;
  document.documentElement.classList.add("auth-recovery-is-open");
  const input = root.querySelector(
    mode === "reset" ? "#auth-recovery-password" : "#auth-recovery-email",
  );
  window.setTimeout(() => input?.focus(), 0);
}

function closeModal() {
  if (!modalRoot) return;
  modalRoot.hidden = true;
  document.documentElement.classList.remove("auth-recovery-is-open");
}

function setFormStatus(form, message, tone = "info") {
  const status = form.querySelector(".auth-recovery-form__status");
  status.textContent = message || "";
  status.dataset.tone = tone;
}

function setFormBusy(form, busy) {
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = busy;
  submit.setAttribute("aria-busy", busy ? "true" : "false");
}

async function handlePasswordResetRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = String(new FormData(form).get("email") || "")
    .trim()
    .toLowerCase();

  if (!email) {
    setFormStatus(form, "Vui lòng nhập email.", "error");
    return;
  }

  setFormBusy(form, true);
  setFormStatus(form, "Đang gửi liên kết...", "info");

  try {
    await apolloClient.mutate({
      mutation: REQUEST_PASSWORD_RESET,
      variables: { email },
      fetchPolicy: "no-cache",
    });
    setFormStatus(
      form,
      "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi. Hãy kiểm tra cả thư rác.",
      "success",
    );
    form.reset();
  } catch (error) {
    setFormStatus(
      form,
      errorMessage(
        error,
        "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.",
      ),
      "error",
    );
  } finally {
    setFormBusy(form, false);
  }
}

async function handlePasswordResetSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const password = String(values.get("password") || "");
  const confirmPassword = String(values.get("confirmPassword") || "");
  const token = currentResetToken();

  if (!token) {
    setFormStatus(
      form,
      "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã bị xóa.",
      "error",
    );
    return;
  }
  if (password.length < 8) {
    setFormStatus(form, "Mật khẩu phải có ít nhất 8 ký tự.", "error");
    return;
  }
  if (password !== confirmPassword) {
    setFormStatus(form, "Mật khẩu nhập lại không khớp.", "error");
    return;
  }

  setFormBusy(form, true);
  setFormStatus(form, "Đang cập nhật mật khẩu...", "info");

  try {
    await apolloClient.mutate({
      mutation: RESET_PASSWORD,
      variables: { token, newPassword: password },
      fetchPolicy: "no-cache",
    });
    clearResetTokenFromUrl();
    form.reset();
    setFormStatus(
      form,
      "Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.",
      "success",
    );
    window.setTimeout(closeModal, 1200);
  } catch (error) {
    setFormStatus(
      form,
      errorMessage(
        error,
        "Không thể cập nhật mật khẩu. Liên kết có thể đã hết hạn.",
      ),
      "error",
    );
  } finally {
    setFormBusy(form, false);
  }
}

function loadFacebookSdk() {
  if (!FACEBOOK_APP_ID) {
    return Promise.reject(new Error("Facebook Login chưa được cấu hình."));
  }
  if (window.FB) return Promise.resolve(window.FB);
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise((resolve, reject) => {
    const previousInit = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      if (typeof previousInit === "function") previousInit();
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: FACEBOOK_API_VERSION,
      });
      resolve(window.FB);
    };

    const existing = document.querySelector(
      `script[src="${FACEBOOK_SDK_URL}"]`,
    );
    const script = existing || document.createElement("script");
    script.src = FACEBOOK_SDK_URL;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      facebookSdkPromise = null;
      reject(new Error("Không tải được Facebook SDK."));
    };
    if (!existing) document.head.appendChild(script);
  });

  return facebookSdkPromise;
}

function facebookLogin(FB) {
  return new Promise((resolve, reject) => {
    FB.login(
      (response) => {
        const accessToken = response?.authResponse?.accessToken;
        if (accessToken) resolve(accessToken);
        else reject(new Error("Bạn đã hủy hoặc chưa cấp quyền đăng nhập Facebook."));
      },
      {
        scope: "public_profile,email",
        return_scopes: true,
      },
    );
  });
}

function setFacebookStatus(row, message, tone = "info") {
  let status = row.querySelector(".facebook-login-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "facebook-login-status";
    status.setAttribute("aria-live", "polite");
    row.appendChild(status);
  }
  status.textContent = message || "";
  status.dataset.tone = tone;
}

async function handleFacebookLogin(event) {
  const button = event.currentTarget;
  const row = button.closest(".google-login-row");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  setFacebookStatus(row, "Đang mở Facebook...", "info");

  try {
    const FB = await loadFacebookSdk();
    const accessToken = await facebookLogin(FB);
    setFacebookStatus(row, "Đang xác thực tài khoản...", "info");

    const { data } = await apolloClient.mutate({
      mutation: LOGIN_WITH_FACEBOOK,
      variables: { accessToken },
      fetchPolicy: "no-cache",
    });
    const token = data?.loginWithFacebook?.token;
    if (!token) throw new Error("Facebook Login không trả về phiên đăng nhập.");

    setAuth({ token });
    setFacebookStatus(row, "Đăng nhập thành công. Đang chuyển trang...", "success");
    window.location.assign("/");
  } catch (error) {
    setFacebookStatus(
      row,
      errorMessage(error, "Đăng nhập Facebook không thành công."),
      "error",
    );
    button.disabled = false;
    button.setAttribute("aria-busy", "false");
  }
}

function injectFacebookButton() {
  document.querySelectorAll(".google-login-row").forEach((row) => {
    if (row.querySelector(".facebook-login-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "facebook-login-button";
    button.innerHTML = `
      <span class="facebook-login-button__icon" aria-hidden="true">f</span>
      <span>${FACEBOOK_APP_ID ? "Tiếp tục với Facebook" : "Facebook chưa cấu hình"}</span>
    `;
    button.disabled = !FACEBOOK_APP_ID;
    button.addEventListener("click", handleFacebookLogin);
    row.appendChild(button);
  });
}

function handleDocumentClick(event) {
  const forgotLink = event.target.closest?.(".forgot-link");
  if (!forgotLink) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  openModal("request");
}

function handleDocumentKeydown(event) {
  if (event.key === "Escape" && modalRoot && !modalRoot.hidden) closeModal();
}

export function installAuthRecoveryAndFacebook() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.addEventListener("click", handleDocumentClick, true);
  document.addEventListener("keydown", handleDocumentKeydown);

  const observer = new MutationObserver(() => injectFacebookButton());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  injectFacebookButton();

  if (currentResetToken()) {
    window.setTimeout(() => openModal("reset"), 0);
  }
}
