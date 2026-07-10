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

    expect(screen.getByRole("heading", { name: "Cấu hình cổng thanh toán" })).toBeInTheDocument();
    expect(screen.getByText("MOM••••1234")).toBeInTheDocument();
    expect(screen.getByText("VNP••••5678")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/secret/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Secret Key")).toHaveValue("");
    expect(screen.getByLabelText("Hash Secret")).toHaveValue("");
  });

  it("saves a complete MoMo credential payload for the selected restaurant", async () => {
    render(<PaymentProviderSettingsPage restaurantId="restaurant-1" restaurantName="COHAN One" />);

    fireEvent.change(screen.getByLabelText("Partner Code"), { target: { value: "PARTNER_NEW" } });
    fireEvent.change(screen.getByLabelText("Access Key"), { target: { value: "ACCESS_NEW" } });
    fireEvent.change(screen.getByLabelText("Secret Key"), { target: { value: "SECRET_NEW" } });
    fireEvent.click(screen.getByRole("button", { name: /Thay tài khoản/i }));

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
});
