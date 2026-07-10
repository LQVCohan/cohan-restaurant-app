import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import TransferPaymentReviewPage, {
  ALL_REVIEW_STATUSES,
  GET_TRANSFER_PAYMENT_QUEUE,
} from "./TransferPaymentReviewPage";

const scopeMocks = vi.hoisted(() => ({ useScope: vi.fn() }));

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: scopeMocks.useScope,
}));
vi.mock("@/utils/frontendPermissionAccess", () => ({
  hasPermission: vi.fn(() => true),
}));

const summary = {
  total: 9,
  actionable: 3,
  submitted: 2,
  verifying: 1,
  rejected: 1,
  verified: 2,
  failed: 1,
  expired: 1,
};

const queryMock = ({ statuses, rows }) => ({
  request: {
    query: GET_TRANSFER_PAYMENT_QUEUE,
    variables: {
      restaurantId: "restaurant-2",
      status: null,
      statuses,
      limit: 50,
    },
  },
  result: {
    data: {
      transferPaymentQueue: rows,
      transferPaymentQueueSummary: summary,
    },
  },
});

const failedPayment = {
  id: "payment-failed",
  restaurantId: "restaurant-2",
  reference: "TX-FAILED",
  amount: 120000,
  currency: "VND",
  status: "failed",
  callbackStatus: "rejected",
  providerTransactionId: null,
  metadata: {
    restaurantName: "Chi nhánh trung tâm",
    customerName: "Nguyễn An",
    orderCodes: ["ORD-1024"],
    bankTransfer: { transferContent: "TX-FAILED" },
  },
  createdAt: "2026-07-10T08:00:00.000Z",
  updatedAt: "2026-07-10T08:05:00.000Z",
  transfer: {
    status: "FAILED",
    submittedAt: "2026-07-10T08:01:00.000Z",
    proofImages: [],
    proofNote: "Đã chuyển khoản",
    customerClaimedPaidAt: "2026-07-10T08:01:00.000Z",
    verifiedAt: null,
    rejectedAt: "2026-07-10T08:05:00.000Z",
    rejectReason: "Bằng chứng không hợp lệ",
    providerTransactionId: null,
    receivedAmount: null,
    varianceAmount: null,
    rejectedCount: 3,
    maxRejectedCount: 3,
  },
};

const renderPage = (mocks) => render(
  <AuthContext.Provider value={{ user: { id: "manager-1" } }}>
    <MockedProvider mocks={mocks}>
      <TransferPaymentReviewPage />
    </MockedProvider>
  </AuthContext.Provider>,
);

describe("TransferPaymentReviewPage", () => {
  beforeEach(() => {
    scopeMocks.useScope.mockReturnValue({
      restaurantOptions: [
        { id: "restaurant-1", name: "Chi nhánh cũ" },
        { id: "restaurant-2", name: "Chi nhánh trung tâm" },
      ],
      selectedRestaurantId: "restaurant-2",
      selectedRestaurant: { id: "restaurant-2", name: "Chi nhánh trung tâm" },
      restaurantsLoading: false,
    });
  });

  it("uses the canonical manager restaurant and exact database summary", async () => {
    renderPage([
      queryMock({ statuses: ["SUBMITTED", "VERIFYING"], rows: [] }),
    ]);

    expect(await screen.findByText("Chi nhánh trung tâm")).toBeInTheDocument();
    expect(screen.getByText("Không có giao dịch cần xử lý")).toBeInTheDocument();
    expect(screen.getByText("Nhà hàng hiện có 9 giao dịch trong toàn bộ hàng đợi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cần xử lý\s*3/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Không hợp lệ\s*1/ })).toBeInTheDocument();
  });

  it("requests every displayed status when the All filter is selected", async () => {
    renderPage([
      queryMock({ statuses: ["SUBMITTED", "VERIFYING"], rows: [] }),
      queryMock({ statuses: ALL_REVIEW_STATUSES, rows: [failedPayment] }),
    ]);

    fireEvent.click(await screen.findByRole("button", { name: /Tất cả\s*9/ }));

    const card = await screen.findByRole("article", { name: "Giao dịch TX-FAILED" });
    expect(within(card).getByText("Không hợp lệ")).toBeInTheDocument();
    expect(within(card).getByText("Bằng chứng không hợp lệ")).toBeInTheDocument();
    expect(within(card).getByText("3/3")).toBeInTheDocument();
  });
});
