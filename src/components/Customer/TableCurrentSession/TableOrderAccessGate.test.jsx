import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useApolloClient: vi.fn(),
  requestAccess: vi.fn(),
  confirmAccess: vi.fn(),
  refetch: vi.fn(),
  refetchQueries: vi.fn(),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: mocks.useQuery,
    useMutation: mocks.useMutation,
    useApolloClient: mocks.useApolloClient,
  };
});

vi.mock("@/components/common/Modal", () => ({
  default: ({ isOpen, title, children, onClose }) =>
    isOpen ? (
      <section role="dialog" aria-label={title}>
        <button type="button" aria-label={`Đóng ${title}`} onClick={onClose}>
          Đóng
        </button>
        {children}
      </section>
    ) : null,
}));

import TableOrderAccessGate from "./TableOrderAccessGate";

const restaurantId = "64b000000000000000000001";
const tableId = "64b000000000000000000002";
const tableUrl = `/table/${restaurantId}/${tableId}?token=printed-table-token`;

const operationName = (document) =>
  document?.definitions?.find((definition) => definition?.name?.value)?.name?.value;

describe("TableOrderAccessGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.refetch.mockResolvedValue({});
    mocks.refetchQueries.mockResolvedValue([]);
    mocks.useApolloClient.mockReturnValue({
      refetchQueries: mocks.refetchQueries,
    });
    mocks.useQuery.mockReturnValue({
      data: {
        publicActiveTableSessionOrders: {
          tableId,
          tableCode: "A01",
          canRequestOrderAccess: true,
          orderAccessConfirmed: false,
          orderAccessBlockedReason:
            "Cần xác nhận thiết bị với nhân viên tại bàn trước khi xem và gọi món.",
          session: { id: "64b000000000000000000003" },
        },
      },
      loading: false,
      error: null,
      refetch: mocks.refetch,
    });
    mocks.requestAccess.mockResolvedValue({
      data: {
        publicRequestTableOrderAccess: {
          ok: true,
          requestToken: "request-token",
          requestId: "request-1",
          requestLabel: "A1B2",
          expiresAt: "2026-07-11T03:00:00.000Z",
        },
      },
    });
    mocks.confirmAccess.mockResolvedValue({
      data: {
        publicConfirmTableOrderAccess: {
          ok: true,
          sessionId: "64b000000000000000000003",
          expiresAt: "2026-07-11T11:00:00.000Z",
        },
      },
    });
    mocks.useMutation.mockImplementation((document) => {
      const name = operationName(document);
      if (name === "RequestPublicTableOrderAccess") {
        return [mocks.requestAccess, { loading: false }];
      }
      if (name === "ConfirmPublicTableOrderAccess") {
        return [mocks.confirmAccess, { loading: false }];
      }
      return [vi.fn(), { loading: false }];
    });
  });

  it("asks for staff confirmation only when the customer opens the send-order step", async () => {
    render(
      <MemoryRouter initialEntries={[tableUrl]}>
        <TableOrderAccessGate />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("dialog", { name: "Xác nhận gọi món tại bàn" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Nhờ nhân viên xác nhận tại bàn A01",
      }),
    );

    expect(
      await screen.findByRole("dialog", {
        name: "Xác nhận gọi món tại bàn",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Gửi yêu cầu cho nhân viên" }),
    );

    expect(await screen.findByText("#A1B2")).toBeInTheDocument();
    expect(mocks.requestAccess).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          restaurantId,
          tableId,
          token: "printed-table-token",
          deviceId: expect.stringMatching(/^table-device-/),
        }),
      },
    });

    const confirmButton = screen.getByRole("button", {
      name: "Xác nhận và gửi món",
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Mã xác nhận gồm 6 số"), {
      target: { value: "123456" },
    });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(mocks.confirmAccess).toHaveBeenCalledOnce());
    expect(mocks.confirmAccess).toHaveBeenCalledWith({
      variables: {
        input: {
          requestToken: "request-token",
          deviceId: expect.stringMatching(/^table-device-/),
          confirmationCode: "123456",
        },
      },
    });
    expect(mocks.refetch).toHaveBeenCalled();
    expect(mocks.refetchQueries).toHaveBeenCalled();
  });
});
