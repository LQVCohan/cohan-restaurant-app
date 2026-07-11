import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaymentProviderSettingsPage from "./PaymentProviderSettingsPage";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const saveCredentialMock = vi.fn();
const disconnectCredentialMock = vi.fn();
const updateSettingsMock = vi.fn();
const refetchMock = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
}));

describe("PaymentProviderSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetchMock.mockResolvedValue({ data: {} });
    useQueryMock.mockReturnValue({
      loading: false,
      error: null,
      refetch: refetchMock,
      data: {
        restaurantPaymentCredentialStatuses: [
          {
            restaurantId: "restaurant-1",
            provider: "momo",
            mode: "sandbox",
            configured: true,
            source: "restaurant",
            maskedIdentifier: "MOM••••1234",
            version: 1,
            updatedAt: "2026-07-11T00:00:00.000Z",
          },
          {
            restaurantId: "restaurant-1",
            provider: "vnpay",
            mode: "sandbox",
            configured: true,
            source: "platform",
            maskedIdentifier: "VNP••••5678",
            version: 0,
            updatedAt: null,
          },
          {
            restaurantId: "restaurant-1",
            provider: "vnpay",
            mode: "production",
            configured: true,
            source: "restaurant",
            maskedIdentifier: "PRD••••9876",
            version: 1,
            updatedAt: "2026-07-11T00:00:00.000Z",
          },
        ],
        restaurantPaymentPublicConfig: {
          defaultProvider: "vnpay",
          providers: [
            { provider: "momo", label: "MoMo", active: true, priority: 1, mode: "sandbox", configured: true, credentialSource: "restaurant" },
            { provider: "vnpay", label: "VNPAY", active: true, priority: 2, mode: "sandbox", configured: true, credentialSource: "platform" },
          ],
        },
      },
    });
    saveCredentialMock.mockResolvedValue({ data: {} });
    disconnectCredentialMock.mockResolvedValue({ data: {} });
    updateSettingsMock.mockResolvedValue({ data: {} });
    useMutationMock.mockImplementation((document) => {
      const operation = Array.isArray(document) ? document.join("") : String(document || "");
      if (operation.includes("SaveRestaurantPaymentCredential")) {
        return [saveCredentialMock, { loading: false }];
      }
      if (operation.includes("DisconnectRestaurantPaymentCredential")) {
        return [disconnectCredentialMock, { loading: false }];
      }
      if (operation.includes("UpdateRestaurantPaymentSettings")) {
        return [updateSettingsMock, { loading: false }];
      }
      return [vi.fn(), { loading: false }];
    });
  });

  it("shows only masked identifiers and never rehydrates secrets", () => {
    render(<PaymentProviderSettingsPage restaurantId="restaurant-1" restaurantName="COHAN One" />);

    expect(screen.getByRole("heading", { name: "Kết nối MoMo và VNPAY" })).toBeInTheDocument();
    expect(screen.getByText("MOM••••1234")).toBeInTheDocument();
    expect(screen.getByText("VNP••••5678")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/secret/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Khóa bảo mật (Secret Key)")).toHaveValue("");
    expect(screen.getByLabelText("Khóa bảo mật (Hash Secret)")).toHaveValue("");
  });

  it("links managers to the official provider setup guides", () => {
    render(<PaymentProviderSettingsPage restaurantId="restaurant-1" restaurantName="COHAN One" />);

    expect(screen.getByRole("link", { name: /Hướng dẫn lấy thông tin từ MoMo/i })).toHaveAttribute(
      "href",
      "https://developers.momo.vn/v3/vi/docs/payment/onboarding/integration-process/",
    );
    expect(screen.getByRole("link", { name: /Hướng dẫn lấy thông tin từ VNPAY/i })).toHaveAttribute(
      "href",
      "https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html",
    );
  });

  it("saves a complete MoMo credential payload for the selected restaurant", async () => {
    render(<PaymentProviderSettingsPage restaurantId="restaurant-1" restaurantName="COHAN One" />);

    fireEvent.change(screen.getByLabelText("Mã đối tác (Partner Code)"), { target: { value: "PARTNER_NEW" } });
    fireEvent.change(screen.getByLabelText("Khóa truy cập (Access Key)"), { target: { value: "ACCESS_NEW" } });
    fireEvent.change(screen.getByLabelText("Khóa bảo mật (Secret Key)"), { target: { value: "SECRET_NEW" } });
    fireEvent.click(screen.getByRole("button", { name: /Cập nhật kết nối/i }));

    await waitFor(() => {
      expect(saveCredentialMock).toHaveBeenCalledWith({
        variables: {
          input: {
            restaurantId: "restaurant-1",
            provider: "momo",
            mode: "sandbox",
            credentialPayload: {
              partnerCode: "PARTNER_NEW",
              accessKey: "ACCESS_NEW",
              secretKey: "SECRET_NEW",
            },
          },
        },
      });
    });
    expect(updateSettingsMock).toHaveBeenCalled();
    expect(refetchMock).toHaveBeenCalled();
  });

  it("does not persist an unsaved mode when only toggling provider visibility", async () => {
    render(<PaymentProviderSettingsPage restaurantId="restaurant-1" restaurantName="COHAN One" />);

    fireEvent.click(screen.getAllByLabelText("Tài khoản chính thức")[1]);
    fireEvent.click(screen.getAllByRole("checkbox")[1]);

    await waitFor(() => expect(updateSettingsMock).toHaveBeenCalledTimes(1));
    const providers = updateSettingsMock.mock.calls[0][0].variables.input.providers;
    expect(providers.find((item) => item.provider === "vnpay")).toMatchObject({
      active: false,
      mode: "sandbox",
    });
  });
});
