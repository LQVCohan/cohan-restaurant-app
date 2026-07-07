import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import SecuritySettings from "./SecuritySettings";

const {
  deleteAccountMock,
  genericMutationMock,
  showNotificationMock,
  refetchMock,
} = vi.hoisted(() => ({
  deleteAccountMock: vi.fn(),
  genericMutationMock: vi.fn(),
  showNotificationMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock("@apollo/client", () => ({
  gql: (strings, ...values) =>
    strings.reduce(
      (result, part, index) => result + part + (values[index] || ""),
      "",
    ),
  useQuery: vi.fn(() => ({
    data: { myLoginSessions: [] },
    loading: false,
    refetch: refetchMock,
  })),
  useMutation: vi.fn((operation) => [
    String(operation).includes("DeleteMyAccount")
      ? deleteAccountMock
      : genericMutationMock,
    { loading: false },
  ]),
}));

vi.mock("../../../common/Modal", () => ({
  default: ({ isOpen, onClose, title, children }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
        <button type="button" onClick={onClose}>Đóng modal</button>
      </div>
    ) : null,
}));

vi.mock("../../../common/ToggleSwitch/ToggleSwitch", () => ({
  default: () => <button type="button">2FA</button>,
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: showNotificationMock }),
}));

const renderSettings = (roleName, logout = vi.fn()) => {
  render(
    <AuthContext.Provider value={{ user: { roleName }, logout }}>
      <SecuritySettings />
    </AuthContext.Provider>,
  );
  return { logout };
};

describe("SecuritySettings account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteAccountMock.mockResolvedValue({ data: { deleteMyAccount: true } });
  });

  it("does not expose customer account deletion to manager profiles", () => {
    renderSettings("manager");

    expect(screen.queryByText("Khu vực nguy hiểm")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xóa tài khoản" }),
    ).not.toBeInTheDocument();
  });

  it("requires the confirmation phrase before deleting a customer account", async () => {
    const { logout } = renderSettings("customer");

    fireEvent.click(screen.getByRole("button", { name: "Xóa tài khoản" }));
    const dialog = screen.getByRole("dialog", { name: "Xóa tài khoản" });
    const submitButton = within(dialog).getByRole("button", {
      name: "Xóa tài khoản",
    });

    expect(submitButton).toBeDisabled();

    fireEvent.change(
      within(dialog).getByLabelText("Nhập XOA TAI KHOAN"),
      { target: { value: "XOA TAI KHOAN" } },
    );

    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(deleteAccountMock).toHaveBeenCalledWith({
        variables: {
          currentPassword: "",
          confirmText: "XOA TAI KHOAN",
        },
      });
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });
});
