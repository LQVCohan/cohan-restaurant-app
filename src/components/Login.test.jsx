import React from "react";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthContext } from "@/context/AuthContext";

const mocks = vi.hoisted(() => {
  vi.stubEnv("VITE_ENABLE_RECAPTCHA", "false");
  vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
  return {
    notifications: [],
    loginMutationMock: vi.fn(),
    registerMutationMock: vi.fn(),
    loadRolesMock: vi.fn(),
    authLoginMock: vi.fn(),
  };
});

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({
    showNotification: (message, type) => mocks.notifications.push({ message, type }),
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
  gql: (parts) => parts,
  useMutation: vi.fn((query) => {
    const label = String(query?.[0] || query || "");
    if (label.includes("mutation login")) {
      return [mocks.loginMutationMock, { loading: false }];
    }
    return [mocks.registerMutationMock, { loading: false }];
  }),
  useLazyQuery: vi.fn(() => [mocks.loadRolesMock]),
}));

import LoginPage from "./Login";

const renderLogin = () => render(
  <MemoryRouter>
    <AuthContext.Provider value={{ login: mocks.authLoginMock, user: null, isAuthenticated: false, loading: false, rememberedLoginIdentifier: "" }}>
      <LoginPage />
    </AuthContext.Provider>
  </MemoryRouter>,
);

const getLoginForm = () => screen.getAllByRole("heading", { name: "Đăng nhập" })
  .map((heading) => heading.closest("form"))
  .find((form) => form && within(form).queryByPlaceholderText("Email / Username / SĐT"));
const getRegisterForm = () => screen.getByRole("form", { name: "Đăng ký" });
const getPrimaryLoginButton = () => within(getLoginForm()).getByRole("button", { name: "Đăng nhập" });

describe("Login captcha config", () => {
  beforeEach(() => {
    cleanup();
    mocks.notifications.length = 0;
    mocks.authLoginMock.mockClear();
    mocks.loginMutationMock.mockReset();
    mocks.registerMutationMock.mockReset();
    mocks.loadRolesMock.mockReset();
    mocks.loginMutationMock.mockResolvedValue({ data: { login: { token: "token-1", user: { id: "user-1", fullName: "Tester", roleName: "customer" } } } });
    mocks.registerMutationMock.mockResolvedValue({ data: { createUser: { token: "token-2", user: { id: "user-2", status: "active", email: "tester@example.com", fullName: "Tester" } } } });
    mocks.loadRolesMock.mockResolvedValue({ data: { role: [{ id: "role-customer", slug: "customer" }] } });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits login when captcha is disabled", async () => {
    renderLogin();

    const loginForm = getLoginForm();
    expect(screen.queryByTestId("mock-captcha")).not.toBeInTheDocument();
    fireEvent.change(within(loginForm).getByPlaceholderText("Email / Username / SĐT"), { target: { value: "user1" } });
    fireEvent.change(within(loginForm).getByPlaceholderText("Mật khẩu"), { target: { value: "123456" } });
    fireEvent.submit(loginForm);

    await waitFor(() => expect(mocks.loginMutationMock).toHaveBeenCalledTimes(1));
    expect(mocks.loginMutationMock.mock.calls[0][0].variables.captchaToken).toBeUndefined();
  });

  it("keeps captcha hidden and login submit enabled when captcha is disabled", () => {
    renderLogin();

    const loginForm = getLoginForm();
    expect(within(loginForm).queryByTestId("mock-captcha")).not.toBeInTheDocument();
    expect(screen.queryByText("Captcha chưa được cấu hình. Vui lòng kiểm tra VITE_RECAPTCHA_SITE_KEY.")).not.toBeInTheDocument();
    expect(getPrimaryLoginButton()).toBeEnabled();
  });

  it("shows a friendly validation message when login fields are empty", () => {
    renderLogin();

    fireEvent.submit(getLoginForm());

    expect(mocks.loginMutationMock).not.toHaveBeenCalled();
    expect(mocks.notifications.some((n) => n.message === "Vui lòng nhập tài khoản và mật khẩu")).toBe(true);
  });

  it("register submits without captcha token when disabled", async () => {
    renderLogin();

    fireEvent.click(screen.getByRole("tab", { name: "Đăng ký" }));
    const registerForm = getRegisterForm();
    fireEvent.change(within(registerForm).getByPlaceholderText("Họ và tên"), { target: { value: "Tester" } });
    fireEvent.change(within(registerForm).getByPlaceholderText("Email"), { target: { value: "tester@example.com" } });
    fireEvent.change(within(registerForm).getByPlaceholderText("Mật khẩu"), { target: { value: "123456" } });
    fireEvent.change(within(registerForm).getByPlaceholderText("Nhập lại mật khẩu"), { target: { value: "123456" } });
    fireEvent.click(within(registerForm).getByRole("checkbox"));
    fireEvent.submit(registerForm);

    await waitFor(() => expect(mocks.registerMutationMock).toHaveBeenCalledTimes(1));
    expect(mocks.registerMutationMock.mock.calls[0][0].variables.i.captchaToken).toBeUndefined();
  });
});
