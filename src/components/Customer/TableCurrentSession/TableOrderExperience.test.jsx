import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apolloMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  confirmIdentity: vi.fn(),
  submitOrder: vi.fn(),
  refetchContext: vi.fn(),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: apolloMocks.useQuery,
    useMutation: apolloMocks.useMutation,
  };
});

vi.mock("@/components/common/Modal", () => ({
  default: ({ isOpen, title, children, onClose }) =>
    isOpen ? (
      <section role="dialog" aria-label={title || "Modal"}>
        <button type="button" aria-label={`Đóng ${title || "modal"}`} onClick={onClose}>Đóng</button>
        {children}
      </section>
    ) : null,
}));

import TableOrderExperience from "./TableOrderExperience";

const restaurantId = "64b000000000000000000001";
const tableId = "64b000000000000000000002";
const tableUrl = `/table/${restaurantId}/${tableId}?token=table-token`;

const operationName = (document) =>
  document?.definitions?.find((definition) => definition?.name?.value)?.name?.value;

function renderExperience() {
  return render(
    <MemoryRouter initialEntries={[tableUrl]}>
      <TableOrderExperience />
    </MemoryRouter>,
  );
}

describe("TableOrderExperience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    apolloMocks.refetchContext.mockResolvedValue({});
    apolloMocks.useQuery.mockImplementation((document) => {
      const name = operationName(document);
      if (name === "PublicTableOrderContext") {
        return {
          data: {
            publicActiveTableSessionOrders: {
              tableId,
              tableCode: "A01",
              tableStatus: "occupied",
              canOrder: true,
              orderBlockedReason: null,
              session: { id: "session-1", sessionStatus: "dining", orderPaymentStatus: "unpaid" },
              orders: [],
            },
          },
          loading: false,
          error: null,
          refetch: apolloMocks.refetchContext,
        };
      }
      if (name === "PublicTableMenuCategories") {
        return {
          data: {
            customerMenuCategories: [
              { id: "category-1", name: "Món chính", order: 1, isActive: true },
            ],
          },
          loading: false,
          error: null,
        };
      }
      if (name === "PublicTableMenuItems") {
        return {
          data: {
            menuItemsConnection: {
              edges: [
                {
                  node: {
                    id: "64b000000000000000000010",
                    restaurantId,
                    menuId: "64b000000000000000000011",
                    categoryId: "64b000000000000000000012",
                    name: "Cơm gà",
                    description: "Cơm gà thử nghiệm",
                    basePrice: 50000,
                    defaultServingKey: "portion",
                    thumbImage: null,
                    status: "available",
                    inventoryStatus: "IN_STOCK",
                    maxAvailable: 10,
                    stockWarnings: [],
                    avgPrepTimeMin: 15,
                    servingVariants: [
                      {
                        key: "portion",
                        name: "Phần tiêu chuẩn",
                        mode: "PORTION",
                        price: 50000,
                        sellQty: 1,
                        sellUnit: "portion",
                        isDefault: true,
                      },
                    ],
                  },
                },
              ],
            },
          },
          loading: false,
          error: null,
        };
      }
      if (name === "PublicTableItemModifiers") {
        return {
          data: { customerModifierGroups: [] },
          loading: false,
          error: null,
        };
      }
      return { data: undefined, loading: false, error: null };
    });

    apolloMocks.requestOtp.mockResolvedValue({
      data: {
        publicRequestTableIdentityOtp: {
          ok: true,
          challengeToken: "challenge-token",
          maskedPhone: "******5678",
          demoOtp: "123456",
        },
      },
    });
    apolloMocks.verifyOtp.mockResolvedValue({
      data: {
        publicVerifyTableIdentityOtp: {
          ok: true,
          requiresAccountConfirmation: true,
          candidateToken: "candidate-token",
          identityToken: null,
          maskedCustomerName: "Nguyễn V***",
          linkedAsGuest: false,
        },
      },
    });
    apolloMocks.confirmIdentity.mockResolvedValue({
      data: {
        publicConfirmTableIdentity: {
          ok: true,
          identityToken: "identity-token",
        },
      },
    });
    apolloMocks.submitOrder.mockResolvedValue({
      data: {
        publicSubmitTableOrder: {
          ok: true,
          message: "Đã gửi món.",
          order: { id: "order-1", orderCode: "QR-1", currentStatus: "pending", totals: { grandTotal: 50000 }, items: [] },
        },
      },
    });

    apolloMocks.useMutation.mockImplementation((document) => {
      const name = operationName(document);
      const handlers = {
        RequestPublicTableIdentityOtp: apolloMocks.requestOtp,
        VerifyPublicTableIdentityOtp: apolloMocks.verifyOtp,
        ConfirmPublicTableIdentity: apolloMocks.confirmIdentity,
        SubmitPublicTableOrder: apolloMocks.submitOrder,
      };
      return [handlers[name] || vi.fn(), { loading: false }];
    });
  });

  it("allows closing the optional phone prompt and submits an anonymous order", async () => {
    renderExperience();

    expect(await screen.findByRole("dialog", { name: "Lưu order và tích điểm" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua, không lưu tài khoản" }));

    fireEvent.click(screen.getByRole("button", { name: /Gọi món tại Bàn A01/i }));
    expect(await screen.findByText("Cơm gà")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chọn món" }));
    fireEvent.click(await screen.findByRole("button", { name: /Thêm vào đợt gọi món/i }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi order chờ nhân viên nhận" }));

    await waitFor(() => expect(apolloMocks.submitOrder).toHaveBeenCalledOnce());
    expect(apolloMocks.submitOrder.mock.calls[0][0].variables.input).toMatchObject({
      restaurantId,
      tableId,
      token: "table-token",
      identityToken: null,
    });
    expect(apolloMocks.submitOrder.mock.calls[0][0].variables.input.items[0]).toMatchObject({
      name: "Cơm gà",
      quantity: 1,
      servingKey: "portion",
    });
  });

  it("uses demo OTP and waits for explicit registered-account confirmation", async () => {
    renderExperience();

    fireEvent.click(await screen.findByRole("button", { name: "Nhập số điện thoại" }));
    fireEvent.change(screen.getByLabelText("Số điện thoại"), {
      target: { value: "0912345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục với OTP demo" }));

    expect(await screen.findByText("123456")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Mã OTP gồm 6 số"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác minh" }));

    expect(await screen.findByText("Nguyễn V***")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(`cohan:table-order:identity-token:${restaurantId}:${tableId}`)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Đúng, lưu vào tài khoản này" }));

    await waitFor(() =>
      expect(window.sessionStorage.getItem(`cohan:table-order:identity-token:${restaurantId}:${tableId}`)).toBe("identity-token"),
    );
    expect(apolloMocks.confirmIdentity).toHaveBeenCalledWith({
      variables: { input: { candidateToken: "candidate-token", accept: true } },
    });
  });
});
