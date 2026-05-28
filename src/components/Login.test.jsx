import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
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

describe("Login captcha config", () => {
  beforeEach(() => {
    notifications.length = 0;
    loginMutationMock.mockReset();
    registerMutationMock.mockReset();
    loadRolesMock.mockClear();
    vi.resetModules();
  });

  it("submits login when captcha is disabled", async () => {
    vi.stubEnv("VITE_ENABLE_RECAPTCHA", "false");
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    await renderLogin();

    expect(screen.queryByTestId("mock-captcha")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Email / Username / SĐT"), { target: { value: "user1" } });
    fireEvent.change(screen.getAllByPlaceholderText("Mật khẩu")[1], { target: { value: "123456" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Đăng nhập" }).find((b) => b.className.includes("btn-primary")));

    expect(loginMutationMock).toHaveBeenCalledTimes(1);
    expect(loginMutationMock.mock.calls[0][0].variables.captchaToken).toBeUndefined();
  });

  it("requires captcha token when enabled and site key exists", async () => {
    vi.stubEnv("VITE_ENABLE_RECAPTCHA", "true");
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site-key");
    await renderLogin();

    expect(screen.getAllByTestId("mock-captcha").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText("Email / Username / SĐT"), { target: { value: "user1" } });
    fireEvent.change(screen.getAllByPlaceholderText("Mật khẩu")[1], { target: { value: "123456" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Đăng nhập" }).find((b) => b.className.includes("btn-primary")));

    expect(loginMutationMock).not.toHaveBeenCalled();
    expect(notifications.some((n) => n.message.includes("Vui lòng xác thực Captcha"))).toBe(true);
  });

  it("shows config warning and disables submit when enabled but missing key", async () => {
    vi.stubEnv("VITE_ENABLE_RECAPTCHA", "true");
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    await renderLogin();

    expect(screen.getAllByText("Captcha chưa được cấu hình. Vui lòng kiểm tra VITE_RECAPTCHA_SITE_KEY.").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Đăng nhập" }).find((b) => b.className.includes("btn-primary"))).toBeDisabled();
  });

  it("register submits without captcha token when disabled", async () => {
    vi.stubEnv("VITE_ENABLE_RECAPTCHA", "false");
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    await renderLogin();

    fireEvent.click(screen.getAllByRole("button", { name: "Đăng ký" })[0]);
    fireEvent.change(screen.getByPlaceholderText("Họ và tên"), { target: { value: "Tester" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "tester@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Username (Tên đăng nhập)"), { target: { value: "tester" } });
    fireEvent.change(screen.getAllByPlaceholderText("Mật khẩu")[0], { target: { value: "123456" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập lại mật khẩu"), { target: { value: "123456" } });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Đăng ký ngay" }));

    await waitFor(() => expect(registerMutationMock).toHaveBeenCalledTimes(1));
    expect(registerMutationMock.mock.calls[0][0].variables.i.captchaToken).toBeUndefined();
  });
});
