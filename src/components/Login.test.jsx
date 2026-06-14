import React from "react";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthContext } from "@/context/AuthContext";

const notifications = [];
const loginMutationMock = vi.fn();
const registerMutationMock = vi.fn();
const loadRolesMock = vi.fn().mockResolvedValue({ data: { role: [{ id: "role-customer", slug: "customer" }] } });

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({
    showNotification: (message, type) => notifications.push({ message, type }),
  }),
}));

vi.mock("react-google-recaptcha", () => ({
  default: ({ onChange }) => (
    <button type="button" data-testid="mock-captcha" onClick={() => onChange("token-ok")}>
      solve captcha
    </button>
  ),
}));

vi.mock("@apollo/client", () => ({
  gql: (x) => x,
  useMutation: vi.fn((query) => {
    const label = String(query?.[0] || query || "");
    if (label.includes("mutation login")) {
      return [loginMutationMock, { loading: false }];
    }
    return [registerMutationMock, { loading: false }];
  }),
  useLazyQuery: vi.fn(() => [loadRolesMock]),
}));

const renderLogin = async () => {
  cleanup();
  const mod = await import("./Login");
  const LoginPage = mod.default;
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ login: vi.fn(), user: null, isAuthenticated: false, loading: false, rememberedLoginIdentifier: "" }}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
};

const getLoginForm = () => screen.getByRole("heading", { name: "Đăng nhập" }).closest("form");
const getRegisterForm = () => screen.getByRole("heading", { name: "Tạo tài khoản" }).closest("form");
const getPrimaryLoginButton = () => within(getLoginForm()).getByRole("button", { name: "Đăng nhập" });

describe("Login captcha config", () => {
  beforeEach(() => {
    notifications.length = 0;
    loginMutationMock.mockReset();
    registerMutationMock.mockReset();
    loadRolesMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("submits login when captcha is disabled", async () => {
    vi.stubEnv("VITE_ENABLE_RECAPTCHA", "false");
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    await renderLogin();

    const loginForm = getLoginForm();
    expect(screen.queryByTestId("mock-captcha")).not.toBeInTheDocument();
    fireEvent.change(within(loginForm).getByPlaceholderText("Email / Username / SĐT"), { target: { value: "user1" } });
    fireEvent.change(within(loginForm).getByPlaceholderText("Mật khẩu"), { target: { value: "123456" } });
    fireEvent.click(getPrimaryLoginButton());

    await waitFor(() => expect(loginMutationMock).toHaveBeenCalledTimes(1));
    expect(loginMutationMock.mock.calls[0][0].variables.captchaToken).toBeUndefined();
  });

  it("requires captcha token when enabled and site key exists", async () => {
    vi.stubEnv("VITE_ENABLE_RECAPTCHA", "true");
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site-key");
    await renderLogin();

    const loginForm = getLoginForm();
    expect(within(loginForm).getByTestId("mock-captcha")).toBeInTheDocument();
    fireEvent.change(within(loginForm).getByPlaceholderText("Email / Username / SĐT"), { target: { value: "user1" } });
    fireEvent.change(within(loginForm).getByPlaceholderText("Mật khẩu"), { target: { value: "123456" } });
    fireEvent.click(getPrimaryLoginButton());

    expect(loginMutationMock).not.toHaveBeenCalled();
    expect(notifications.some((n) => n.message.includes("Vui lòng xác thực Captcha"))).toBe(true);
  });

  it("shows config warning and disables submit when enabled but missing key", async () => {
    vi.stubEnv("VITE_ENABLE_RECAPTCHA", "true");
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    await renderLogin();

    expect(screen.getAllByText("Captcha chưa được cấu hình. Vui lòng kiểm tra VITE_RECAPTCHA_SITE_KEY.").length).toBeGreaterThan(0);
    expect(getPrimaryLoginButton()).toBeDisabled();
  });

  it("register submits without captcha token when disabled", async () => {
    vi.stubEnv("VITE_ENABLE_RECAPTCHA", "false");
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    await renderLogin();

    fireEvent.click(screen.getAllByRole("button", { name: "Đăng ký" })[0]);
    const registerForm = getRegisterForm();
    fireEvent.change(within(registerForm).getByPlaceholderText("Họ và tên"), { target: { value: "Tester" } });
    fireEvent.change(within(registerForm).getByPlaceholderText("Email"), { target: { value: "tester@example.com" } });
    fireEvent.change(within(registerForm).getByPlaceholderText("Username (Tên đăng nhập)"), { target: { value: "tester" } });
    fireEvent.change(within(registerForm).getByPlaceholderText("Mật khẩu"), { target: { value: "123456" } });
    fireEvent.change(within(registerForm).getByPlaceholderText("Nhập lại mật khẩu"), { target: { value: "123456" } });
    fireEvent.click(within(registerForm).getByRole("checkbox"));
    fireEvent.click(within(registerForm).getByRole("button", { name: "Đăng ký ngay" }));

    await waitFor(() => expect(registerMutationMock).toHaveBeenCalledTimes(1));
    expect(registerMutationMock.mock.calls[0][0].variables.i.captchaToken).toBeUndefined();
  });
});
