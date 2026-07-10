import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WalletPage from "./WalletPage";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const createTopupMock = vi.fn();
const refetchMock = vi.fn();
const startPollingMock = vi.fn();
const stopPollingMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings.join(""),
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

describe("WalletPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useQueryMock.mockImplementation((query) => {
      if (String(query).includes("MyCohanWallet")) {
        return {
          data: {
            myWallet: {
              balance: 250000,
              currency: "VND",
              status: "active",
              lifetimeTopup: 500000,
              lifetimePayment: 200000,
              lifetimeRefund: 0,
              lifetimeAdjustment: 0,
              transactionCount: 2,
              wallet: {
                provider: "cohan_wallet",
                status: "active",
                balance: 250000,
                currency: "VND",
                updatedAt: "2026-07-11T01:32:10.000Z",
              },
            },
            myWalletTransactions: [],
          },
          loading: false,
          error: null,
          refetch: refetchMock,
        };
      }

      return {
        data: null,
        loading: false,
        error: null,
        startPolling: startPollingMock,
        stopPolling: stopPollingMock,
      };
    });

    createTopupMock.mockResolvedValue({
      data: {
        createWalletTopup: {
          ok: true,
          message: "Đã tạo phiên nạp ví.",
          paymentSession: null,
        },
      },
    });
    useMutationMock.mockReturnValue([createTopupMock, { loading: false }]);
  });

  it("selects VNPAY and submits the existing wallet topup contract", async () => {
    render(<WalletPage />);

    const vnpayOption = screen.getByRole("radio", { name: /VNPAY/i });
    fireEvent.click(vnpayOption);
    expect(vnpayOption).toBeChecked();

    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiên thanh toán" }),
    );

    await waitFor(() => {
      expect(createTopupMock).toHaveBeenCalledWith({
        variables: {
          input: {
            amount: 100000,
            provider: "vnpay",
            metadata: { source: "customer_wallet_page" },
          },
        },
      });
    });
  });
});
